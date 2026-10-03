import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import { tmpdir, machine, release } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createProfile } from '../dist/contracts.js';
import { NativeExecutor } from '../dist/sandbox/executor.js';
import { createGuardExtension } from '../dist/index.js';
import { createRun, writeImmutable } from './evidence-store.mjs';
import { sourceDigest, contractDigest } from './run-tests.mjs';

assert.equal(process.platform,'win32','This qualification must execute on real Windows');
assert.equal(process.arch,'x64');
const source=await sourceDigest(),contract=await contractDigest();
const run=await createRun({sourceDigest:source,contractDigest:contract,command:'npm run verify:windows'});
const root=await mkdtemp(join(tmpdir(),'pi-guard-windows-')),workspace=join(root,'workspace'),agentDir=join(root,'agent');
await Promise.all([workspace,agentDir].map(path=>mkdir(path)));
const executor=new NativeExecutor(),marker=join(workspace,'unprotected.txt'),control=join(workspace,'control.txt');
const profile=createProfile({mode:'workspace-write',readRoots:[workspace],writeRoots:[workspace],denyRead:[agentDir],denyWrite:[agentDir],allowedDomains:[],deniedDomains:[]});
let evidence;
try {
  await promisify(execFile)(process.execPath,['-e','require("node:fs").writeFileSync(process.argv[1],"host-control")',control],{windowsHide:true});
  assert.equal(await readFile(control,'utf8'),'host-control');
  await assert.rejects(executor.execute({kind:'file',operation:'write',path:marker,content:'must-not-run',cwd:workspace},profile),error=>error.code==='UNSUPPORTED_PLATFORM');
  await assert.rejects(access(marker));
  let registrations=0;
  const extension=createGuardExtension({cwd:workspace,agentDir,profile});
  await assert.rejects(extension.factory({registerTool:()=>registrations++,registerCommand(){},on(){}}),error=>error.code==='ENVIRONMENT_BLOCKED'&&error.cause?.code==='UNSUPPORTED_PLATFORM');
  assert.equal(registrations,0);assert.throws(()=>extension.assertReady(),/failed to load/);
  const portable=await promisify(execFile)(process.execPath,['--test','test/unit/execpolicy.test.mjs','test/unit/external.test.mjs'],{maxBuffer:2_000_000,windowsHide:true});
  await writeImmutable(join(run.directory,'portable-tests.log'),portable.stdout);
  assert.equal(source,await sourceDigest());assert.equal(contract,await contractDigest());
  evidence={schemaVersion:2,status:'pass',qualification:'portable-engine-and-fail-closed',nativeIsolation:'unsupported',nativeConfinementPassed:false,runId:run.runId,artifactPath:`${run.artifactPath}/windows.json`,sourceDigest:source,contractDigest:contract,host:{platform:process.platform,arch:process.arch,machine:machine(),release:release()},controls:{hostWrite:true,unsupportedExecutionRejected:true,noWorkloadEffect:true,startupRejected:true,noToolRegistration:true},portableTests:{status:'pass',command:'node --test test/unit/execpolicy.test.mjs test/unit/external.test.mjs',artifactPath:`${run.artifactPath}/portable-tests.log`},recordedAt:new Date().toISOString()};
} catch(error) {
  evidence={status:'fail',qualification:'portable-engine-and-fail-closed',nativeConfinementPassed:false,sourceDigest:source,contractDigest:contract,error:String(error.stack??error)};process.exitCode=1;
} finally {await executor.close();await rm(root,{recursive:true,force:true});}
await writeImmutable(join(run.directory,'windows.json'),evidence);console.log(JSON.stringify(evidence,null,2));
