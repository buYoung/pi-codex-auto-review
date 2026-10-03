import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runSuite, sourceDigest, contractDigest, runtimeVersions } from './run-tests.mjs';
import { suites } from './suites.mjs';
import { writeHandoffs } from './handoffs.mjs';
import { validatePlatformEvidence } from '../dist/reports.js';
import { createRun, writeImmutable, preserveLegacy, platformCandidates, requiredPlatforms, repository } from './evidence-store.mjs';
import { reference, dockerCandidates, validateLiveEvidence, matrixResults } from './auto-review-evidence.mjs';

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
  let qualified, matching;
  for (const candidate of await platformCandidates(platform)) {
    if(!matching&&candidate.sourceDigest===source&&candidate.contractDigest===contract)matching=candidate;
    try { validatePlatformEvidence(candidate, suites, { platform, sourceDigest: source, contractDigest: contract }); qualified = candidate; break; } catch {}
  }
  platformResults.push(qualified ?? { ...matching, platform, status: matching?.status==='fail'?'fail':'environment-blocked', reason: matching?.blockedReasons?.join('; ') || `No complete executed ${platform} run matches this source and contract; run all suites on that platform and retain its run directory.` });
}
if (!requiredPlatforms.includes(current.platform)) platformResults.push(current);
const dockerRuns=await dockerCandidates(source,contract);
for(const platform of ['linux-arm64']){
  if(platformResults.some(result=>result.platform===platform))continue;
  for(const candidate of dockerRuns.filter(result=>result.platform===platform&&result.mode==='offline')){
    try{validatePlatformEvidence(candidate,suites,{platform,sourceDigest:source,contractDigest:contract});platformResults.push(candidate);break;}catch{}
  }
}
const liveRuns=[],liveRejections=[];
for(const candidate of dockerRuns.filter(result=>result.mode==='conformance'&&result.provenance==='executed')){
  const offline=dockerRuns.find(result=>result.mode==='offline'&&result.platform===candidate.platform&&result.imageDigest===candidate.imageDigest&&result.status==='pass');
  try{validateLiveEvidence(candidate,offline,{sourceDigest:source,contractDigest:contract,model:'glm-5.3'});liveRuns.push(candidate);}
  catch(error){liveRejections.push({artifactPath:candidate.artifactPath,platform:candidate.platform,status:candidate.status,reason:error.message,cases:candidate.live?.cases});}
}
const liveRun=liveRuns.find(result=>result.platform==='linux-x64');
const scenarioEvidence=matrixResults(platformResults);
const isMatrixComplete=scenarioEvidence.every(row=>requiredPlatforms.every(platform=>row.platforms.find(result=>result.platform===platform)?.proofs.every(proof=>proof.status==='pass')));
const auditProof = { status: 'fail', artifact: `${currentRun.artifactPath}/owned-audits.jsonl`, recordCount: 0 };
try {
  const data = await readFile(join(currentRun.directory, 'owned-audits.jsonl'), 'utf8');
  auditProof.recordCount = data.trim() ? data.trim().split('\n').length : 0;
  if (!auditProof.recordCount || /SYNTHETIC_GUARD_SECRET_[a-z0-9-]+/i.test(data)) throw new Error('Audit population is empty or leaked a marker');
  auditProof.status = 'pass';
} catch (error) { auditProof.reason = error.message; }
await writeHandoffs(results, buildProof, currentRun);
const requiredResults=platformResults.filter(result=>requiredPlatforms.includes(result.platform));
const isComplete = requiredResults.every(platform => platform.status === 'pass') && auditProof.status === 'pass' && isMatrixComplete && !!liveRun;
const state = isComplete ? 'complete' : requiredResults.some(platform => platform.status === 'fail') || auditProof.status === 'fail' || liveRejections.some(result=>result.platform==='linux-x64'&&result.status==='fail') ? 'failed' : 'environment-blocked';
const final = {
  schemaVersion: 2, runId: currentRun.runId, artifactPath: `${currentRun.artifactPath}/final.json`, state,
  sourceDigest: source, contractDigest: contract, runtimeVersions: versions, requiredPlatforms, platformResults,
  testFiles: Object.values(suites).flatMap(suite => suite.files), coveredBehavior: Object.values(results).flatMap(result => result.coveredBehavior),
  suiteCommands: Object.keys(suites).map(name => `npm run test:${name}`), results,
  reference, scenarioMatrix:scenarioEvidence, liveRun:liveRun?.artifactPath??null,
  liveQualification:{status:liveRun?'pass':'environment-blocked',requiredPlatform:'linux-x64',model:'glm-5.3',qualifiedObservations:liveRuns.map(result=>({platform:result.platform,artifactPath:result.artifactPath,imageDigest:result.imageDigest})),rejections:liveRejections},
  dockerRuns:dockerRuns.map(result=>({platform:result.platform??result.targetPlatform,mode:result.mode,status:result.status,artifactPath:result.artifactPath,imageDigest:result.imageDigest,blockedReasons:result.blockedReasons??[]})),
  blockedReasons: [...requiredResults.filter(result => result.status === 'environment-blocked').map(result => result.reason ?? result.results?.native?.blockedReasons?.join('; ')),...(!liveRun?['No same-source, same-image GLM5.3 live conformance run qualifies on required linux-x64; real model calls and all four effects are mandatory.']:[])],
  packageProof: results.e2e?.tests.filter(test => test.name.includes('[package]')),
  cleanup: { platform: current.platform, status: results.e2e?.tests.find(test => test.name.includes('[cleanup]'))?.status ?? 'not-run', auditProof },
  legacyArchive, recordedAt: new Date().toISOString(),
};
await writeImmutable(join(currentRun.directory, 'final.json'), final);
const conformance={...final,status:state,implementationStatus:'implemented',platformRuns:platformResults.map(result=>({platform:result.platform,status:result.status,artifactPath:result.artifactPath})),packagePins:{...versions,'pi-ollama-cloud':'0.12.2'},commands:{aggregate:'npm run verify:guard',focused:'npm run test:conformance',dockerOffline:'npm run verify:docker -- --mode offline --platform linux/amd64',dockerLive:'npm run verify:docker -- --mode conformance --platform linux/amd64 --model glm-5.3'},recoveryProvenance:'Docker harness reconstructed; original historical Docker run unverified; earlier reports preserved',limitations:['Pi execution/approval scope only; no MCP/app/Computer Use, Windows, enterprise service or proprietary-model equivalence.','Controller and native mandatory protections remain absolute; literal .rules subset does not execute general Starlark.','Guarded startup disables automatic context-file discovery; only actual runtime-supplied instruction sources are trusted.','Linux creation and runtime default scratch/log paths may require enclosing-directory authority, shown in the reviewed delta; exact-file creation confinement is not claimed. Unsupported partial SDK scopes fail closed.','Deterministic model doubles and real OS effects do not establish live GLM5.3 behavior.','The locked dependency audit reported three high-severity entries. No unverified downgrade or automatic audit fix was applied.'],unresolved:final.blockedReasons};
await writeImmutable(join(currentRun.directory,'auto-review-conformance.json'),conformance);
await writeFile(join(repository,'docs/handoffs/auto-review/07-conformance.json'),`${JSON.stringify({...conformance,artifactPath:`${currentRun.artifactPath}/auto-review-conformance.json`},null,2)}\n`);
// Compatibility views are replaceable only after old bytes have been archived.
await writeFile(join(repository, 'docs/handoffs/pi-guard/06-verification.json'), `${JSON.stringify(final, null, 2)}\n`);
await writeFile(join(repository, '.reports/pi-guard/final.json'), `${JSON.stringify(final, null, 2)}\n`);
console.log(JSON.stringify({ state, artifactPath: final.artifactPath, currentPlatform: current.platform, currentStatus: current.status, auditProof, blockedReasons: final.blockedReasons }, null, 2));
if (!isComplete) process.exitCode = 1;
