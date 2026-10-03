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
  // adopt and reap that child; otherwise repeated native runs exhaust pids.max.
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

export async function nativePreflight() {
  const processReaping = await qualifyProcessReaping();
  const startup=process.env.PI_GUARD_PACKAGED_STARTUP??'/opt/installed/package/dist/startup.js';
  const {NativeExecutor}=await import(pathToFileURL(resolve(startup,'../sandbox/executor.js')).href);
  const {createProfile,EMPTY_DELTA}=await import(pathToFileURL(resolve(startup,'../contracts.js')).href);
  const root=await mkdtemp('/tmp/pi-cloud-native-'),cwd=join(root,'workspace'),outside=join(root,'outside');await mkdir(cwd);await mkdir(outside);
  const sentinel=join(outside,'sentinel.txt');await writeFile(sentinel,'unchanged');
  const executor=new NativeExecutor(),profile=createProfile({mode:'workspace-write',readRoots:[cwd],writeRoots:[cwd],denyRead:[],denyWrite:[],allowedDomains:[],deniedDomains:[]});
  try {
    await executor.qualify(profile,cwd);
    await executor.execute({kind:'file',operation:'write',path:join(cwd,'allowed.txt'),content:'owned',cwd},profile,EMPTY_DELTA);
    assert.equal(await readFile(join(cwd,'allowed.txt'),'utf8'),'owned');
    await assert.rejects(executor.execute({kind:'file',operation:'write',path:sentinel,content:'must not happen',cwd},profile,EMPTY_DELTA));
    assert.equal(await readFile(sentinel,'utf8'),'unchanged');
    // Linux may accept a write into its private masking tmpfs. It must never create a host file.
    await executor.execute({kind:'file',operation:'write',path:join(root,'denied.txt'),content:'private overlay only',cwd},profile,EMPTY_DELTA).catch(()=>{});
    await assert.rejects(access(join(root,'denied.txt')));
    return {permittedEffect:true,deniedEffect:true,platform:`${process.platform}-${process.arch}`,processReaping};
  }finally{await executor.close();await rm(root,{recursive:true,force:true});}
}
