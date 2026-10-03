import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { suites } from './suites.mjs';
import { sourceDigest, contractDigest, runtimeVersions } from './run-tests.mjs';
import { validateEvidence } from '../dist/reports.js';
import { writeImmutable, requiredPlatforms } from './evidence-store.mjs';
import { join } from 'node:path';
const root=new URL('../',import.meta.url);
const modules={
 '01-contracts':['src/contracts.ts','src/reports.ts'],
 '02-policy':['src/policy/index.ts','src/policy/paths.ts','src/policy/shell.ts','src/policy/rules.ts','src/policy/domains.ts'],
 '03-review':['src/reviewer.ts','src/review/policy.ts','src/review/context.ts','src/review/investigation.ts','src/review/lifecycle.ts','src/approvals.ts','src/audit.ts','src/signals.ts'],
 '04-sandbox':['src/sandbox/config.ts','src/sandbox/seccomp.ts','src/sandbox/linux-read-paths.ts','src/sandbox/runtime-write-paths.ts','src/sandbox/executor.ts','src/sandbox/broker.ts','src/sandbox/worker.ts'],
 '05-integration':['src/index.ts','src/startup.ts','src/cli.ts','src/tools/controller.ts'],
};
export async function writeHandoffs(results,buildProof={status:'not-run'},run) {
 const source=await sourceDigest(),contract=await contractDigest(),versions=await runtimeVersions();
 await mkdir(new URL('docs/handoffs/pi-guard/',root),{recursive:true});
 const associations={'01-contracts':['contracts'],'02-policy':['policy'],'03-review':['reviewer','approvals'],'04-sandbox':['native'],'05-integration':['integration']};
 const details={
  '01-contracts':{
    publicPiApis:['createGuardExtension (package)','createAgentSessionServices','createAgentSessionFromServices','createAgentSessionRuntime','DefaultResourceLoader','createCodemodeExtension','createBashToolDefinition','createReadToolDefinition','createEditToolDefinition','createWriteToolDefinition','createGrepToolDefinition','createFindToolDefinition','createLsToolDefinition','ModelRegistry.streamSimple','AgentSession.bindExtensions','AgentSession.reload','AgentSession.executeBash','AgentSessionRuntime.dispose'],
    referenceComparison:{installedPi:'0.99.1',copiedPi:'0.99.2',qualifiedPi:['0.99.1'],referenceFiles:['tmp/pi-main/packages/coding-agent/src/index.ts','tmp/pi-main/packages/coding-agent/src/core/extensions/types.ts','tmp/pi-main/packages/coding-agent/src/core/tools/bash.ts'],result:'Selected hooks, tool factories, nested execution, timeout units and public SDK modes are present in installed declarations and verified by executable tests. The newer snapshot is a read-only reference; 0.99.2 is not qualified.'},
    requestContract:{schemaVersion:1,fields:['toolCallId','tool','source','args','cwd','sessionId','policyRevision','permissionDigest','digest'],serialization:'sorted finite JSON snapshot; recursive freeze; cwd resolved to canonical path'},
    decisionContract:{outcomes:['allow','ask','deny'],hardDeny:'dominates review and every cached grant'},
    permissionContract:{modes:['read-only','workspace-write'],delta:['readPaths','writePaths','domains'],readOnlyPaths:'reviewable metadata writes, separate from absolute denyRead/denyWrite',authority:['scoped-permissions','command-rule','reviewed-command'],isolation:'base profile immutable, actual native delta disclosed before review and specific to one execution'},
    grantContract:{scopes:['once','session','persistent'],consumption:'once at logical admission; helper I/O remains inside that action'},
    reportContract:{statuses:['pass','fail','environment-blocked','not-run'],required:['suite','command','testFiles','coveredBehavior','tests','platform','sourceDigest','contractDigest','runtimeVersions','evidenceKind'],native:'observed permitted and denied OS controls are mandatory; a declaration alone cannot pass'},
    fixtureContract:{root:'owned mkdtemp root, canonicalized before permission creation',credentials:'in-memory synthetic provider; inherited environment cleared before Pi imports; catalog/auth probes replaced by offline double',cleanup:'after-hooks scan owned audit population and remove only the owned root'},
    workerProtocol:{schemaVersion:1,frames:['data','update','result','error'],privateBrokerFrames:['workload-started','network-request','network-response'],controlTransport:'private Node IPC never inherited by workloads',payload:'validated JSON over stdin/stdout; worker output cannot impersonate broker control frames'},
    startupProtection:{entry:'dist/cli.js or createGuardedRuntime',barrier:'version/extension/native checks plus prompt/reload/direct user shell guards',ordinaryPi:'Extension loader may discard failures; ordinary startup is not protected'},
    timeoutUnits:{modelTimeoutMs:'milliseconds',uiTimeoutMs:'milliseconds',BashOperations:'seconds'},
    commands:Object.fromEntries(Object.keys(suites).map(name=>[name,`npm run test:${name}`])),
  },
  '02-policy':{supportedGrammar:'Literal prefix_rule subset with alternatives and match/not_match assertions; strongest compound rule wins. Unsupported shell syntax and interpreters run inside the base sandbox unless an explicit boundary grant or rule prompts review.',policyRevision:'sha256 of validated settings, immutable profile, loaded rules and review policy',exports:['PolicyEngine','validateSettings','loadSettings','defaultProfile','canonicalPath','analyzeShell']},
  '03-review':{decisionFallbacks:'Structured allow grants the reviewed invocation delta or command authority. Denied/timed-out/aborted/failed remain distinct; technical failures never become approvals or UI fallbacks. Legacy decision/reason providers cannot widen authority automatically.',context:'Trusted retained user/developer/AGENTS/confirmation sources remain distinct from visible assistant/tool evidence; no hidden reasoning',retry:'One exact user-selected denial is reviewed again; critical denials cannot be overridden',grantScopes:['once','session','persistent'],redactionRules:'No command/argument/content/provider/worker payload in audit. Bounded risk, authorization and rationale metadata is redacted.',exports:['reviewAction','PiReviewProvider','ApprovalManager','FileGrantPersistence','AuditLog']},
  '04-sandbox':{runtimeVersion:versions['@anthropic-ai/sandbox-runtime'],workerProtocol:{schemaVersion:1},capabilities:['invocation-owned broker/proxies','kernel filesystem/network confinement','whole Pi file/search worker','descendant process group termination','filtered caller environment','no host fallback'],networkFixture:'Explicit trusted MITM Unix-socket transport to owned service, domain-filtered by the genuine runtime; default loopback/SSRF restrictions preserved',requiredPlatforms,platformResults:[{platform:`${process.platform}-${process.arch}`,status:results.native?.status??'not-run',artifactPath:results.native?.artifactPath}],qualification:'Only this run is described here; final aggregate validates every required architecture'},
  '05-integration':{guardedStartup:['dist/cli.js','createGuardedRuntime'],modes:['tui','rpc','print','json'],toolRoutes:{bash:'host Pi formatting and operations -> bound admission -> native shell worker',files:'host Pi schemas/renderers -> bound admission -> public Pi definitions inside native worker',codemode:'public built-in QuickJS -> ctx.executeTool -> same final wrappers',userBash:'always handled operations; final prefix/cwd/env/options rechecked',reload:'readiness barrier prevents discarded extension fallback'},trustBoundaries:['Pi and explicitly trusted extensions are controllers','remote MCP internals and arbitrary trusted in-process effects are outside native workload confinement','unknown tools require explicit trusted adapters']},
 };
 for(const [name,paths] of Object.entries(modules)) {
  const selected=associations[name].map(suite=>results[suite]).filter(Boolean);
  let isReady=buildProof.status==='pass'&&selected.length===associations[name].length;
  for(const report of selected) {validateEvidence(report,suites[report.suite].behavior,{sourceDigest:source,contractDigest:contract});if(report.status!=='pass')isReady=false;}
  const moduleHashes={};for(const path of paths)moduleHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  const handoff={schemaVersion:1,state:isReady?'ready':selected.some(report=>report.status==='environment-blocked')?'environment-blocked':'not-ready',sourceDigest:source,contractDigest:contract,runtimeVersions:versions,modulePaths:paths,moduleHashes,testFiles:selected.flatMap(report=>report.testFiles),coveredBehavior:selected.flatMap(report=>report.coveredBehavior),results:selected,buildProof,...details[name],...(name==='05-integration'?{qualifiedPlatforms:results.native?.status==='pass'?[results.native.platform]:[]}:{}),recordedAt:new Date().toISOString()};
  if (!run) throw new Error('Handoff publication requires an immutable run');
  await writeImmutable(join(run.directory, `${name}.json`), handoff);
  await writeFile(new URL(`docs/handoffs/pi-guard/${name}.json`,root),JSON.stringify({...handoff,runId:run.runId,artifactPath:`${run.artifactPath}/${name}.json`},null,2)+'\n');
 }
}
