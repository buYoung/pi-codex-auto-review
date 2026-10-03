import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reportRoot } from './evidence-store.mjs';
import { validatePlatformEvidence } from '../dist/reports.js';
import { suites } from './suites.mjs';

export const reference = {
  version:'codex-cli 0.160.0', tag:'rust-v0.160.0', revision:'a956835d020762cb2b570053af06f643a11c0ecc',
  policyTemplateSha256:'37441097e4e825e0b195c32c985817ea07da15bb5c20fa753d87b22e2fe47e73',
  tenantPolicySha256:'e6b0cf0a2e1c4cabc0a37ac2a0bc424ddd7c89e85d049e32d281a8db6e8d3ce6',
};
const ref = file => `https://github.com/openai/codex/blob/${reference.revision}/codex-rs/${file}`;
const guardian = file => ref(`ext/guardian-reviewer/src/${file}.rs`);
const row = (id, references, expected, proofs) => ({id,references,expected,proofs:proofs.map(([suite,pattern])=>({suite,pattern}))});
export const scenarioMatrix = [
  row('automatic-boundary-approval',[guardian('routing')],'Structured approval executes the exact outside action without UI and does not grant the next call',[['integration','structured automatic approval'],['conformance','[joined]']]),
  row('policy-risk-and-authorization',[guardian('assessment'),ref('prompts/templates/guardian/policy_template.md')],'Pinned policy bytes, risk threshold and explicit policy denials remain effective',[['conformance','[reference]'],['reviewer','pinned short/full']]),
  row('retained-context-and-trust',[guardian('model')],'Original scope reaches follow-up review; tool text and hidden reasoning cannot become authorization',[['reviewer','retained authorization'],['integration','actual Pi follow-up']]),
  row('read-only-investigation',[guardian('model')],'Only bounded native read inspection is available; protected reads, writes and network are denied',[['integration','native reviewer investigation'],['reviewer','registered model override']]),
  row('review-model-selection',[guardian('model')],'Configured registered review model and final limits reach the provider',[['reviewer','registered model override']]),
  row('ordinary-actions-and-routing',[guardian('routing')],'Ordinary interpreter runs confined without review; never/granular/user routing are distinct',[['policy','ordinary commands'],['approvals','disabled categories'],['conformance','[joined]']]),
  row('command-rule-format-and-authority',[ref('execpolicy/src/parser.rs'),ref('execpolicy/src/policy.rs')],'Pinned Codex Starlark, host executables and network rules reach matching and native configuration; command authority remains invocation-bound',[['policy','literal Codex'],['policy','Codex Starlark'],['policy','host executable'],['policy','all network_rule'],['integration','explicit full-command']]),
  row('context-file-discovery',[ref('core/src/agents_md.rs')],'Trusted project discovery preserves precedence, byte bounds, read protection and runtime provenance across reload',[['policy','[context-files]'],['integration','discovered instructions']]),
  row('Pi-official-MCP',[ref('core/src/mcp_tool_call.rs'),ref('core/src/session/mcp.rs')],'Official Pi MCP actions preserve strict automatic, human-only, stale and cancelled routing without Computer Use name exceptions',[['policy','[external-policy]'],['integration','[external-tools]'],['e2e','real MCP node_repl'],['e2e','npm tarball']]),
  row('Pi-controller-integrity',[ref('prompts/templates/guardian/policy_template.md')],'Model actions cannot rewrite Pi execution settings or trusted extension modules before reload; explicit host changes remain effective',[['e2e','trusted project MCP'],['e2e','trusted extension entrypoint']]),
  row('literal-native-permission-boundaries',[ref('prompts/templates/guardian/policy_template.md')],'Literal filenames cannot become broader native patterns; unsupported permission roots fail closed while ordinary workspace filenames remain usable',[['native','SDK permission roots'],['e2e','literal metacharacters']]),
  row('review-failure-and-user-lifetimes',[ref('protocol/src/approvals.rs'),ref('core/src/guardian/review.rs')],'Malformed enums never execute, quoted rationale stays valid and redacted, and a stopped model turn does not cancel a later direct user command',[['e2e','malformed risk enums'],['e2e','quoted review rationale'],['e2e','denial circuit']]),
  row('preexisting-hard-link-boundaries',[ref('prompts/templates/guardian/policy_template.md')],'Pre-existing inode aliases cannot cross protected reads or narrow write grants; contained links remain usable',[['native','pre-existing hard-link'],['native','narrow reviewed grant does not expose']]),
  row('additional-network-protocols',[ref('execpolicy/src/rule.rs')],'HTTPS certificate verification, SOCKS5 TCP and IPv6 proxy controls succeed while denied and direct traffic stays isolated',[['native','HTTPS CONNECT'],['native','SOCKS5 TCP'],['native','IPv6 proxy']]),
  row('filesystem-temp-protected-paths',[ref('prompts/templates/guardian/policy_template.md')],'Read/write protections, temporary roots, Git metadata, scoped writes and protected credential directories reach native consumers',[['policy','default readable roots'],['native','reviewed metadata grant'],['native','backend convenience write paths'],['integration','complete explicitly selected agent credential directory'],['conformance','[creation]']]),
  row('dynamic-network-origin',[guardian('routing')],'Review sees the original command and exact dynamic destination without replaying preceding effects',[['integration','runtime network review'],['native','live broker approval']]),
  row('distinct-failure-states',[guardian('completion'),guardian('feedback')],'Denial, timeout, cancellation and technical failure remain distinguishable and never execute',[['reviewer','configured milliseconds'],['reviewer','caller cancellation'],['conformance','[failures]']]),
  row('circuit-breaker',[guardian('circuit_breaker')],'Three consecutive or ten of fifty denials interrupt the real Pi turn',[['approvals','denial breaker'],['integration','three denied reviews']]),
  row('exact-one-retry',[guardian('retry')],'One exact /approve marker reaches fresh review, changed or stale actions cannot borrow it',[['approvals','exact one-use retry'],['integration','real Pi approve'],['integration','authorization changed']]),
  row('UI-and-audit-feedback',[guardian('feedback')],'Bounded redacted review metadata and terminal feedback reflect actual results',[['approvals','structured review metadata'],['conformance','[failures]']]),
  row('wildcard-domain-mismatch',[guardian('routing')],'Wildcard host grants match both policy and real proxy, while direct/denied requests do not reach the service',[['policy','wildcard domains'],['native','allowed proxy control']]),
  row('shell-read-denyWrite-defect',[ref('prompts/templates/guardian/policy_template.md')],'Read-only metadata is readable and only the reviewed target becomes writable',[['policy','write-protected metadata'],['native','reviewed metadata grant']]),
  row('Docker-recovery-and-provider',[guardian('model')],'Installed provider and packed guard survive reload; the real CLI selects the provider/model for both execution and review',[['integration','explicit installed cloud provider'],['e2e','real CLI'],['e2e','live CLI observer'],['e2e','trusted Pi skills']]),
  row('cross-platform-conformance',[guardian('routing')],'Same-source required platforms and same-image live evidence are required; stale, simulated and wrong-architecture data cannot qualify',[['contracts','incomplete, stale'],['conformance','[evidence-join]']]),
];

export const liveCaseIds = ['routine-allowed','authorized-outside','protected-path-denied','reviewer-policy-denied'];
export function validateLiveEvidence(report, offline, identity) {
  validatePlatformEvidence(offline,suites,{platform:report.platform,...identity});
  assert.equal(report.status,'pass');assert.equal(report.provenance,'executed');assert.equal(report.mode,'conformance');
  for(const key of ['sourceDigest','contractDigest'])assert.equal(report[key],identity[key]);
  assert.match(report.imageDigest,/^sha256:[a-f0-9]{64}$/);assert.equal(report.imageDigest,offline.imageDigest);
  assert.match(report.pluginArtifactDigest,/^[a-f0-9]{64}$/);assert.equal(report.pluginArtifactDigest,offline.pluginArtifactDigest);
  assert.equal(report.provider?.id,'ollama-cloud');assert.equal(report.provider?.package,'pi-ollama-cloud');assert.equal(report.provider?.version,'0.12.2');
  assert.equal(report.provider?.model,identity.model);
  for(const key of ['guardLoaded','providerLoaded','reloadPassed','webToolsAbsent'])assert.equal(report.startup?.[key],true);
  assert.equal(report.startup?.usagePolling,false);
  assert.equal(report.nativeCapabilities?.weakerNestedSandbox,false);assert.equal(report.nativeCapabilities?.weakerNetworkIsolation,false);
  assert.equal(report.nativeCapabilities?.preflight?.permittedEffect,true);assert.equal(report.nativeCapabilities?.preflight?.deniedEffect,true);
  assert.ok(report.networkRequests>0);
  const live=report.live;assert.equal(live?.status,'pass');assert.equal(live?.evidenceKind,'live-provider');
  assert.deepEqual(live.cases.map(item=>item.id),liveCaseIds);
  assert.equal(live.limits.maxCallsPerCase,24);assert.equal(live.limits.deadlineMsPerCase,180000);
  for(const item of live.cases){
    assert.equal(item.status,'pass');assert.equal(item.provider,'ollama-cloud');assert.equal(item.model,identity.model);
    assert.equal(item.effectObserved,true);assert.equal(item.credentialScanPassed,true);
    assert.ok(Number.isInteger(item.calls.main)&&item.calls.main>0);
    assert.ok(Number.isInteger(item.calls.reviewer)&&item.calls.reviewer>=0);
    assert.ok(item.calls.main+item.calls.reviewer<=24);assert.ok(item.elapsedMs>=0&&item.elapsedMs<=180000);
    assert.ok(item.auditRecords>0);
    if(['authorized-outside','reviewer-policy-denied'].includes(item.id))assert.ok(item.calls.reviewer>0);
    else assert.equal(item.calls.reviewer,0);
    if(item.id==='authorized-outside')assert.ok(item.approvedReviews>0);
    if(item.id==='protected-path-denied')assert.ok(item.deniedToolEvents>0);
    if(item.id==='reviewer-policy-denied'){assert.ok(item.deniedReviews>0);assert.ok(item.feedbackCodes.includes('AUTO_REVIEW_DENIED'));}
  }
  const cli=live.cli;
  assert.equal(cli?.status,'pass');assert.equal(cli.entrypoint,'packed-cli');
  assert.equal(cli.provider,'ollama-cloud');assert.equal(cli.model,identity.model);
  assert.equal(cli.effectObserved,true);assert.equal(cli.credentialScanPassed,true);
  assert.ok(Number.isInteger(cli.calls?.main)&&Number.isInteger(cli.calls?.reviewer)&&cli.calls.main>0&&cli.calls.reviewer>0&&cli.calls.main+cli.calls.reviewer<=24);
  assert.ok(cli.approvedReviews>0&&cli.auditRecords>0&&cli.elapsedMs>=0&&cli.elapsedMs<=180000);
  return report;
}

export async function dockerCandidates(sourceDigest, contractDigest) {
  let entries;try{entries=await readdir(join(reportRoot,'runs'));}catch(error){if(error.code==='ENOENT')return[];throw error;}
  const candidates=[];
  for(const id of entries.sort().reverse())for(const platform of ['linux-x64','linux-arm64'])for(const name of ['docker-offline.json','docker-live.json','docker-conformance.json','docker-orchestration.json']){
    const artifactPath=join('.reports/pi-guard/runs',id,platform,name);
    try{const report=JSON.parse(await readFile(join(reportRoot,'runs',id,platform,name),'utf8'));if(report.sourceDigest===sourceDigest&&report.contractDigest===contractDigest)candidates.push({...report,artifactPath});}
    catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
  }
  return candidates;
}

export async function windowsQualification(sourceDigest, contractDigest) {
  let entries;try{entries=await readdir(join(reportRoot,'runs'));}catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const id of entries.sort().reverse()){
    try{
      const result=JSON.parse(await readFile(join(reportRoot,'runs',id,'win32-x64','windows.json'),'utf8'));
      if(result.status==='pass'&&result.sourceDigest===sourceDigest&&result.contractDigest===contractDigest&&result.qualification==='portable-engine-and-fail-closed'&&result.host?.platform==='win32'&&result.host.arch==='x64'&&result.nativeConfinementPassed===false&&result.portableTests?.status==='pass'&&['hostWrite','unsupportedExecutionRejected','noWorkloadEffect','startupRejected','noToolRegistration'].every(key=>result.controls?.[key]===true))return result;
    }catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
  }
}

export function matrixResults(platformResults) {
  return scenarioMatrix.map(row=>({...row,platforms:platformResults.map(platform=>({
    platform:platform.platform,
    proofs:row.proofs.map(proof=>{
      const report=platform.results?.[proof.suite], tests=report?.tests.filter(test=>test.name.includes(proof.pattern))??[];
      return {...proof,artifactPath:report?.artifactPath,status:report?.status==='pass'&&tests.length>0&&tests.every(test=>test.status==='pass')?'pass':'not-qualified',tests:tests.map(test=>test.name)};
    }),
  }))}));
}
