import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRun, writeImmutable } from '../../scripts/evidence-store.mjs';
import { sourceDigest, contractDigest, runtimeVersions, runSuite } from '../../scripts/run-tests.mjs';
import { suites } from '../../scripts/suites.mjs';
import { cloudFixture } from './runtime.mjs';
import { liveSmoke } from './live-smoke.mjs';
import { nativePreflight } from './preflight.mjs';
import { seccompRuntime } from '../../dist/sandbox/seccomp.js';

const mode=process.argv[2]??'offline';
if(!['offline','live','conformance'].includes(mode))throw new Error('Expected offline, live or conformance mode');
const isLive=mode!=='offline', model=process.env.OLLAMA_MODEL;
if(!isLive)delete process.env.OLLAMA_API_KEY;
const identity=JSON.parse(await readFile('/opt/guard-artifacts/identity.json','utf8'));
assert.equal(identity.sourceDigest,await sourceDigest());assert.equal(identity.contractDigest,await contractDigest());
const run=await createRun({sourceDigest:identity.sourceDigest,contractDigest:identity.contractDigest,imageDigest:process.env.PI_GUARD_IMAGE_DIGEST,pluginArtifactDigest:identity.plugin.sha256,provider:{package:'pi-ollama-cloud',version:'0.12.2',id:'ollama-cloud',model:model??'catalog-only'},command:`node test/docker/bootstrap.mjs ${mode}`});
const tests=[],results={};
let startup,live,blockedReason,preflight;
const originalFetch=globalThis.fetch;
let networkRequests=0;
globalThis.fetch=(...args)=>{networkRequests++;if(!isLive)throw new Error('Offline provider attempted network access');return originalFetch(...args);};
try{
  preflight=await nativePreflight();
  assert.equal(identity.packages['pi-ollama-cloud'],'0.12.2');
  assert.equal(identity.packages['@earendil-works/pi-coding-agent'],'0.99.1');
  const fixture=await cloudFixture({isLive:false,modelId:model});
  try{
    const result=await fixture.runtime.session.executeBash('printf packaged-guard-ready');assert.equal(result.output,'packaged-guard-ready');
    await fixture.runtime.session.reload();
    assert.equal((await fixture.runtime.session.executeBash('printf reloaded-guard-ready')).output,'reloaded-guard-ready');
    assert.ok(fixture.modelRuntime.getModel('ollama-cloud',model??'glm-5.3'));
    assert.ok(!fixture.runtime.session.getAllTools().some(tool=>tool.name.startsWith('ollama_web_')));
    startup={guardLoaded:true,providerLoaded:true,reloadPassed:true,webToolsAbsent:true,usagePolling:false,offlineModelCalls:fixture.calls};
  }finally{await fixture.dispose();}
  tests.push({name:'[provider-loading] exact installed cloud provider and packaged guard survive reload',status:'pass'});
  if(!isLive){assert.equal(networkRequests,0);for(const name of Object.keys(suites))results[name]=await runSuite(name,run);}
  else live=mode==='live'?await liveSmoke(model):await (await import('./live-review.mjs')).liveConformance(model);
  if(live?.status&&live.status!=='pass')throw new Error(`${live.status==='environment-blocked'?'ENVIRONMENT_BLOCKED: ':''}Live conformance scenario did not pass; see retained live.cases`);
  if(isLive)tests.push({name:'[live-provider] real main-agent and reviewer complete bounded owned workflow',status:'pass'});
}catch(error){
  const safe=String(error?.message??error).split(process.env.OLLAMA_API_KEY||'\0').join('[REDACTED]').slice(0,2000);
  blockedReason=safe;tests.push({name:isLive?'[live-provider] live execution':'[provider-loading] guarded startup',status:error?.code==='ENVIRONMENT_BLOCKED'||safe.startsWith('ENVIRONMENT_BLOCKED:')?'environment-blocked':'fail'});
}finally{globalThis.fetch=originalFetch;}
const status=tests.some(test=>test.status==='fail')||Object.values(results).some(result=>result.status==='fail')?'fail':tests.some(test=>test.status==='environment-blocked')||Object.values(results).some(result=>result.status==='environment-blocked')?'environment-blocked':'pass';
const platform=`${process.platform}-${process.arch}`;
const nativeCapabilities={platform,processArchitecture:process.arch,kernelArchitecture:seccompRuntime()?.architecture,reportedMachine:(await promisify(execFile)('uname',['-m'])).stdout.trim(),seccompHelperArchitecture:seccompRuntime()?.architecture,bwrap:(await promisify(execFile)('bwrap',['--version'])).stdout.trim(),fd:(await promisify(execFile)('fd',['--version'])).stdout.trim(),weakerNestedSandbox:false,weakerNetworkIsolation:false,preflight,controls:results.native?.nativeControls??[]};
const report={schemaVersion:2,runId:run.runId,artifactPath:`${run.artifactPath}/docker-${mode}.json`,status,mode,platform,sourceDigest:identity.sourceDigest,contractDigest:identity.contractDigest,provenance:'executed',command:run.command,identity,imageDigest:run.imageDigest,pluginArtifactDigest:identity.plugin.sha256,provider:run.provider,runtimeVersions:await runtimeVersions(),nativeCapabilities,startup,live,networkRequests,tests,results,blockedReasons:blockedReason?[blockedReason]:[],recordedAt:new Date().toISOString()};
await writeImmutable(join(run.directory,`docker-${mode}.json`),report);
if(!isLive)await writeImmutable(join(run.directory,'platform.json'),{...report,results});
console.log(JSON.stringify({status,artifactPath:report.artifactPath,platform,startup,live,blockedReasons:report.blockedReasons}));
if(status!=='pass')process.exitCode=1;
