import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, symlink, link, access, mkdir, rename } from 'node:fs/promises';
import { constants as osConstants } from 'node:os';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { join } from 'node:path';
import { NativeExecutor } from '../../dist/sandbox/executor.js';
import { shellQuote, workloadEnvironment } from '../../dist/sandbox/config.js';
import { EMPTY_DELTA, createProfile } from '../../dist/contracts.js';
import { fixture } from '../harness/fixtures.mjs';
const recordObservation=(t,kind,effect)=>t.diagnostic('NATIVE_OBSERVATION:'+JSON.stringify({kind,effect,isObserved:true,platform:`${process.platform}-${process.arch}`}));

async function setup(t, transport) {
  const f = await fixture(t), executor = new NativeExecutor(transport); t.after(()=>executor.close());
  await executor.qualify(f.profile,f.workspace);
  const execute=(job,profile=f.profile,delta=EMPTY_DELTA,options={})=>executor.execute({...job,cwd:f.workspace},profile,delta,options);
  const shell=async(command,profile=f.profile,delta=EMPTY_DELTA,options={})=>{const output=[];const result=await execute({kind:'shell',command},profile,delta,{...options,onData:data=>{output.push(data);options.onData?.(data);}});return {...result,output:Buffer.concat(output).toString()};};
  return {...f,executor,execute,shell};
}
test('[native-launch] permitted process preserves cwd, output, filtered caller env and nonzero exits', async t => {
  const f=await setup(t);
  const result=await f.shell('pwd; printf "%s" "$GUARD_CALLER_VALUE"; exit 7',f.profile,EMPTY_DELTA,{env:{GUARD_CALLER_VALUE:'caller-value',API_KEY:f.secret,NODE_OPTIONS:'--bad-option'},timeoutSeconds:5});
  assert.equal(result.exitCode,7); assert.match(result.output,new RegExp(f.workspace)); assert.match(result.output,/caller-value/); assert.ok(!result.output.includes(f.secret));
  assert.equal(workloadEnvironment({API_KEY:f.secret,NODE_OPTIONS:'evil',BASH_ENV:'evil',GUARD_VALUE:'allowed'},{}).GUARD_VALUE,'allowed');
  assert.ok(!Object.hasOwn(workloadEnvironment({API_KEY:f.secret},{}),'API_KEY'));
  assert.equal((await f.shell('kill -USR2 $$')).exitCode,128+osConstants.signals.SIGUSR2);
  recordObservation(t,'allow','shell output/cwd/caller environment and nonzero status');
});
test('[native-files] real shell/file/descendant/symlink writes cannot change an outside sentinel', async t => {
  const f=await setup(t), target=join(f.outside,'sentinel.txt'), allowed=join(f.workspace,'allowed.txt');
  await f.execute({kind:'file',operation:'write',path:allowed,content:'allowed'}); assert.equal(await readFile(allowed,'utf8'),'allowed');
  await assert.rejects(f.execute({kind:'file',operation:'write',path:target,content:'escaped'}));
  assert.notEqual((await f.shell(`printf escaped > ${shellQuote(target)}`)).exitCode,0);
  assert.notEqual((await f.shell(`/bin/bash -c ${shellQuote(`printf descendant > ${shellQuote(target)}`)}`)).exitCode,0);
  await symlink(f.outside,join(f.workspace,'escape'));
  await assert.rejects(f.execute({kind:'file',operation:'write',path:join(f.workspace,'escape/sentinel.txt'),content:'symlink'}));
  assert.equal(await readFile(target,'utf8'),'unchanged');
  await assert.rejects(f.execute({kind:'file',operation:'read',path:join(f.control,'protected.txt')}));
  const secretRead=await f.shell(`cat ${shellQuote(join(f.control,'protected.txt'))}`); assert.notEqual(secretRead.exitCode,0); assert.ok(!secretRead.output.includes(f.secret));
  // Put a protected subtree inside a writable workspace to challenge ancestor moves and aliases.
  const secretDir=join(f.workspace,'config/protected');await mkdir(secretDir,{recursive:true});await writeFile(join(secretDir,'secret.txt'),f.secret);
  const protectedProfile=createProfile({...f.profile,denyRead:[...f.profile.denyRead,secretDir],denyWrite:[...f.profile.denyWrite,secretDir]});
  const moved=await f.shell(`mv config moved-config; cat moved-config/protected/secret.txt`,protectedProfile);assert.ok(!moved.output.includes(f.secret));
  const linked=await f.shell(`ln ${shellQuote(join(secretDir,'secret.txt'))} alias.txt; cat alias.txt`,protectedProfile);assert.ok(!linked.output.includes(f.secret));
  const readOnly=createProfile({...f.profile,mode:'read-only',writeRoots:[]});
  const read=await f.execute({kind:'file',operation:'read',path:allowed},readOnly); assert.equal(Buffer.from(read.data,'base64').toString(),'allowed');
  await assert.rejects(f.execute({kind:'file',operation:'write',path:allowed,content:'changed'},readOnly)); assert.equal(await readFile(allowed,'utf8'),'allowed');
  recordObservation(t,'allow','workspace write/read and read-only read');recordObservation(t,'deny','outside sentinel unchanged under shell/file/descendant/symlink and read-only paths; protected read blocked');
});
test('[native-network] allowed proxy control reaches an owned service and denied proxy/direct traffic does not', async t => {
  const serviceFixture=await fixture(t); let requests=0;
  const socketPath=join(serviceFixture.control,'network.sock');
  const server=createServer((_req,res)=>{requests++;res.end('owned-service');}); server.listen(socketPath); await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const f=await setup(t,{socketPath,domains:['fixture.example']});
  const url='http://fixture.example/proof', allowed=createProfile({...f.profile,allowedDomains:['fixture.example']});
  const positive=await f.shell(`curl --fail --silent --show-error --max-time 3 ${shellQuote(url)}`,allowed);
  assert.equal(positive.exitCode,0,positive.output); assert.match(positive.output,/owned-service/); assert.equal(requests,1);
  const proxy=await f.shell(`curl --fail --silent --max-time 3 ${shellQuote(url)}`); assert.notEqual(proxy.exitCode,0); assert.equal(requests,1);
  let directRequests=0;
  const directService=createServer((_req,res)=>{directRequests++;res.end('direct-control');});directService.listen(0,'127.0.0.1');await once(directService,'listening');
  t.after(()=>new Promise(resolve=>directService.close(resolve)));
  const directURL=`http://127.0.0.1:${directService.address().port}/proof`;
  const control=await fetch(directURL);assert.equal(await control.text(),'direct-control');assert.equal(directRequests,1);
  const direct=await f.shell(`curl --noproxy '*' --fail --silent --max-time 3 ${shellQuote(directURL)}`,allowed); assert.notEqual(direct.exitCode,0); assert.equal(directRequests,1);assert.equal(requests,1);
  recordObservation(t,'allow','one authorized proxy request reached owned Unix socket service');recordObservation(t,'deny','domain-denied and direct requests did not reach owned service');
});
test('[native-lifecycle] cancellation and seconds deadline terminate the final process group before return', async t => {
  const f=await setup(t), caller=new AbortController(), marker=join(f.workspace,'after-cancel.txt'); let observed=false;
  const pending=f.shell(`printf ready; (sleep 1; printf leaked > ${shellQuote(marker)}) & wait`,f.profile,EMPTY_DELTA,{signal:caller.signal,timeoutSeconds:5,onData:data=>{if(data.toString().includes('ready')){observed=true;caller.abort();}}});
  await assert.rejects(pending); assert.equal(observed,true); await new Promise(resolve=>setTimeout(resolve,1100)); await assert.rejects(access(marker));
  let isTimedProcessRunning=false;const timeoutSeconds=0.8,started=Date.now();
  await assert.rejects(f.shell('printf timer-ready; sleep 5',f.profile,EMPTY_DELTA,{timeoutSeconds,onData:data=>{if(data.toString().includes('timer-ready'))isTimedProcessRunning=true;}}),error=>error.code==='TIMEOUT');
  assert.equal(isTimedProcessRunning,true);assert.ok(Date.now()-started>=timeoutSeconds*1000-20);assert.ok(Date.now()-started<3500);
  const already=new AbortController(); already.abort(); await assert.rejects(f.shell('printf unreachable',f.profile,EMPTY_DELTA,{signal:already.signal}));
  recordObservation(t,'deny','caller cancellation and seconds deadline terminated running process groups; no delayed descendant mutation');
});
test('[native-isolation] a per-invocation elevation cannot widen concurrent or subsequent profiles', async t => {
  const f=await setup(t), target=join(f.outside,'sentinel.txt'), delta={readPaths:[],writePaths:[target],domains:[]};
  const [allowed,denied]=await Promise.allSettled([f.execute({kind:'file',operation:'write',path:target,content:'approved'},f.profile,delta),f.execute({kind:'file',operation:'write',path:target,content:'sibling'})]);
  assert.equal(allowed.status,'fulfilled'); assert.equal(denied.status,'rejected'); assert.equal(await readFile(target,'utf8'),'approved');
  await assert.rejects(f.execute({kind:'file',operation:'write',path:target,content:'later'})); assert.equal(await readFile(target,'utf8'),'approved');
  await assert.rejects(f.execute({kind:'file',operation:'write',path:join(f.control,'protected.txt'),content:'bad'},f.profile,{...delta,writePaths:[join(f.control,'protected.txt')]}),/protected path/);
  await assert.rejects(f.execute({kind:'file',operation:'unsupported',path:target})); assert.equal(await readFile(target,'utf8'),'approved');
  recordObservation(t,'allow','one exact elevated target changed');recordObservation(t,'deny','concurrent/subsequent siblings, hard-deny delta and invalid IPC left target unchanged');
});
