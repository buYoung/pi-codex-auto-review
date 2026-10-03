import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { realpath } from 'node:fs/promises';
import { GuardError, EMPTY_DELTA, type ExecutionOptions, type Json, type PermissionDelta, type PermissionProfile, type WorkerJob, validateWorkerFrame } from '../contracts.js';
import { nativeConfig, workloadEnvironment } from './config.js';
import { withSignal } from '../signals.js';
import { matchesDomain } from '../policy/domains.js';

export interface SandboxExecutor {
  execute(job: WorkerJob, profile: PermissionProfile, delta: PermissionDelta, options?: ExecutionOptions): Promise<Json>;
  qualify(profile: PermissionProfile, cwd: string): Promise<void>;
  close(): Promise<void>;
}
export class NativeExecutor implements SandboxExecutor {
  private active = new Set<Promise<unknown>>();
  private stop = new AbortController();
  get activeInvocationCount(): number { return this.active.size; }
  /** Trusted broker transport, e.g. an enterprise proxy. Never sourced from tool arguments. */
  constructor(private readonly transport?: { socketPath: string; domains: readonly string[] }) {}
  async qualify(profile: PermissionProfile, cwd: string): Promise<void> {
    const data: Buffer[] = [];
    try {
      const result = await this.execute({ kind: 'shell', command: "printf 'pi-guard-native-ready'", cwd }, profile, EMPTY_DELTA, { timeoutSeconds: 15, onData: chunk => data.push(chunk) });
      if ((result as {exitCode: number}).exitCode !== 0 || Buffer.concat(data).toString() !== 'pi-guard-native-ready') throw new GuardError('ENVIRONMENT_BLOCKED', 'Native permitted-launch control did not succeed');
    } catch (error) { throw new GuardError('ENVIRONMENT_BLOCKED', `ENVIRONMENT_BLOCKED: native qualification failed: ${(error as Error).message}`, { cause: error }); }
  }
  async execute(job: WorkerJob, profile: PermissionProfile, delta: PermissionDelta = EMPTY_DELTA, options: ExecutionOptions = {}): Promise<Json> {
    if (!['darwin', 'linux'].includes(process.platform)) throw new GuardError('UNSUPPORTED_PLATFORM', 'Native isolation supports only Darwin and Linux');
    const lifetime = new AbortController();
    const signal = AbortSignal.any([lifetime.signal, this.stop.signal, ...(options.signal ? [options.signal] : [])]);
    signal.throwIfAborted();
    const config = await nativeConfig(profile, delta, job.cwd, options.authority);
    if (options.onNetworkRequest) config.network.strictAllowlist = false;
    if (this.transport) config.network.mitmProxy = { socketPath: await realpath(this.transport.socketPath), domains: [...this.transport.domains] };
    const timeoutSeconds = options.timeoutSeconds ?? (job.kind === 'shell' ? job.timeoutSeconds : undefined) ?? 120;
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) throw new GuardError('INVALID_TIMEOUT', 'Execution timeout must be positive seconds');
    const child = fork(fileURLToPath(new URL('./broker.js', import.meta.url)), [], {
      execArgv: [], serialization: 'json', env: workloadEnvironment(), stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    // Broker owns the workload process group and is never itself a workload child.
    const seenNetworkRequests = new Set<string>();
    const task = new Promise<Json>((resolve, reject) => {
      let terminal: Json | undefined, error: Error | undefined, stderr = '', isTerminal = false, forceTimer: NodeJS.Timeout | undefined, processGroupId: number | undefined;
      const killOwnedGroup = () => { if(processGroupId)try{process.kill(-processGroupId,'SIGKILL');}catch(cause){if((cause as NodeJS.ErrnoException).code!=='ESRCH')error??=cause as Error;} };
      const terminate = (cause: Error) => {
        error ??= cause;
        if (child.connected) child.send({ type: 'cancel' });
        forceTimer ??= setTimeout(() => {killOwnedGroup();child.kill('SIGKILL');}, 4000);
      };
      const onAbort = () => terminate(new GuardError('CANCELLED', 'Native execution cancelled'));
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
      const deadline = setTimeout(() => terminate(new GuardError('TIMEOUT', `Native execution exceeded ${timeoutSeconds} seconds`)), timeoutSeconds * 1000);
      child.stderr?.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8192); });
      child.on('error', cause => { error ??= cause; });
      child.on('message', raw => {
        try {
          const control=raw as {schemaVersion?:number;type?:string;processGroupId?:number;requestId?:string;destination?:{host?:string;port?:number}};
          if (control.type === 'network-request') {
            const requestId=control.requestId, destination=control.destination;
            if (control.schemaVersion!==1 || !requestId || seenNetworkRequests.has(requestId) || !destination || typeof destination.host!=='string' || !/^[a-z0-9][a-z0-9.-]*$/i.test(destination.host) || destination.port!==undefined && (!Number.isInteger(destination.port)||destination.port<1||destination.port>65535) || isTerminal) throw new GuardError('INVALID_IPC','Invalid network approval request');
            seenNetworkRequests.add(requestId);
            const request={host:destination.host.toLowerCase(),...(destination.port!==undefined?{port:destination.port}:{})};
            const pending = signal.aborted || profile.deniedDomains.some(pattern=>matchesDomain(request.host,pattern)) || !options.onNetworkRequest
              ? Promise.resolve(false) : withSignal(options.onNetworkRequest(request,signal),signal);
            void pending.catch(()=>false).then(isAllowed=>{if(child.connected)child.send({schemaVersion:1,type:'network-response',requestId,isAllowed:isAllowed===true&&!signal.aborted});});
            return;
          }
          if(control.type==='workload-started'){
            if(control.schemaVersion!==1 || !Number.isInteger(control.processGroupId) || control.processGroupId! <= 1 || processGroupId || isTerminal)throw new GuardError('INVALID_IPC','Invalid broker process group');
            processGroupId=control.processGroupId;
            if (error || signal.aborted) killOwnedGroup();
            return;
          }
          const frame = validateWorkerFrame(raw);
          if (isTerminal) throw new GuardError('INVALID_IPC', 'Worker emitted data after its terminal frame');
          if (frame.type === 'data') options.onData?.(Buffer.from(frame.data, 'base64'));
          if (frame.type === 'update') options.onUpdate?.(frame.result);
          if (frame.type === 'result') { terminal = frame.result; isTerminal = true; }
          if (frame.type === 'error') { error ??= new GuardError(frame.code, frame.message); isTerminal = true; }
        } catch (cause) { terminate(cause as Error); }
      });
      child.once('close', () => {
        if(!isTerminal)killOwnedGroup();
        clearTimeout(deadline); if (forceTimer) clearTimeout(forceTimer); signal.removeEventListener('abort', onAbort);
        lifetime.abort();
        if (error) reject(error);
        else if (!isTerminal) reject(new GuardError('WORKER_FAILED', `Worker closed without a result${stderr ? `: ${stderr}` : ''}`));
        else resolve(terminal!);
      });
      child.send({ type: 'execute', commandId: randomUUID(), config, job: { ...job, ...(job.kind === 'shell' ? { env: workloadEnvironment(options.env ?? job.env), timeoutSeconds } : {}) } });
    });
    this.active.add(task);
    try { return await task; } finally { this.active.delete(task); }
  }
  async close(): Promise<void> { this.stop.abort(); await Promise.allSettled([...this.active]); }
}
