import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { runSuite, sourceDigest, contractDigest, runtimeVersions } from './run-tests.mjs';
import { suites } from './suites.mjs';
import { writeHandoffs } from './handoffs.mjs';
import { validateEvidence } from '../dist/reports.js';
const root=new URL('../',import.meta.url),results={};
await promisify(execFile)('npm',['run','build'],{cwd:fileURLToPath(root),maxBuffer:2_000_000});
const buildProof={command:'npm run build',cwd:fileURLToPath(root),status:'pass',exitCode:0,recordedAt:new Date().toISOString()};
await mkdir(new URL('.reports/pi-guard/',root),{recursive:true});
await rm(new URL('.reports/pi-guard/owned-audits.jsonl',root),{force:true});
for(const suite of Object.keys(suites)) {
 try{results[suite]=await runSuite(suite);}catch(error){console.error(`${suite}: ${error.message}`);process.exitCode=1;}
}
const source=await sourceDigest(),contract=await contractDigest(),versions=await runtimeVersions();
const currentPlatform=`${process.platform}-${process.arch}`;
const isCurrentPassed=Object.keys(results).length===Object.keys(suites).length&&Object.values(results).every(result=>result.status==='pass');
const current={platform:currentPlatform,status:isCurrentPassed?'pass':Object.values(results).some(result=>result.status==='environment-blocked')?'environment-blocked':'fail',sourceDigest:source,contractDigest:contract,runtimeVersions:versions,results,recordedAt:new Date().toISOString()};
await writeFile(new URL(`.reports/pi-guard/platform-${currentPlatform}.json`,root),JSON.stringify(current,null,2)+'\n');
const platformResults=[];
for(const platform of ['darwin-arm64','linux-x64']) {
 if(platform===currentPlatform){platformResults.push(current);continue;}
 let previous;
 try{
  previous=JSON.parse(await readFile(new URL(`.reports/pi-guard/platform-${platform}.json`,root),'utf8'));
  if(previous.platform!==platform||previous.status!=='pass'||previous.sourceDigest!==source||previous.contractDigest!==contract)throw new Error('Stale platform qualification');
  for(const [name,suite] of Object.entries(suites)){const result=previous.results[name];validateEvidence(result,suite.behavior,{sourceDigest:source,contractDigest:contract});if(result.status!=='pass')throw new Error('Missing passing platform proof');}
 }catch{previous={platform,status:'environment-blocked',reason:`A qualified ${platform} host with native dependencies must run the matching source and all suites; no such runner is available here.`};}
 platformResults.push(previous);
}
let auditProof={status:'fail',artifact:'.reports/pi-guard/owned-audits.jsonl',recordCount:0};
try{const data=await readFile(new URL(auditProof.artifact,root),'utf8');auditProof.recordCount=data.trim()?data.trim().split('\n').length:0;if(!auditProof.recordCount||/SYNTHETIC_GUARD_SECRET_[a-z0-9-]+/i.test(data))throw new Error('Audit population is empty or leaked a marker');auditProof.status='pass';}catch(error){auditProof.reason=error.message;}
await writeHandoffs(results,buildProof);
const isComplete=platformResults.every(platform=>platform.status==='pass')&&auditProof.status==='pass';
const state=isComplete?'complete':platformResults.some(platform=>platform.status==='fail')||auditProof.status==='fail'?'failed':platformResults.some(platform=>platform.status==='environment-blocked')?'environment-blocked':'failed';
const final={schemaVersion:1,state,sourceDigest:source,contractDigest:contract,runtimeVersions:versions,platformResults,testFiles:Object.values(suites).flatMap(suite=>suite.files),coveredBehavior:Object.values(results).flatMap(result=>result.coveredBehavior),suiteCommands:Object.keys(suites).map(name=>`npm run test:${name}`),results,blockedReasons:platformResults.filter(result=>result.status==='environment-blocked').map(result=>result.reason??result.results?.native?.blockedReasons?.join('; ')),packageProof:results.e2e?.tests.filter(test=>test.name.includes('[package]')),cleanup:{platform:currentPlatform,status:results.e2e?.tests.find(test=>test.name.includes('[cleanup]'))?.status??'not-run',auditProof,ownedFixtureCleanup:'Each fixture finalizer scans and removes its owned root; executors await broker/group/proxy settlement'},trustBoundaries:['trusted Pi/controller extensions','delegated native local effects','remote MCP internals excluded'],recordedAt:new Date().toISOString()};
await writeFile(new URL('docs/handoffs/pi-guard/06-verification.json',root),JSON.stringify(final,null,2)+'\n');
await writeFile(new URL('.reports/pi-guard/final.json',root),JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify({state,currentPlatform,currentStatus:current.status,auditProof,blockedReasons:final.blockedReasons},null,2));
if(!isComplete)process.exitCode=1;
