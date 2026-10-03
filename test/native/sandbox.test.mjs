import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, symlink, link, access, mkdir, rename, mkdtemp, realpath, rm, stat, chmod } from 'node:fs/promises';
import { constants as osConstants } from 'node:os';
import { createServer } from 'node:http';
import { createServer as createSocketServer } from 'node:net';
import { once } from 'node:events';
import { join } from 'node:path';
import { NativeExecutor } from '../../dist/sandbox/executor.js';
import { shellQuote, workloadEnvironment } from '../../dist/sandbox/config.js';
import { seccompRuntime } from '../../dist/sandbox/seccomp.js';
import { EMPTY_DELTA, createProfile, createAction } from '../../dist/contracts.js';
import { PolicyEngine, validateSettings } from '../../dist/policy/index.js';
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
  assert.ok(!Object.hasOwn(workloadEnvironment({PI_GUARD_KERNEL_ARCH:'invalid'},{}),'PI_GUARD_KERNEL_ARCH'));
  assert.equal((await f.shell('kill -USR2 $$')).exitCode,128+osConstants.signals.SIGUSR2);
  recordObservation(t,'allow','shell output/cwd/caller environment and nonzero status');
});
test('[native-network] native kernel helper enforces inherited Unix socket denial for the actual workload architecture',async t=>{
  const f=await setup(t),controlPath=join(f.workspace,'unix-control.sock'),deniedPath=join(f.workspace,'unix-denied.sock');
  const control=createSocketServer();control.listen(controlPath);await once(control,'listening');await new Promise(resolve=>control.close(resolve));
  const seccomp=seccompRuntime();
  if(seccomp){
    const binary=await readFile(seccomp.applyPath);
    assert.equal(binary.subarray(0,4).toString('hex'),'7f454c46');
    assert.equal(binary.readUInt16LE(18),seccomp.architecture==='arm64'?183:62);
  }
  const program=`const net=require('node:net'),fs=require('node:fs');if(process.platform==='linux'){const status=fs.readFileSync('/proc/self/status','utf8');console.log(status.split('\\n').find(line=>line.startsWith('Seccomp:')));}const server=net.createServer();server.on('error',error=>{console.log('unix-socket:'+error.code);process.exitCode=error.code==='EPERM'?0:7;});server.listen(${JSON.stringify(deniedPath)},()=>{server.close();process.exitCode=8;});`;
  const result=await f.shell(`${shellQuote(process.execPath)} -e ${shellQuote(program)}`,f.profile,EMPTY_DELTA,{env:{PI_GUARD_KERNEL_ARCH:'invalid'},timeoutSeconds:10});
  assert.equal(result.exitCode,0,result.output);assert.match(result.output,/unix-socket:EPERM/);
  if(process.platform==='linux')assert.match(result.output,/Seccomp:\s+2/);
  await assert.rejects(access(deniedPath));
  recordObservation(t,'allow','owned Unix socket control works outside the sandbox and the workload starts inside it');
  recordObservation(t,'deny',`Unix socket creation denied by native enforcement; workload=${process.arch}, helper=${seccomp?.architecture??'macos'}`);
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
test('[native-files] pre-existing hard-link aliases cannot read protected data or modify an outside inode',async t=>{
  const f=await setup(t),readAlias=join(f.workspace,'read-alias'),writeAlias=join(f.workspace,'write-alias'),target=join(f.outside,'sentinel.txt');
  await link(join(f.control,'protected.txt'),readAlias);
  await assert.rejects(f.shell('cat read-alias'),error=>error.code==='HARD_LINK_BOUNDARY');
  await rm(readAlias);
  await link(target,writeAlias);
  await assert.rejects(f.shell('printf escaped > write-alias',createProfile({...f.profile,readRoots:['/']})),error=>error.code==='HARD_LINK_BOUNDARY');
  assert.equal(await readFile(target,'utf8'),'unchanged');await rm(writeAlias);
  const owned=join(f.workspace,'owned'),ownedAlias=join(f.workspace,'owned-alias');
  await writeFile(owned,'before');await link(owned,ownedAlias);
  assert.equal((await f.shell('printf allowed > owned-alias; cat owned')).output,'allowed');
  await rm(ownedAlias);
  // Link creation inside the sandbox remains subject to the kernel's source-write boundary.
  const readable=createProfile({...f.profile,readRoots:['/']});
  await f.shell(`ln ${shellQuote(target)} runtime-alias; printf runtime-escape > runtime-alias`,readable);
  assert.equal(await readFile(target,'utf8'),'unchanged');
  recordObservation(t,'allow','pre-existing hard links wholly contained in admitted roots remain usable');
  recordObservation(t,'deny','pre-existing protected-read and outside-write aliases rejected before launch; runtime source link did not change outside inode');
});
test('[native-files] a narrow reviewed grant does not expose another name of a hard-linked inode',async t=>{
  const f=await setup(t),target=join(f.outside,'sentinel.txt'),sibling=join(f.outside,'hard-sibling');
  await link(target,sibling);
  const readable=createProfile({...f.profile,readRoots:['/']});
  await assert.rejects(f.shell(`printf escaped > ${shellQuote(target)}`,readable,{readPaths:[],writePaths:[target],domains:[]}),error=>error.code==='HARD_LINK_BOUNDARY');
  assert.equal(await readFile(sibling,'utf8'),'unchanged');
  const grant={readPaths:[],writePaths:[f.outside],domains:[]};
  assert.equal((await f.shell(`printf admitted > ${shellQuote(target)}`,readable,grant)).exitCode,0);
  assert.equal(await readFile(sibling,'utf8'),'admitted');
  recordObservation(t,'deny','an exact-file grant cannot mutate a sibling alias of the same inode');
  recordObservation(t,'allow','a reviewed directory containing every link permits the disclosed shared-inode effect');
});
test('[native-network] allowed proxy control reaches an owned service and denied proxy/direct traffic does not', async t => {
  const serviceFixture=await fixture(t); let requests=0;
  const socketPath=join(serviceFixture.control,'network.sock');
  const server=createServer((_req,res)=>{requests++;res.end('owned-service');}); server.listen(socketPath); await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const f=await setup(t,{socketPath,domains:['fixture.example']});
  const url='http://fixture.example/proof', allowed=createProfile({...f.profile,allowedDomains:['*.example']});
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
test('[native-files] backend convenience write paths cannot override a read-only profile or borrow a narrow grant',async t=>{
  const f=await setup(t);await mkdir('/tmp/claude',{recursive:true});
  const scratch=await realpath(await mkdtemp('/tmp/claude/pi-owned-native-'));t.after(()=>rm(scratch,{recursive:true,force:true}));
  const target=join(scratch,'sentinel.txt');await writeFile(target,'unchanged');
  const profile=createProfile({...f.profile,mode:'read-only',readRoots:['/'],writeRoots:[]});
  assert.notEqual((await f.shell(`printf escaped > ${shellQuote(target)}`,profile)).exitCode,0);
  assert.equal(await readFile(target,'utf8'),'unchanged');
  await assert.rejects(f.shell(`printf escaped > ${shellQuote(target)}`,profile,{readPaths:[],writePaths:[target],domains:[]}),/enclosing directory/);
  assert.equal(await readFile(target,'utf8'),'unchanged');
  const policy=new PolicyEngine(validateSettings({mode:'read-only'}),profile),command=`printf reviewed > ${shellQuote(target)}`;
  const action=createAction({toolCallId:'scratch-review',tool:'bash',args:{command},cwd:f.workspace,source:'model',sessionId:'fixture',policyRevision:policy.revision},profile);
  const assessment=await policy.evaluate(action);assert.equal(assessment.kind,'ask');assert.deepEqual(assessment.delta.writePaths,[await realpath('/tmp/claude')]);
  assert.equal((await f.shell(command,profile,assessment.delta)).exitCode,0);assert.equal(await readFile(target,'utf8'),'reviewed');
  assert.notEqual((await f.shell(command,profile)).exitCode,0);
  recordObservation(t,'allow','explicitly disclosed runtime directory grant reached the named owned target');
  recordObservation(t,'deny','runtime convenience directory did not override read-only or broaden an exact-file grant');
});
test('[native-files] reviewed metadata grant exposes only the named file and command authority keeps absolute denies',async t=>{
  const f=await setup(t),metadata=join(f.workspace,'.agents');await mkdir(metadata);
  const target=join(metadata,'allowed.txt'),sibling=join(metadata,'sibling.txt');await writeFile(target,'before');await writeFile(sibling,'unchanged');
  const profile=createProfile({...f.profile,readOnlyPaths:[metadata]});
  assert.equal((await f.shell(`cat ${shellQuote(target)}`,profile)).output,'before');
  assert.notEqual((await f.shell(`printf blocked > ${shellQuote(target)}`,profile)).exitCode,0);
  const granted=await f.shell(`cat ${shellQuote(sibling)}; printf approved > ${shellQuote(target)}; printf sibling > ${shellQuote(sibling)}`,profile,{readPaths:[],writePaths:[target],domains:[]});
  assert.match(granted.output,/unchanged/);assert.notEqual(granted.exitCode,0);assert.equal(await readFile(target,'utf8'),'approved');assert.equal(await readFile(sibling,'utf8'),'unchanged');
  const outside=join(f.outside,'sentinel.txt');
  const command=await f.shell(`printf command > ${shellQuote(outside)}; cat ${shellQuote(join(f.control,'protected.txt'))}`,profile,EMPTY_DELTA,{authority:{kind:'reviewed-command',actionDigest:'native-fixture'}});
  assert.equal(await readFile(outside,'utf8'),'command');assert.notEqual(command.exitCode,0);assert.ok(!command.output.includes(f.secret));
  assert.notEqual((await f.shell(`printf later > ${shellQuote(outside)}`,profile)).exitCode,0);
  recordObservation(t,'allow','exact metadata file and one reviewed command changed their owned targets');recordObservation(t,'deny','metadata sibling, later unapproved write and absolute protected credential read remained blocked');
});
test('[native-network] live broker approval is attributed and never shared with another invocation',async t=>{
  const service=await fixture(t);let reached=0;const socketPath=join(service.control,'approval.sock');
  const server=createServer((_req,res)=>{reached++;res.end('runtime-network');});server.listen(socketPath);await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const f=await setup(t,{socketPath,domains:['dynamic.example']}),requests=[];
  const command='host=dynamic.example; curl --fail --silent --max-time 5 \"http://$host/proof\"';
  const allowed=await f.shell(command,f.profile,EMPTY_DELTA,{onNetworkRequest:async(request,signal)=>{requests.push(request);assert.equal(signal.aborted,false);return true;}});
  assert.equal(allowed.exitCode,0,allowed.output);assert.match(allowed.output,/runtime-network/);assert.equal(reached,1);assert.equal(requests[0].host,'dynamic.example');assert.equal(requests[0].port,80);
  const denied=await f.shell(command,f.profile,EMPTY_DELTA,{onNetworkRequest:async()=>false});assert.notEqual(denied.exitCode,0);assert.equal(reached,1);
  const sibling=await f.shell(command);assert.notEqual(sibling.exitCode,0);assert.equal(reached,1);
  recordObservation(t,'allow','broker-authorized dynamic destination reached owned service');recordObservation(t,'deny','denied and subsequent invocation destinations did not reach service');
});
test('[native-lifecycle] cancellation and seconds deadline terminate the final process group before return', async t => {
  const f=await setup(t), caller=new AbortController(), marker=join(f.workspace,'after-cancel.txt'); let observed=false;
  const pending=f.shell(`printf ready; (sleep 1; printf leaked > ${shellQuote(marker)}) & wait`,f.profile,EMPTY_DELTA,{signal:caller.signal,timeoutSeconds:5,onData:data=>{if(data.toString().includes('ready')){observed=true;caller.abort();}}});
  await assert.rejects(pending); assert.equal(observed,true); await new Promise(resolve=>setTimeout(resolve,1100)); await assert.rejects(access(marker));
  // Emulated x64 startup takes over a second. Exercise a running workload,
  // retaining the 3.5-second completion bound and an observable denied effect.
  const timeoutMarker=join(f.workspace,'after-timeout.txt');
  let isTimedProcessRunning=false,timedProcessReadyAtMs=0;const timeoutSeconds=2,started=Date.now();
  await assert.rejects(f.shell(`printf timer-ready; sleep 3; printf leaked > ${shellQuote(timeoutMarker)}`,f.profile,EMPTY_DELTA,{timeoutSeconds,onData:data=>{if(data.toString().includes('timer-ready')){isTimedProcessRunning=true;timedProcessReadyAtMs=Date.now();}}}),error=>error.code==='TIMEOUT');
  assert.equal(isTimedProcessRunning,true);assert.ok(Date.now()-started>=timeoutSeconds*1000-20);assert.ok(Date.now()-started<3500);
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,timedProcessReadyAtMs+3100-Date.now())));await assert.rejects(access(timeoutMarker));
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

for (const operation of ['append', 'truncate', 'unlink', 'rename', 'copy', 'chmod', 'hard-link']) {
  test(`[native-files] mutation matrix: ${operation} succeeds inside the workspace and cannot change an outside inode`, async t => {
    const f = await setup(t), outside = join(f.outside, 'sentinel.txt');
    const allowed = join(f.workspace, 'allowed.txt');
    await writeFile(allowed, 'unchanged');
    await chmod(allowed, 0o600);
    await chmod(outside, 0o600);
    const profile = createProfile({ ...f.profile, readRoots: ['/'] });
    for (const [target, canMutate] of [[allowed, true], [outside, false]]) {
      const source = join(f.workspace, `source-${canMutate}.txt`), alias = join(f.workspace, `alias-${canMutate}.txt`);
      await writeFile(source, 'replacement');
      await chmod(source, 0o600);
      const operations = {
        append: 'fs.appendFileSync(target,"-appended")',
        truncate: 'fs.truncateSync(target,0)',
        unlink: 'fs.unlinkSync(target)',
        rename: 'fs.renameSync(source,target)',
        copy: 'fs.copyFileSync(source,target)',
        chmod: 'fs.chmodSync(target,0o400)',
        'hard-link': 'fs.linkSync(target,alias);fs.writeFileSync(alias,"linked change")',
      };
      const program = `const fs=require('fs'),target=${JSON.stringify(target)},source=${JSON.stringify(source)},alias=${JSON.stringify(alias)};try{${operations[operation]};console.log("mutation-applied");}catch(error){console.log("mutation-denied:"+error.code);process.exitCode=17;}`;
      const result = await f.shell(`${shellQuote(process.execPath)} -e ${shellQuote(program)}`, profile, EMPTY_DELTA, { timeoutSeconds: 10 });
      if (canMutate) {
        assert.equal(result.exitCode, 0, result.output);
        assert.match(result.output, /mutation-applied/);
        if (operation === 'unlink') await assert.rejects(access(target), { code: 'ENOENT' });
        else {
          const expected = { append: 'unchanged-appended', truncate: '', rename: 'replacement', copy: 'replacement', chmod: 'unchanged', 'hard-link': 'linked change' };
          assert.equal(await readFile(target, 'utf8'), expected[operation]);
          assert.equal((await stat(target)).mode & 0o777, operation === 'chmod' ? 0o400 : 0o600);
        }
      } else {
        assert.equal(result.exitCode, 17, result.output);
        assert.match(result.output, /mutation-denied:(EACCES|EPERM|EROFS|EXDEV)/);
        assert.equal(await readFile(target, 'utf8'), 'unchanged');
        assert.equal((await stat(target)).mode & 0o777, 0o600);
        assert.equal(await readFile(source, 'utf8'), 'replacement');
        await assert.rejects(access(alias), { code: 'ENOENT' });
      }
    }
    recordObservation(t, 'allow', `${operation} applied to the owned workspace control`);
    recordObservation(t, 'deny', `${operation} left outside content, existence and mode unchanged`);
  });
}

for (const row of [
  { id: 'wildcard-child', host: 'child.fixture.example', allowed: ['*.fixture.example'], denied: [], canReach: true },
  { id: 'wildcard-apex', host: 'fixture.example', allowed: ['*.fixture.example'], denied: [], canReach: false },
  { id: 'suffix-spoof', host: 'fixture.example.invalid', allowed: ['*.fixture.example'], denied: [], canReach: false },
  { id: 'explicit-deny-wins', host: 'blocked.fixture.example', allowed: ['*.fixture.example'], denied: ['blocked.fixture.example'], canReach: false },
]) {
  test(`[native-network] destination matrix: ${row.id} checks actual service reachability`, async t => {
    const service = await fixture(t), socketPath = join(service.control, 'matrix.sock');
    const hosts = [];
    const server = createServer((request, response) => { hosts.push(request.headers.host); response.end('matrix-service'); });
    server.listen(socketPath);
    await once(server, 'listening');
    t.after(() => new Promise(resolve => server.close(resolve)));
    const f = await setup(t, { socketPath, domains: ['control.fixture.example', row.host] });
    const profile = createProfile({ ...f.profile, allowedDomains: row.allowed, deniedDomains: row.denied });
    const control = await f.shell('curl --fail --silent --show-error --max-time 5 http://control.fixture.example/control', profile);
    assert.equal(control.exitCode, 0, control.output);
    assert.match(control.output, /matrix-service/);
    assert.equal(hosts.length, 1);
    const attempt = await f.shell(`curl --fail --silent --show-error --max-time 5 ${shellQuote(`http://${row.host}/attempt`)}`, profile);
    assert.equal(attempt.exitCode === 0, row.canReach, attempt.output);
    assert.equal(hosts.length, row.canReach ? 2 : 1);
    recordObservation(t, 'allow', 'wildcard child control reached the owned service');
    recordObservation(t, row.canReach ? 'allow' : 'deny', `${row.id}: expected destination effect observed`);
  });
}

test('[native-network] an allowed HTTP redirect cannot reach a denied destination', async t => {
  const service = await fixture(t), socketPath = join(service.control, 'redirect.sock'), hosts = [];
  const server = createServer((request, response) => {
    hosts.push(request.headers.host);
    if (request.url === '/control') response.end('redirect-control');
    else if (request.headers.host === 'allowed.fixture.example') {
      response.writeHead(302, { location: 'http://denied.fixture.example/target' });
      response.end();
    } else response.end('must not reach denied host');
  });
  server.listen(socketPath);
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const f = await setup(t, { socketPath, domains: ['allowed.fixture.example', 'denied.fixture.example'] });
  const profile = createProfile({ ...f.profile, allowedDomains: ['*.fixture.example'], deniedDomains: ['denied.fixture.example'] });
  assert.equal((await f.shell('curl --fail --silent --max-time 5 http://allowed.fixture.example/control', profile)).exitCode, 0);
  const redirected = await f.shell('curl --location --fail --silent --show-error --max-time 5 http://allowed.fixture.example/redirect', profile);
  assert.notEqual(redirected.exitCode, 0);
  assert.deepEqual(hosts, ['allowed.fixture.example', 'allowed.fixture.example']);
  recordObservation(t, 'allow', 'initial allowed HTTP request and redirect source reached the owned service');
  recordObservation(t, 'deny', 'redirect target on a denied host never reached the owned service');
});

test('[native-launch] credential and loader environment variables do not reach a child interpreter', async t => {
  const f = await setup(t);
  const forbidden = ['OLLAMA_API_KEY', 'AWS_ACCESS_KEY_ID', 'SSH_AUTH_SOCK', 'NODE_OPTIONS', 'BASH_ENV', 'LD_PRELOAD', 'DYLD_INSERT_LIBRARIES', 'HTTP_PROXY'];
  const program = `const {execFileSync}=require('child_process');const data=JSON.parse(execFileSync(process.execPath,['-e','console.log(JSON.stringify(process.env))'],{encoding:'utf8'}));console.log(JSON.stringify({visible:Object.keys(data).filter(key=>${JSON.stringify(forbidden)}.includes(key)),hasCallerCredential:JSON.stringify(data).includes(${JSON.stringify(f.secret)}),control:data.GUARD_CONTROL}));`;
  const env = Object.fromEntries(forbidden.map(key => [key, f.secret]));
  const result = await f.shell(`${shellQuote(process.execPath)} -e ${shellQuote(program)}`, f.profile, EMPTY_DELTA, { env: { ...env, GUARD_CONTROL: 'allowed-value' }, timeoutSeconds: 10 });
  assert.equal(result.exitCode, 0, result.output);
  assert.ok(!result.output.includes(f.secret));
  const observation = JSON.parse(result.output.trim());
  // The sandbox installs its own proxy; it must not preserve the caller value.
  assert.deepEqual(observation.visible.filter(key => key !== 'HTTP_PROXY'), []);
  assert.equal(observation.hasCallerCredential, false);
  assert.equal(observation.control, 'allowed-value');
  recordObservation(t, 'allow', 'ordinary explicit environment value reached the descendant interpreter');
  recordObservation(t, 'deny', 'synthetic credential and loader values were absent from descendant output');
});
