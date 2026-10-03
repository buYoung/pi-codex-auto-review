import assert from 'node:assert/strict';
import { machine, release } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRun, writeImmutable } from './evidence-store.mjs';
import { sourceDigest, contractDigest, runtimeVersions, runSuite } from './run-tests.mjs';
import { suites } from './suites.mjs';
import { validatePlatformEvidence } from '../dist/reports.js';

const source=await sourceDigest(),contract=await contractDigest(),versions=await runtimeVersions();
const run=await createRun({sourceDigest:source,contractDigest:contract,runtimeVersions:versions,command:'npm run verify:platform'});
const results={};
for(const name of Object.keys(suites))results[name]=await runSuite(name,run);
const isStable=source===await sourceDigest()&&contract===await contractDigest();
const record={schemaVersion:2,runId:run.runId,artifactPath:`${run.artifactPath}/platform.json`,platform:run.platform,status:isStable&&Object.values(results).every(result=>result.status==='pass')?'pass':'fail',sourceDigest:source,contractDigest:contract,runtimeVersions:versions,results,host:{platform:process.platform,arch:process.arch,machine:machine(),release:release(),runnerOS:process.env.RUNNER_OS??null,runnerArch:process.env.RUNNER_ARCH??null},recordedAt:new Date().toISOString()};
await writeImmutable(join(run.directory,'platform.json'),record);
validatePlatformEvidence(record,suites,{platform:run.platform,sourceDigest:source,contractDigest:contract});
if(process.env.GITHUB_ACTIONS==='true'&&process.platform==='linux'){assert.equal(process.arch,'x64');assert.equal(machine(),'x86_64');assert.equal(process.env.RUNNER_ARCH,'X64');}
const {stdout}=await promisify(execFile)('git',['rev-parse','HEAD'],{maxBuffer:10000});
await writeImmutable(join(run.directory,'runner.json'),{commit:stdout.trim(),host:record.host,sourceDigest:source,contractDigest:contract,platformEvidence:record.artifactPath,runURL:process.env.GITHUB_SERVER_URL&&process.env.GITHUB_REPOSITORY&&process.env.GITHUB_RUN_ID?`${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null});
console.log(JSON.stringify({status:record.status,artifactPath:record.artifactPath,tests:Object.values(results).reduce((total,result)=>total+result.tests.length,0),host:record.host}));
