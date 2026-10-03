import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { access, readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { constants as osConstants } from 'node:os';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TOOL_NAMES, GuardError, type Json, type WorkerFrame, type WorkerJob } from '../contracts.js';

const send = (frame: WorkerFrame) => process.stdout.write(JSON.stringify(frame) + '\n');
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
let hasJob = false;
input.on('line', line => {
  if (hasJob) { process.exitCode = 1; return; }
  hasJob = true; input.close();
  void execute(JSON.parse(line) as WorkerJob).then(result => send({schemaVersion:1,type:'result',result})).catch(error => send({schemaVersion:1,type:'error',code:(error as GuardError).code??'WORKLOAD_ERROR',message:(error as Error).message}));
});
async function execute(job: WorkerJob): Promise<Json> {
  if (!job || !['shell','tool','file'].includes(job.kind)) throw new GuardError('INVALID_IPC','Invalid workload job');
  if (job.kind === 'shell') {
    return new Promise((resolve, reject) => {
      // All descendants inherit the kernel sandbox. The unsandboxed broker never evaluates this string.
      const shellPath = job.shellPath ?? '/bin/bash';
      if (!shellPath.startsWith('/') || shellPath.includes('\0')) throw new GuardError('INVALID_SHELL','Shell path must be absolute');
      const child = spawn(shellPath, ['-c', job.command], { cwd: job.cwd, env: process.env, stdio: ['ignore','pipe','pipe'] });
      const data = (chunk: Buffer) => send({schemaVersion:1,type:'data',data:chunk.toString('base64')});
      child.stdout.on('data',data); child.stderr.on('data',data); child.on('error',reject);
      child.on('close',(code,signal) => resolve({exitCode:code ?? (signal ? 128+osConstants.signals[signal] : null)}));
    });
  }
  if (job.kind === 'file') {
    if (typeof job.path !== 'string' || !job.path.startsWith('/') || job.path.includes('\0')) throw new GuardError('INVALID_IPC','Expected an absolute worker path');
    switch (job.operation) {
      case 'read': return {data:(await readFile(job.path)).toString('base64')};
      case 'write': await writeFile(job.path,job.content ?? ''); return null;
      case 'mkdir': await mkdir(job.path,{recursive:true}); return null;
      case 'access': await access(job.path,constants.R_OK); return null;
      case 'stat': return {isDirectory:(await stat(job.path)).isDirectory()};
      case 'list': return await readdir(job.path);
      default: throw new GuardError('INVALID_IPC','Unknown file operation');
    }
  }
  if (!TOOL_NAMES.includes(job.tool)) throw new GuardError('INVALID_IPC','Unknown local tool');
  // Running the public Pi definition inside the boundary also confines grep's rg process,
  // image MIME reads, find globbing, edit matching, access, mkdir and stat helpers.
  const piSDKEntryPath = process.argv[2];
  if (!piSDKEntryPath || !isAbsolute(piSDKEntryPath) || piSDKEntryPath.includes('\0')) throw new GuardError('INVALID_IPC','Expected a trusted absolute Pi SDK entry');
  const pi = await import(pathToFileURL(piSDKEntryPath).href) as typeof import('@earendil-works/pi-coding-agent');
  const definitions = {
    bash: pi.createBashToolDefinition,
    read: pi.createReadToolDefinition,
    edit: pi.createEditToolDefinition,
    write: pi.createWriteToolDefinition,
    grep: pi.createGrepToolDefinition,
    find: pi.createFindToolDefinition,
    ls: pi.createLsToolDefinition,
  };
  const tool = definitions[job.tool](job.cwd, job.tool === 'read' ? job.options : undefined);
  const result = await tool.execute(job.toolCallId, job.args as never, undefined, update => send({schemaVersion:1,type:'update',result:update as never}), undefined as never);
  return JSON.parse(JSON.stringify(result)) as Json;
}
