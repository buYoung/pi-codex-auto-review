import test from 'node:test';
import assert from 'node:assert/strict';
import { createAction, createProfile, decision, canonicalJson, digest, validateWorkerFrame } from '../../dist/contracts.js';
import { validateEvidence } from '../../dist/reports.js';
import { fixture } from '../harness/fixtures.mjs';
import * as pi from '@earendil-works/pi-coding-agent';

test('[identity] canonical snapshots bind final input/cwd/source/session/policy/profile independently', async t => {
  const f = await fixture(t), args = { path: 'a', nested: { z: 1, a: 2 } };
  const a = f.action('read', args, { toolCallId: 'a' });
  assert.equal(a.digest, f.action('read', { nested: { a: 2, z: 1 }, path: 'a' }, { toolCallId: 'a' }).digest);
  args.nested.z = 7;
  assert.equal(a.args.nested.z, 1);
  assert.throws(() => { a.args.path = 'b'; }, TypeError);
  for (const changed of [{ tool: 'write' }, { args: { path: 'b' } }, { cwd: f.outside }, { source: 'nested' }, { sessionId: 'new' }, { policyRevision: 'new' }]) {
    assert.notEqual(a.digest, f.action(changed.tool ?? 'read', changed.args ?? a.args, { toolCallId: 'a', ...changed }).digest);
  }
  assert.throws(() => canonicalJson({ x: NaN }));
  assert.throws(() => canonicalJson({ x: undefined }));
  assert.throws(() => createAction({ ...a, args: [] }, f.profile));
});
test('[profiles] profiles are immutable and read-only cannot silently gain writes', async t => {
  const f = await fixture(t);
  assert.throws(() => f.profile.writeRoots.push(f.outside));
  assert.throws(() => createProfile({ ...f.profile, mode: 'read-only' }));
  assert.throws(() => createProfile({ ...f.profile, readRoots: ['relative'] }));
  assert.notEqual(digest(f.profile), digest(createProfile({ ...f.profile, mode: 'read-only', writeRoots: [] })));
  assert.throws(() => decision(f.action('read', {}), 'allow', 'bad', undefined, true));
});
test('[ipc] invalid protocol frames cannot be treated as worker success', () => {
  for (const frame of [{}, {schemaVersion:1,type:'workload-started',processGroupId:123}, { schemaVersion: 2, type: 'result', result: null }, { schemaVersion: 1, type: 'result' }, { schemaVersion: 1, type: 'data', data: 2 }, { schemaVersion: 1, type: 'update', result: {} }]) assert.throws(() => validateWorkerFrame(frame));
  assert.deepEqual(validateWorkerFrame({ schemaVersion: 1, type: 'result', result: null }).result, null);
});
test('[evidence] incomplete, stale, blocked, skipped, duplicate or simulated-native proof cannot pass', () => {
  const valid = { suite: 'native', status: 'pass', command: 'test', testFiles: ['a'], coveredBehavior: ['effect'], tests: [{ name: '[effect] allowed and denied', status: 'pass' }], platform: 'darwin-arm64', sourceDigest: 'source', contractDigest: 'contract', runtimeVersions: { node: '24' }, evidenceKind: 'native-os', blockedReasons: [], nativeControls:[{kind:'allow',effect:'permitted control',isObserved:true,platform:'darwin-arm64'},{kind:'deny',effect:'denied control',isObserved:true,platform:'darwin-arm64'}] };
  validateEvidence(valid, ['effect']);
  for (const changed of [{ tests: [] }, { testFiles: [] }, { coveredBehavior: [] }, { tests: [{ name: '[effect]', status: 'environment-blocked' }] }, { tests: [{ name: '[effect]', status: 'pass', isSkipped: true }] }, { tests: [valid.tests[0], valid.tests[0]] }, { blockedReasons: ['blocked'] }, { evidenceKind: 'unit-doubles' }]) assert.throws(() => validateEvidence({ ...valid, ...changed }, ['effect']));
  assert.throws(() => validateEvidence(valid, ['effect'], { contractDigest: 'changed', sourceDigest: 'source' }));
  assert.throws(() => validateEvidence({...valid,nativeControls:[]},['effect']),/observed permitted and denied/);
  validateEvidence({ ...valid, status: 'environment-blocked', tests: [{ name: '[effect]', status: 'environment-blocked' }], blockedReasons: ['Unavailable OS'] }, []);
});
test('[public-api] supported installed Pi exposes complete tool contracts and protected startup seams', () => {
  for (const name of ['createAgentSession', 'createAgentSessionRuntime', 'DefaultResourceLoader', 'SessionManager', 'SettingsManager', 'ModelRuntime', 'InteractiveMode', 'runPrintMode', 'runRpcMode', 'createBashToolDefinition', 'createReadToolDefinition', 'createEditToolDefinition', 'createWriteToolDefinition', 'createGrepToolDefinition', 'createFindToolDefinition', 'createLsToolDefinition']) assert.equal(typeof pi[name], 'function', name);
  const tool = pi.createBashToolDefinition(process.cwd());
  assert.equal(tool.name, 'bash');
  assert.ok(tool.outputSchema);
  assert.equal(typeof tool.execute, 'function');
});
