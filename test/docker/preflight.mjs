import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function nativePreflight() {
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
    return {permittedEffect:true,deniedEffect:true,platform:`${process.platform}-${process.arch}`};
  }finally{await executor.close();await rm(root,{recursive:true,force:true});}
}
