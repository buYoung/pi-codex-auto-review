import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runSuite, sourceDigest, contractDigest, runtimeVersions } from './run-tests.mjs';
import { suites } from './suites.mjs';
import { writeHandoffs } from './handoffs.mjs';
import { validatePlatformEvidence } from '../dist/reports.js';
import { createRun, writeImmutable, preserveLegacy, platformCandidates, requiredPlatforms, repository } from './evidence-store.mjs';

const legacyArchive = await preserveLegacy();
const source = await sourceDigest(), contract = await contractDigest(), versions = await runtimeVersions();
const currentRun = await createRun({ sourceDigest: source, contractDigest: contract, runtimeVersions: versions, legacyArchive, command: 'npm run verify:guard' });
const results = {};
let buildProof;
try {
  await promisify(execFile)('npm', ['run', 'build'], { cwd: repository, maxBuffer: 2_000_000 });
  buildProof = { command: 'npm run build', cwd: repository, status: 'pass', exitCode: 0, recordedAt: new Date().toISOString() };
} catch (error) {
  await writeImmutable(join(currentRun.directory, 'build.json'), { status: 'fail', exitCode: error.code, recordedAt: new Date().toISOString() });
  throw error;
}
await writeImmutable(join(currentRun.directory, 'build.json'), buildProof);
for (const name of Object.keys(suites)) {
  try { results[name] = await runSuite(name, currentRun); } catch (error) { console.error(`${name}: ${error.message}`); process.exitCode = 1; }
}
const isSourceStable = source === await sourceDigest() && contract === await contractDigest();
const isCurrentPassed = isSourceStable && Object.keys(results).length === Object.keys(suites).length && Object.values(results).every(result => result.status === 'pass');
const current = {
  schemaVersion: 2, runId: currentRun.runId, artifactPath: `${currentRun.artifactPath}/platform.json`,
  platform: currentRun.platform,
  status: isCurrentPassed ? 'pass' : Object.values(results).some(result => result.status === 'fail') || !isSourceStable ? 'fail' : Object.values(results).some(result => result.status === 'environment-blocked') ? 'environment-blocked' : 'fail',
  sourceDigest: source, contractDigest: contract, runtimeVersions: versions, results, recordedAt: new Date().toISOString(),
};
await writeImmutable(join(currentRun.directory, 'platform.json'), current);
const platformResults = [];
for (const platform of requiredPlatforms) {
  if (platform === current.platform) { platformResults.push(current); continue; }
  let qualified;
  for (const candidate of await platformCandidates(platform)) {
    try { validatePlatformEvidence(candidate, suites, { platform, sourceDigest: source, contractDigest: contract }); qualified = candidate; break; } catch {}
  }
  platformResults.push(qualified ?? { platform, status: 'environment-blocked', reason: `No complete executed ${platform} run matches this source and contract; run all suites on that platform and retain its run directory.` });
}
if (!requiredPlatforms.includes(current.platform)) platformResults.push(current);
const auditProof = { status: 'fail', artifact: `${currentRun.artifactPath}/owned-audits.jsonl`, recordCount: 0 };
try {
  const data = await readFile(join(currentRun.directory, 'owned-audits.jsonl'), 'utf8');
  auditProof.recordCount = data.trim() ? data.trim().split('\n').length : 0;
  if (!auditProof.recordCount || /SYNTHETIC_GUARD_SECRET_[a-z0-9-]+/i.test(data)) throw new Error('Audit population is empty or leaked a marker');
  auditProof.status = 'pass';
} catch (error) { auditProof.reason = error.message; }
await writeHandoffs(results, buildProof, currentRun);
const isComplete = platformResults.every(platform => platform.status === 'pass') && auditProof.status === 'pass';
const state = isComplete ? 'complete' : platformResults.some(platform => platform.status === 'fail') || auditProof.status === 'fail' ? 'failed' : 'environment-blocked';
const final = {
  schemaVersion: 2, runId: currentRun.runId, artifactPath: `${currentRun.artifactPath}/final.json`, state,
  sourceDigest: source, contractDigest: contract, runtimeVersions: versions, requiredPlatforms, platformResults,
  testFiles: Object.values(suites).flatMap(suite => suite.files), coveredBehavior: Object.values(results).flatMap(result => result.coveredBehavior),
  suiteCommands: Object.keys(suites).map(name => `npm run test:${name}`), results,
  blockedReasons: platformResults.filter(result => result.status === 'environment-blocked').map(result => result.reason ?? result.results?.native?.blockedReasons?.join('; ')),
  packageProof: results.e2e?.tests.filter(test => test.name.includes('[package]')),
  cleanup: { platform: current.platform, status: results.e2e?.tests.find(test => test.name.includes('[cleanup]'))?.status ?? 'not-run', auditProof },
  legacyArchive, recordedAt: new Date().toISOString(),
};
await writeImmutable(join(currentRun.directory, 'final.json'), final);
// Compatibility views are replaceable only after old bytes have been archived.
await writeFile(join(repository, 'docs/handoffs/pi-guard/06-verification.json'), `${JSON.stringify(final, null, 2)}\n`);
await writeFile(join(repository, '.reports/pi-guard/final.json'), `${JSON.stringify(final, null, 2)}\n`);
console.log(JSON.stringify({ state, artifactPath: final.artifactPath, currentPlatform: current.platform, currentStatus: current.status, auditProof, blockedReasons: final.blockedReasons }, null, 2));
if (!isComplete) process.exitCode = 1;
