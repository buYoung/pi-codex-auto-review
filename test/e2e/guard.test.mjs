import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir, symlink, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NativeExecutor } from '../../dist/sandbox/executor.js';
import { EMPTY_DELTA } from '../../dist/contracts.js';
import { workloadEnvironment, shellQuote } from '../../dist/sandbox/config.js';
import { fixture, auditPopulationPath } from '../harness/fixtures.mjs';
import { guardedFixture, planStream } from '../harness/pi.mjs';

const exec=promisify(execFile), repository=fileURLToPath(new URL('../../',import.meta.url));
test('[workflow] model work succeeds while adversarial interpreter and protected file effects remain denied', async t => {
  const f=await fixture(t), runtime=await guardedFixture(t,f), target=join(f.outside,'sentinel.txt'), events=[];runtime.session.subscribe(e=>events.push(e));
  await planStream(runtime.session,[[{name:'write',args:{path:'allowed.txt',content:'allowed'}}],[{name:'bash',args:{command:`${shellQuote(process.execPath)} -e ${shellQuote(`require('fs').writeFileSync(${JSON.stringify(target)},'escaped')`)}`}}],[{name:'read',args:{path:join(f.control,'protected.txt')}}]]);
  await runtime.session.prompt('Perform owned fixture work.');
  assert.equal(await readFile(join(f.workspace,'allowed.txt'),'utf8'),'allowed');assert.equal(await readFile(target,'utf8'),'unchanged');assert.equal(await readFile(join(f.control,'protected.txt'),'utf8'),f.secret);
  const results=events.filter(e=>e.type==='tool_execution_end');assert.equal(results.length,3);assert.equal(results[0].isError,false);assert.equal(results[1].isError,true);assert.equal(results[2].isError,true);
  assert.ok(results.every(e=>!JSON.stringify(e.result).includes(f.secret)));
});
test('[workflow] one-use UI approval covers edit helpers and cannot authorize another logical call', async t => {
  const f=await fixture(t), target=join(f.outside,'sentinel.txt'), runtime=await guardedFixture(t,f,{provider:{complete:async()=>'{"decision":"ask","reason":"confirm"}'}});let prompts=0;
  await runtime.session.bindExtensions({mode:'rpc',uiContext:{select:async(_title,choices)=>{prompts++;return prompts===1?choices[0]:choices.at(-1);},notify:()=>{},setStatus:()=>{},setWidget:()=>{}}});
  await planStream(runtime.session,[[{name:'edit',args:{path:target,edits:[{oldText:'unchanged',newText:'approved'}]}}],[{name:'write',args:{path:target,content:'second'}}]]);
  await runtime.session.prompt('Approve only the first action.');assert.equal(prompts,2);assert.equal(await readFile(target,'utf8'),'approved');
});
test('[workflow] protected SDK direct shell and failed reload cannot activate a host fallback', async t => {
  const f=await fixture(t), native=new NativeExecutor();let qualification=0;
  const executor={qualify:async(...args)=>{if(++qualification>1)throw new Error('backend lost on reload');return native.qualify(...args);},execute:native.execute.bind(native),close:native.close.bind(native)};
  const runtime=await guardedFixture(t,f,{executor});
  assert.equal((await runtime.session.executeBash('printf protected-sdk')).output,'protected-sdk');
  let unsafe=false;await assert.rejects(runtime.session.executeBash('printf unsafe',undefined,{operations:{exec:async()=>{unsafe=true;return{exitCode:0};}}}),/guarded shell/);assert.equal(unsafe,false);
  await assert.rejects(runtime.session.reload(),/failed to load|not ready/);
  await assert.rejects(runtime.session.executeBash(`echo escape > '${join(f.workspace,'reload.txt')}'`),/failed to load|not ready/);
  await assert.rejects(runtime.session.prompt('After failed reload.'),/failed to load|not ready/);
  await assert.rejects(access(join(f.workspace,'reload.txt')));
});
test('[package] npm tarball loads the default factory through public Pi APIs and executes bundled worker assets', async t => {
  const f=await fixture(t), artifacts=join(f.root,'artifacts'), consumer=join(f.root,'consumer'), home=join(f.control,'fake-home');
  await Promise.all([artifacts,consumer,home].map(path=>mkdir(path,{recursive:true})));
  const env={...workloadEnvironment(),...(process.env.PI_GUARD_KERNEL_ARCH?{PI_GUARD_KERNEL_ARCH:process.env.PI_GUARD_KERNEL_ARCH}:{}),PI_CODING_AGENT_DIR:f.agentDir,NPM_CONFIG_CACHE:join(f.control,'npm-cache'),NPM_CONFIG_USERCONFIG:join(f.control,'empty.npmrc'),NPM_CONFIG_GLOBALCONFIG:join(f.control,'global.npmrc')};
  const packed=JSON.parse((await exec('npm',['pack','--ignore-scripts','--json','--pack-destination',artifacts],{cwd:repository,env,timeout:20000,maxBuffer:2_000_000})).stdout)[0];
  assert.ok(packed.files.some(file=>file.path==='dist/sandbox/worker.js'));assert.ok(packed.files.some(file=>file.path==='dist/sandbox/broker.js'));
  assert.ok(!packed.files.some(file=>/^(src|test|tmp|node_modules)\//.test(file.path)));
  await exec('tar',['-xzf',join(artifacts,packed.filename),'-C',consumer],{timeout:10000});
  await symlink(join(repository,'node_modules'),join(consumer,'package/node_modules'));
  const script=join(consumer,'package/probe.mjs');
  await writeFile(script,`
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DefaultResourceLoader,SettingsManager,SessionManager} from '@earendil-works/pi-coding-agent';
const cwd=process.cwd(),agentDir=process.env.GUARD_AGENT_DIR;
const loader=new DefaultResourceLoader({cwd,agentDir,settingsManager:SettingsManager.inMemory(),additionalExtensionPaths:[${JSON.stringify(join(consumer,'package/dist/index.js'))}],noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true});
await loader.reload();const loaded=loader.getExtensions();assert.equal(loaded.errors.length,0,JSON.stringify(loaded.errors));
const extension=loaded.extensions.find(item=>item.tools.has('write'));assert.ok(extension);
const context={cwd,sessionManager:SessionManager.inMemory(cwd),hasUI:false,mode:'print'};
for(const handler of extension.handlers.get('session_start')??[])await handler({type:'session_start',reason:'startup'},context);
const result=await extension.tools.get('write').definition.execute('packed-call',{path:'packed.txt',content:'packed-effect'},undefined,undefined,context);
assert.ok(result.content);assert.equal(await readFile('packed.txt','utf8'),'packed-effect');
for(const handler of extension.handlers.get('session_shutdown')??[])await handler({type:'session_shutdown'},context);
console.log(JSON.stringify({factoryLoaded:true,workerEffect:true,hostVersion:'0.99.1'}));
`);
  const executed=await exec(process.execPath,[script],{cwd:f.workspace,env:{...env,GUARD_AGENT_DIR:f.agentDir},timeout:20000,maxBuffer:2000000});
  assert.match(executed.stdout,/"factoryLoaded":true/);assert.equal(await readFile(join(f.workspace,'packed.txt'),'utf8'),'packed-effect');
  const help=await exec(process.execPath,[join(consumer,'package/dist/cli.js'),'--help'],{cwd:f.workspace,env,timeout:10000});assert.match(help.stdout,/사용법/);
});
test('[cleanup] nonempty owned audit population is scanned and native resources settle before disposal', async t => {
  const population=await readFile(auditPopulationPath,'utf8');
  assert.ok(population.trim().split('\n').length>0);assert.ok(!/SYNTHETIC_GUARD_SECRET_[a-z0-9-]+/i.test(population));
  const f=await fixture(t), executor=new NativeExecutor();await executor.qualify(f.profile,f.workspace);
  await executor.execute({kind:'file',operation:'write',path:join(f.workspace,'cleanup.txt'),content:'done',cwd:f.workspace},f.profile,EMPTY_DELTA);
  await executor.close();await assert.rejects(executor.execute({kind:'shell',command:'printf no',cwd:f.workspace},f.profile,EMPTY_DELTA));
  assert.equal(executor.activeInvocationCount,0);
  assert.equal(await readFile(join(f.workspace,'cleanup.txt'),'utf8'),'done');
});
