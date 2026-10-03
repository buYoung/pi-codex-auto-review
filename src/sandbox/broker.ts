import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { randomUUID } from 'node:crypto';
import { SandboxManager, type SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime';
import { GuardError, validateWorkerFrame, type WorkerJob, type WorkerFrame } from '../contracts.js';
import { shellQuote, workloadEnvironment } from './config.js';

let workload: ChildProcess | undefined, isExecuting = false;
const cancellation = new AbortController();
const networkRequests = new Map<string, (allowed: boolean) => void>();
cancellation.signal.addEventListener('abort', () => { for (const resolve of networkRequests.values()) resolve(false); networkRequests.clear(); });
const send = (frame: WorkerFrame) => { if (process.connected) process.send?.(frame); };
function killGroup(signal: NodeJS.Signals): void {
  if (!workload?.pid) return;
  try { process.kill(-workload.pid, signal); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
}
process.on('disconnect', () => { cancellation.abort(); killGroup('SIGKILL'); void SandboxManager.reset().finally(() => process.exit(1)); });
process.on('message', raw => {
  const message = raw as { type: string; commandId: string; config: SandboxRuntimeConfig; job: WorkerJob };
  if (message?.type === 'network-response') {
    const response = raw as {schemaVersion?: number; requestId?: string; isAllowed?: boolean};
    if (response.schemaVersion !== 1 || typeof response.requestId !== 'string' || typeof response.isAllowed !== 'boolean') { cancellation.abort(); killGroup('SIGKILL'); return; }
    networkRequests.get(response.requestId)?.(response.isAllowed && !cancellation.signal.aborted);
    networkRequests.delete(response.requestId);
    return;
  }
  if (message?.type === 'cancel') { cancellation.abort(); killGroup('SIGTERM'); setTimeout(() => killGroup('SIGKILL'), 300).unref(); return; }
  if (message?.type !== 'execute' || isExecuting) { send({ schemaVersion: 1, type: 'error', code: 'INVALID_IPC', message: 'Invalid broker request' }); process.exitCode = 1; return; }
  isExecuting = true;
  void run(message).catch(error => send({ schemaVersion: 1, type: 'error', code: (error as GuardError).code ?? 'BACKEND_FAILED', message: (error as Error).message })).finally(async () => {
    killGroup('SIGKILL');
    await SandboxManager.reset();
    // Wait for IPC delivery before dropping the controller channel.
    process.disconnect();
  });
});
async function run({ commandId, config, job }: { commandId: string; config: SandboxRuntimeConfig; job: WorkerJob }): Promise<void> {
  if (!job || !['shell', 'tool', 'file'].includes(job.kind) || typeof job.cwd !== 'string') throw new GuardError('INVALID_IPC', 'Invalid workload');
  await SandboxManager.initialize(config, config.network.strictAllowlist === false ? async destination => {
    if (cancellation.signal.aborted || !process.connected || networkRequests.size >= 32) return false;
    const requestId = randomUUID();
    return new Promise<boolean>(resolve => {
      networkRequests.set(requestId, resolve);
      process.send?.({schemaVersion:1,type:'network-request',requestId,destination});
    });
  } : undefined, false);
  cancellation.signal.throwIfAborted();
  if (!SandboxManager.isSandboxingEnabled() || !await SandboxManager.waitForNetworkInitialization()) throw new GuardError('BACKEND_UNAVAILABLE', 'Native filesystem/network sandbox is unavailable');
  if (process.platform === 'linux') {
    // SRT emits bridge mounts before filesystem masks. Restore only this
    // invocation's proxy sockets when a restrictive read profile masks /tmp.
    const sockets = [SandboxManager.getLinuxHttpSocketPath(), SandboxManager.getLinuxSocksSocketPath()].filter((path): path is string => !!path);
    SandboxManager.updateConfig({...config, filesystem: {...config.filesystem, allowRead: [...(config.filesystem.allowRead ?? []), ...sockets]}});
  }
  const command = `${shellQuote(process.execPath)} ${shellQuote(fileURLToPath(new URL('./worker.js', import.meta.url)))}`;
  const wrapped = await SandboxManager.wrapWithSandboxArgv(command, '/bin/bash', undefined, cancellation.signal, job.cwd, { commandId });
  if (!wrapped.argv.length || !wrapped.argv.some(arg => arg.includes('sandbox-exec') || arg.includes('bwrap'))) throw new GuardError('BACKEND_UNAVAILABLE', 'Runtime did not return a native isolation command');
  await new Promise<void>((resolve, reject) => {
    let buffer = '', stderr = '', hasTerminal = false, parseError: Error | undefined;
    const decoder=new StringDecoder('utf8');
    workload = spawn(wrapped.argv[0]!, wrapped.argv.slice(1), { cwd: job.cwd, detached: true, env: { ...workloadEnvironment(job.kind === 'shell' ? job.env : {}), ...wrapped.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    if(workload.pid && process.connected)process.send?.({schemaVersion:1,type:'workload-started',processGroupId:workload.pid});
    workload.on('error', reject);
    workload.stderr?.on('data', data => { stderr = (stderr + data.toString()).slice(-8192); });
    workload.stdout?.on('data', chunk => {
      buffer += decoder.write(chunk);
      if (Buffer.byteLength(buffer,'utf8') > 32 * 1024 * 1024) { parseError = new GuardError('INVALID_IPC', 'Worker frame exceeds size limit'); killGroup('SIGKILL'); return; }
      for (;;) {
        const end = buffer.indexOf('\n'); if (end < 0) break;
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          if (hasTerminal) throw new GuardError('INVALID_IPC', 'Duplicate terminal frame');
          const frame = validateWorkerFrame(JSON.parse(line));
          if (frame.type === 'result' || frame.type === 'error') hasTerminal = true;
          send(frame);
        } catch (error) { parseError = error as Error; killGroup('SIGKILL'); }
      }
    });
    workload.once('close', (code) => {
      buffer+=decoder.end();
      if (parseError) reject(parseError);
      else if (cancellation.signal.aborted) reject(new GuardError('CANCELLED', 'Workload cancelled'));
      else if (!hasTerminal || buffer.trim()) reject(new GuardError(/sandbox_init|Operation not permitted|bwrap:/.test(stderr) ? 'ENVIRONMENT_BLOCKED' : 'WORKER_FAILED', `Native worker failed (${code}): ${stderr || 'missing IPC result'}`));
      else resolve();
    });
    workload.stdin?.on('error', () => {});
    workload.stdin?.end(JSON.stringify(job) + '\n');
  });
}
