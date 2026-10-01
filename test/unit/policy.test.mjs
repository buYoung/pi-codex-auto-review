import test from 'node:test';
import assert from 'node:assert/strict';
import { symlink, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createAction, createProfile } from '../../dist/contracts.js';
import { PolicyEngine, validateSettings, loadSettings, canonicalPath, isWithin, analyzeShell, resolveToolPath } from '../../dist/policy/index.js';
import { fixture } from '../harness/fixtures.mjs';

async function setup(t, settings = {}, profileOverrides = {}) {
  const f = await fixture(t), profile = createProfile({ ...f.profile, ...profileOverrides });
  const policy = new PolicyEngine(validateSettings(settings), profile);
  const action = (tool, args, extra = {}) => createAction({ toolCallId: 'call', tool, args, source: 'model', cwd: f.workspace, sessionId: 'session', policyRevision: policy.revision, ...extra }, profile);
  return { ...f, profile, policy, action, evaluate: (tool,args) => policy.evaluate(action(tool,args)) };
}
test('[paths] path-prefix escapes, symlink ancestors and nonexistent targets are resolved', async t => {
  const f = await setup(t);
  await symlink(f.control, join(f.workspace, 'link'));
  await symlink(f.outside, join(f.workspace, 'outside-link'));
  assert.equal((await f.evaluate('read', { path: 'link/protected.txt' })).kind, 'deny');
  assert.equal((await f.evaluate('write', { path: 'outside-link/new.txt', content: 'x' })).kind, 'ask');
  assert.equal((await f.evaluate('write', { path: 'nested/new.txt', content: 'x' })).kind, 'allow');
  assert.equal((await f.evaluate('read', { path: `${f.workspace}-other/a` })).kind, 'ask');
  assert.equal(isWithin(`${f.workspace}-other`, f.workspace), false);
  assert.equal(await canonicalPath('outside-link/missing/target', f.workspace), join(f.outside, 'missing/target'));
  assert.equal((await f.evaluate('read', { path: '../control/protected.txt' })).isHardDeny, true);
  for(const path of [`@${f.control}/protected.txt`,`file://${f.control}/protected.txt`])assert.equal((await f.evaluate('read',{path})).isHardDeny,true);
  assert.equal(await resolveToolPath('~/control/protected.txt',f.workspace,false,f.root),join(f.control,'protected.txt'));
});
test('[rules] deny outranks allow for every compound segment and stale identities', async t => {
  const f = await setup(t, { commandRules: [{ prefix: ['git'], decision: 'allow' }, { prefix: ['git','push'], decision: 'deny' }] });
  assert.equal((await f.evaluate('bash', { command: 'git status && git push' })).kind, 'deny');
  assert.equal((await f.evaluate('bash', { command: 'git status | git push' })).kind, 'deny');
  assert.equal((await f.evaluate('bash', { command: 'git status; git push' })).kind, 'deny');
  assert.equal((await f.evaluate('bash', { command: 'gitx status' })).kind, 'ask');
  assert.equal((await f.policy.evaluate(f.action('read', { path: 'a' }, { policyRevision: 'stale' }))).kind, 'deny');
  assert.equal((await f.evaluate('unverified', { readOnlyHint: true })).kind, 'ask');
});
test('[shell] literal quotes are parsed but substitutions, interpreters, comments and expansions require review', async t => {
  const f = await setup(t, { commandRules: [{ prefix: ['node'], decision: 'allow' }, { prefix: ['echo'], decision: 'allow' }] });
  assert.deepEqual(analyzeShell("printf '%s' 'a b'").commands[0].argv, ['printf','%s','a b']);
  assert.equal((await f.evaluate('bash', { command: "printf '%s' 'a b'" })).kind, 'allow');
  for (const command of ['echo $(node dangerous.js)', 'echo `whoami`', 'echo $HOME', 'echo *.txt', 'node -e "process.exit(0)"', 'echo ok # comment', 'echo ok & node a', 'A=1 echo ok', 'cat <<EOF', "echo 'unclosed"]) assert.equal((await f.evaluate('bash',{command})).kind, 'ask', command);
  assert.equal((await f.evaluate('bash',{command:`echo x > '${f.control}/protected.txt'`})).kind, 'deny');
  const result = await f.evaluate('bash',{command:`echo x > '${f.outside}/sentinel.txt'`});
  assert.equal(result.kind, 'ask'); assert.deepEqual(result.delta.writePaths, [join(f.outside, 'sentinel.txt')]);
  const externalRead=await f.evaluate('bash',{command:`cat '${f.outside}/sentinel.txt'`});assert.equal(externalRead.kind,'ask');assert.deepEqual(externalRead.delta.readPaths,[join(f.outside,'sentinel.txt')]);
});
test('[settings] corrupt or weakening settings fail closed and read-only file writes require permission', async t => {
  const f = await setup(t, { mode: 'read-only' }, { mode: 'read-only', writeRoots: [] });
  assert.equal((await f.evaluate('read',{path:'a'})).kind, 'allow');
  assert.equal((await f.evaluate('write',{path:'a',content:'x'})).kind, 'ask');
  for (const settings of [null, [], { allowAll:true }, { mode:'full' }, { reviewTimeoutMs:0 }, { commandRules:[{prefix:[], decision:'allow'}] }, { allowedDomains:['*'] }]) assert.throws(() => validateSettings(settings));
  const path = join(f.control, 'policy.json'); await writeFile(path,'{bad');
  await assert.rejects(loadSettings(path), /could not be loaded/);
});
