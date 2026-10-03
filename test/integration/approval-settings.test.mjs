import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { SessionManager, initTheme } from '@earendil-works/pi-coding-agent';
import { createGuardExtension } from '../../dist/index.js';
import { fixture } from '../harness/fixtures.mjs';

const main = {id:'main',name:'Main model',provider:'fixture',api:'test',maxTokens:2048};
const auxiliary = {...main,id:'auxiliary',name:'Auxiliary model'};
async function setup(t,options = {}) {
  const f = await fixture(t), commands = new Map(), tools = new Map(), requests = [], notifications = [];
  const extension = createGuardExtension({mcp:false,cwd:f.workspace,agentDir:f.agentDir,profile:f.profile,...options});
  const api = {registerCommand:(name,command)=>commands.set(name,command),registerTool:tool=>tools.set(tool.name,tool),on:()=>{}};
  await extension.factory(api);
  t.after(()=>extension.assertReady().close());
  const sessionManager = SessionManager.inMemory(f.workspace);
  const context = {
    cwd:f.workspace,sessionManager,model:main,mode:'rpc',hasUI:true,waitForIdle:async()=>{},
    modelRegistry:{
      getAvailable:()=>[main,auxiliary],
      find:(provider,id)=>[main,auxiliary].find(model=>model.provider===provider&&model.id===id),
      streamSimple:(selected,_request,options)=>{
        requests.push({selected,options});
        return {result:async()=>({stopReason:'stop',content:[{type:'text',text:'{"outcome":"allow","risk_level":"low","user_authorization":"high"}'}]})};
      },
    },
    ui:{select:async()=>undefined,notify:(...args)=>notifications.push(args),setStatus:()=>{}},
  };
  extension.assertReady().reset(sessionManager.getSessionId(),sessionManager);
  extension.assertReady().authorizeUser('Modify only the owned outside sentinel.');
  return {...f,commands,tools,requests,notifications,extension,api,context,settingsPath:join(f.agentDir,'guard/settings.json')};
}
test('[approval-settings] approve configures user or model review and the selected route reaches the original write tool',async t=>{
  const f = await setup(t), target = join(f.outside,'sentinel.txt');
  assert.deepEqual([...f.commands.keys()],['approve','approve-model']);
  f.context.ui.select = async(title,choices)=>title.startsWith('실행 승인 방식')?'Ask for approval':choices[0];
  await f.commands.get('approve').handler('',f.context);
  assert.equal(f.extension.assertReady().options.settings.approvalsReviewer,'user');
  assert.equal(JSON.parse(await readFile(f.settingsPath,'utf8')).approvalsReviewer,'user');
  assert.equal((await stat(f.settingsPath)).mode&0o777,0o600);
  await f.tools.get('write').execute('user-write',{path:target,content:'user-approved'},undefined,undefined,f.context);
  assert.equal(await readFile(target,'utf8'),'user-approved');assert.equal(f.requests.length,0);
  f.context.ui.select = async()=> 'Approve for me';
  await f.commands.get('approve').handler('',f.context);
  await f.tools.get('write').execute('model-write',{path:target,content:'model-approved'},undefined,undefined,f.context);
  assert.equal(await readFile(target,'utf8'),'model-approved');assert.equal(f.requests.length,1);
});
test('[approval-settings] the searchable picker selects only the auxiliary reviewer and follows the main model when cleared',async t=>{
  const f = await setup(t), target = join(f.outside,'sentinel.txt');
  initTheme('dark',false);
  f.context.mode = 'tui';
  f.context.ui.custom = factory => new Promise(resolve=>{
    const picker=factory(undefined,undefined,undefined,resolve);
    assert.ok(picker.render(90).join('\n').includes('Auxiliary model'));
    for(const character of 'Auxiliary')picker.handleInput(character);
    picker.handleInput('\r');
  });
  await f.commands.get('approve-model').handler('',f.context);
  assert.deepEqual(f.extension.assertReady().options.settings.reviewModel,{provider:'fixture',id:'auxiliary'});
  assert.equal(f.context.model,main);
  await f.tools.get('write').execute('auxiliary-write',{path:target,content:'auxiliary-reviewed'},undefined,undefined,f.context);
  assert.equal(f.requests.at(-1).selected,auxiliary);assert.equal(await readFile(target,'utf8'),'auxiliary-reviewed');
  f.context.mode='rpc';f.context.ui.select=async(_title,choices)=>choices[0];
  await f.commands.get('approve-model').handler('',f.context);
  assert.equal(f.extension.assertReady().options.settings.reviewModel,null);
  await f.tools.get('write').execute('current-write',{path:target,content:'main-reviewed'},undefined,undefined,f.context);
  assert.equal(f.requests.at(-1).selected,main);assert.equal(await readFile(target,'utf8'),'main-reviewed');
});
test('[approval-settings] Escape and unavailable UI preserve settings without saving or executing anything',async t=>{
  const f=await setup(t);
  await f.commands.get('approve').handler('',f.context);
  f.context.mode='tui';f.context.ui.custom=factory=>new Promise(resolve=>factory(undefined,undefined,undefined,resolve).handleInput('\x1b'));
  await f.commands.get('approve-model').handler('',f.context);
  await assert.rejects(access(f.settingsPath));assert.equal(f.requests.length,0);
  const withoutUI={...f.context,hasUI:false};
  await assert.rejects(f.commands.get('approve').handler('',withoutUI),error=>error.code==='APPROVAL_UI_UNAVAILABLE');
  await assert.rejects(f.commands.get('approve-model').handler('',withoutUI),error=>error.code==='APPROVAL_UI_UNAVAILABLE');
});
test('[approval-settings] reload restores both selections and the persisted model remains selected in the picker',async t=>{
  const f=await setup(t);
  f.context.ui.select=async(title,choices)=>title.startsWith('실행 승인 방식')?'Ask for approval':choices.at(-1);
  await f.commands.get('approve').handler('',f.context);
  await f.commands.get('approve-model').handler('',f.context);
  const before=await readFile(f.settingsPath,'utf8');
  await f.extension.factory(f.api);
  assert.equal(f.extension.assertReady().options.settings.approvalsReviewer,'user');
  assert.deepEqual(f.extension.assertReady().options.settings.reviewModel,{id:'auxiliary',provider:'fixture'});
  f.context.mode='tui';f.context.ui.custom=factory=>new Promise(resolve=>factory(undefined,undefined,undefined,resolve).handleInput('\r'));
  await f.commands.get('approve-model').handler('',f.context);
  assert.equal(await readFile(f.settingsPath,'utf8'),before);
});
test('[approval-settings] concurrent choices preserve each other and a failed save leaves the runtime unchanged',async t=>{
  const f=await setup(t);
  f.context.ui.select=async(title,choices)=>title.startsWith('실행 승인 방식')?'Ask for approval':choices.at(-1);
  await Promise.all([f.commands.get('approve').handler('',f.context),f.commands.get('approve-model').handler('',f.context)]);
  const saved=JSON.parse(await readFile(f.settingsPath,'utf8'));
  assert.equal(saved.approvalsReviewer,'user');assert.deepEqual(saved.reviewModel,{id:'auxiliary',provider:'fixture'});
  const broken=await setup(t);await mkdir(broken.settingsPath,{recursive:true});
  broken.context.ui.select=async()=> 'Ask for approval';
  await assert.rejects(broken.commands.get('approve').handler('',broken.context));
  assert.equal(broken.extension.assertReady().options.settings.approvalsReviewer,'auto_review');
});
test('[approval-settings] settings changes cancel a pending old-model approval before its late allow can write',async t=>{
  let started,finish;
  const waiting=new Promise(resolve=>started=resolve);
  const f=await setup(t,{provider:{complete:()=>{started();return new Promise(resolve=>finish=resolve);}}});
  const target=join(f.outside,'sentinel.txt');
  const pending=f.tools.get('write').execute('old-review',{path:target,content:'must not happen'},undefined,undefined,f.context);
  const rejected=assert.rejects(pending);
  await waiting;
  f.context.ui.select=async()=> 'Ask for approval';
  await f.commands.get('approve').handler('',f.context);
  finish('{"outcome":"allow"}');await rejected;
  assert.equal(await readFile(target,'utf8'),'unchanged');
});
