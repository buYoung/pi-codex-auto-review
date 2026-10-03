import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';

async function qualifyProcessReaping() {
  const initProcess = (await readFile('/proc/1/comm', 'utf8')).trim();
  // The shell exits before its background child. The container's PID 1 must
  // adopt and reap that child; otherwise repeated shell runs exhaust pids.max.
  const { stdout } = await promisify(execFile)('/bin/sh', ['-c', 'sleep 0.2 & printf "%s" "$!"'], {
    timeout: 5000, env: { PATH: process.env.PATH },
  });
  assert.match(stdout, /^[1-9]\d*$/);
  const deadlineAtMs = Date.now() + 2000;
  while (Date.now() < deadlineAtMs) {
    try { await access(`/proc/${stdout}`); }
    catch (error) {
      if (error.code === 'ENOENT') return { initProcess, orphanReaped: true };
      throw error;
    }
    await delay(25);
  }
  throw new Error('Container PID 1 did not reap an exited orphan process; run the verification container with --init');
}

export async function executionPreflight() {
  const processReaping = await qualifyProcessReaping();
  const startup=process.env.PI_GUARD_PACKAGED_STARTUP??'/opt/installed/package/dist/startup.js';
  const {PiExecutor}=await import(pathToFileURL(resolve(startup,'../tools/executor.js')).href);
  const {createProfile,EMPTY_DELTA}=await import(pathToFileURL(resolve(startup,'../contracts.js')).href);
  const root=await mkdtemp('/tmp/pi-cloud-execution-'),cwd=join(root,'workspace');await mkdir(cwd);
  const executor=new PiExecutor(),profile=createProfile({mode:'workspace-write',readRoots:[cwd],writeRoots:[cwd],denyRead:[],denyWrite:[],allowedDomains:[],deniedDomains:[]});
  try {
    await executor.execute({kind:'file',operation:'write',path:join(cwd,'allowed.txt'),content:'owned',cwd},profile,EMPTY_DELTA);
    assert.equal(await readFile(join(cwd,'allowed.txt'),'utf8'),'owned');
    const cancelled=new AbortController();cancelled.abort();
    await assert.rejects(executor.execute({kind:'file',operation:'write',path:join(cwd,'cancelled.txt'),content:'must not happen',cwd},profile,EMPTY_DELTA,{signal:cancelled.signal}));
    await assert.rejects(access(join(cwd,'cancelled.txt')));
    return {permittedEffect:true,cancellationPreventedEffect:true,platform:`${process.platform}-${process.arch}`,processReaping};
  }finally{await executor.close();await rm(root,{recursive:true,force:true});}
}
