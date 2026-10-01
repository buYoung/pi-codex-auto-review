import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ApprovalManager, FileGrantPersistence } from '../../dist/approvals.js';
import { AuditLog, redact } from '../../dist/audit.js';
import { decision } from '../../dist/contracts.js';
import { fixture, ControlledClock } from '../harness/fixtures.mjs';

const provider = {complete:async()=>'{"decision":"ask","reason":"confirm"}'};
const context = choice => ({provider,trustedAuthorization:'',ui:{select:async()=>choice}});
function manager(options={}) {return new ApprovalManager({reviewTimeoutMs:500,approvalTimeoutMs:500,audit:new AuditLog(),...options});}
test('[grants] one-use is consumed once while session rules bind exact inputs/profile/revision/source', async t => {
  const f = await fixture(t), m = manager(), action = f.action('bash',{command:'npm test'});
  const first = await m.admit(action,decision(action,'ask','review'),context('once'));
  assert.equal(first.isAllowed,true); assert.equal(first.grant.scope,'once');
  const next = f.action('bash',action.args);
  assert.equal((await m.admit(next,decision(next,'ask','review'),context('deny'))).isAllowed,false);
  assert.equal((await m.admit(action,decision(action,'ask','review'),context('session'))).isAllowed,true);
  assert.equal((await m.admit(next,decision(next,'ask','review'),context('deny'))).isAllowed,true);
  for (const extra of [{source:'nested'},{policyRevision:'changed'},{cwd:f.outside},{args:{command:'npm install'}}]) {
    const changed=f.action('bash',extra.args??action.args,extra);
    assert.equal((await m.admit(changed,decision(changed,'ask','review'),context('deny'))).isAllowed,false);
  }
  assert.equal((await m.admit(next,decision(next,'deny','hard',undefined,true),context('once'))).isAllowed,false);
  m.reset('new-session'); assert.equal((await m.admit(next,decision(next,'ask','review'),context('once'))).isAllowed,false);
});
test('[queue] concurrent UI requests serialize and queued cancellation/session replacement cannot cross-authorize', async t => {
  const f = await fixture(t), m=manager(), actions=[f.action('bash',{command:'a'}),f.action('bash',{command:'b'})], active=[], responses=[];
  const ui={select:(action,{},{signal})=>new Promise((resolve,reject)=>{active.push(action.toolCallId);responses.push(resolve);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});})};
  const one=m.admit(actions[0],decision(actions[0],'ask','review'),{provider,ui,trustedAuthorization:''});
  const caller=new AbortController();
  const two=m.admit(actions[1],decision(actions[1],'ask','review'),{provider,ui,trustedAuthorization:'',signal:caller.signal});
  await new Promise(resolve=>setImmediate(resolve)); assert.deepEqual(active,[actions[0].toolCallId]);
  caller.abort(); responses[0]('once'); assert.equal((await one).isAllowed,true); assert.equal((await two).isAllowed,false); assert.equal(active.length,1);
  const three=m.admit(actions[0],decision(actions[0],'ask','review'),{provider,ui,trustedAuthorization:''});
  await new Promise(resolve=>setImmediate(resolve)); m.reset('replacement'); assert.equal((await three).isAllowed,false);
  await m.settle();
});
test('[queue] approval deadline preserves milliseconds at the actual dialog and denies on expiry', async t => {
  const f=await fixture(t), clock=new ControlledClock(), m=manager({clock,approvalTimeoutMs:317}), action=f.action('bash',{command:'a'});
  let finalOptions;
  const pending=m.admit(action,decision(action,'ask','review'),{provider,ui:{select:(_action,_delta,options)=>{finalOptions=options;return new Promise(()=>{});}},trustedAuthorization:''});
  await new Promise(resolve=>setImmediate(resolve)); assert.equal(finalOptions.timeoutMs,317); clock.advance(316); assert.equal(finalOptions.signal.aborted,false); clock.advance(1); assert.equal((await pending).isAllowed,false); assert.equal(finalOptions.signal.aborted,true);
});
test('[persistence] persistent rules require explicit UI selection, atomic save and successful compensation', async t => {
  const f=await fixture(t), path=join(f.control,'grants.json'), persistence=new FileGrantPersistence(path), m=manager({persistence}), action=f.action('bash',{command:'a'});
  await m.initialize(); assert.equal((await m.admit(action,decision(action,'ask','review'),{provider,trustedAuthorization:''})).isAllowed,false);
  assert.equal((await m.admit(action,decision(action,'ask','review'),context('persistent'))).isAllowed,true);
  const saved=await persistence.load(); assert.equal(saved.length,1); assert.equal(saved[0].scope,'persistent');
  assert.equal((await readdir(f.control)).filter(x=>x.endsWith('.tmp')).length,0);
  const restored=manager({persistence}); await restored.initialize(); restored.reset(action.sessionId);
  assert.equal((await restored.admit(f.action('bash',action.args),decision(f.action('bash',action.args),'deny','stale'),context('deny'))).isAllowed,false);
  const call=f.action('bash',action.args); assert.equal((await restored.admit(call,decision(call,'ask','review'),context('deny'))).isAllowed,true);
  const caller=new AbortController(), snapshots=[];
  const failed=manager({persistence:{load:async()=>[],save:async grants=>{snapshots.push(grants);if(grants.length)caller.abort();}}});
  assert.equal((await failed.admit(action,decision(action,'ask','review'),{...context('persistent'),signal:caller.signal})).isAllowed,false);
  assert.equal(snapshots[0].length,1); assert.equal(snapshots[1].length,0);
  const broken=manager({persistence:{load:async()=>[],save:async()=>{throw new Error('disk full');}}});
  assert.equal((await broken.admit(action,decision(action,'ask','review'),context('persistent'))).isAllowed,false);
});
test('[audit] nonempty success/denial/failure population omits content and redacts synthetic markers', async t => {
  const f=await fixture(t), path=join(f.control,'audit.jsonl'), audit=new AuditLog(path,[f.secret]), action=f.action('write',{path:'a',content:f.secret});
  for (const outcome of ['allowed','denied','failed']) await audit.record(action,'execution',`${outcome} ${f.secret}`);
  await audit.flush(); const content=await readFile(path,'utf8'); assert.equal(content.trim().split('\n').length,3); assert.ok(!content.includes(f.secret)); assert.ok(!content.includes('"args"'));
  assert.equal(redact('token=private password=secret Bearer abcdef SYNTHETIC_SECRET_MARKER'),'token=[REDACTED] password=[REDACTED] Bearer [REDACTED] [REDACTED]');
});
