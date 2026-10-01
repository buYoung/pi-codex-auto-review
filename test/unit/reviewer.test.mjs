import test from 'node:test';
import assert from 'node:assert/strict';
import { decision } from '../../dist/contracts.js';
import { PiReviewProvider, reviewAction } from '../../dist/reviewer.js';
import { fixture, ControlledClock } from '../harness/fixtures.mjs';

const askProvider = { complete: async () => JSON.stringify({decision:'ask',reason:'confirm'}) };
test('[review] only ambiguous actions call a separate tool-free current-model request', async t => {
  const f = await fixture(t), action = f.action('bash',{command:'npm test'});
  const model = { id:'fake', provider:'fixture', api:'test' }, calls = [];
  const provider = new PiReviewProvider({ model, modelRegistry: { streamSimple(selected,context,options) { calls.push({selected,context,options}); return {result:async () => ({stopReason:'stop',content:[{type:'text',text:'{"decision":"allow","reason":"authorized"}'}]})}; } } });
  const invoke = policyDecision => reviewAction({action,policyDecision,provider,trustedAuthorization:'Run project tests',hasUI:false,timeoutMs:183});
  assert.equal((await invoke(decision(action,'allow','literal'))).decision,'allow');
  assert.equal((await invoke(decision(action,'deny','protected',undefined,true))).decision,'deny');
  assert.equal(calls.length,0);
  assert.equal((await invoke(decision(action,'ask','review'))).decision,'allow');
  assert.equal(calls.length,1); assert.equal(calls[0].selected,model); assert.deepEqual(calls[0].context.tools,[]);
  assert.equal(calls[0].context.messages.length,1); assert.equal(calls[0].options.timeoutMs,183);
  assert.match(calls[0].context.messages[0].content,/Run project tests/);
  assert.equal(JSON.parse(calls[0].context.messages[0].content).untrustedAction.digest,action.digest);
});
test('[review] malformed, failed, tool-bearing or permission-widening model replies never authorize', async t => {
  const f = await fixture(t), action = f.action('write',{path:'outside',content:'x'}), policyDecision = decision(action,'ask','outside',{readPaths:[],writePaths:[f.outside],domains:[]});
  for (const output of ['yes', '{}','{"decision":"allow","reason":"x","scope":"persistent"}','{"decision":"allow","reason":4}', '{"decision":"allow","reason":"ok"}']) {
    assert.equal((await reviewAction({action,policyDecision,provider:{complete:async()=>output},trustedAuthorization:'',hasUI:false,timeoutMs:100})).decision,'deny');
  }
  assert.equal((await reviewAction({action,policyDecision,provider:{complete:async()=>{throw new Error('fail');}},trustedAuthorization:'',hasUI:true,timeoutMs:100})).decision,'ask');
  const provider = new PiReviewProvider({model:{},modelRegistry:{streamSimple:()=>({result:async()=>({stopReason:'toolUse',content:[{type:'toolCall',name:'write'}]})})}});
  await assert.rejects(provider.complete({systemPrompt:'',data:''},{signal:new AbortController().signal,timeoutMs:100}));
});
test('[deadlines] configured milliseconds reach the final provider signal and expire at the boundary', async t => {
  const f = await fixture(t), action = f.action('bash',{command:'npm test'}), clock = new ControlledClock();
  let finalOptions;
  const promise = reviewAction({action,policyDecision:decision(action,'ask','review'),provider:{complete:(_request,options)=>{finalOptions=options;return new Promise(()=>{});}},trustedAuthorization:'',hasUI:false,timeoutMs:239,clock});
  assert.equal(finalOptions.timeoutMs,239); clock.advance(238); assert.equal(finalOptions.signal.aborted,false);
  clock.advance(1); assert.equal(finalOptions.signal.aborted,true); assert.equal((await promise).decision,'deny');
});
test('[cancellation] caller cancellation reaches the final provider even when it ignores the signal', async t => {
  const f = await fixture(t), action = f.action('bash',{command:'npm test'}), caller = new AbortController();
  let finalSignal;
  const promise = reviewAction({action,policyDecision:decision(action,'ask','review'),provider:{complete:(_request,options)=>{finalSignal=options.signal;return new Promise(()=>{});}},trustedAuthorization:'',hasUI:true,signal:caller.signal,timeoutMs:10000});
  caller.abort(new Error('cancel')); assert.equal(finalSignal.aborted,true); assert.equal((await promise).decision,'deny');
});
