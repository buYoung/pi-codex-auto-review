import { GuardError, type TestEvidence } from './contracts.js';

export function validateEvidence(evidence: TestEvidence, requiredBehavior: readonly string[], expected?: { contractDigest: string; sourceDigest: string }): void {
  if (!evidence || !['pass', 'fail', 'environment-blocked', 'not-run'].includes(evidence.status)) throw new GuardError('INVALID_EVIDENCE', 'Unknown evidence status');
  if (!evidence.testFiles?.length || new Set(evidence.testFiles).size !== evidence.testFiles.length || !evidence.tests?.length) throw new GuardError('MISSING_EVIDENCE', 'Missing or duplicate test files / empty suite');
  if (new Set(evidence.tests.map(t => t.name)).size !== evidence.tests.length) throw new GuardError('DUPLICATE_EVIDENCE', 'Duplicate test names');
  if (!evidence.contractDigest || !evidence.sourceDigest || !evidence.platform || !evidence.runtimeVersions || !Object.keys(evidence.runtimeVersions).length) throw new GuardError('STALE_EVIDENCE', 'Missing evidence versions');
  if (expected && (expected.contractDigest !== evidence.contractDigest || expected.sourceDigest !== evidence.sourceDigest)) throw new GuardError('STALE_EVIDENCE', 'Evidence does not match current source');
  if (evidence.status === 'pass') {
    if (evidence.blockedReasons.length || evidence.tests.some(t => t.status !== 'pass' || t.isSkipped)) throw new GuardError('FALSE_PASS', 'Skipped, blocked or failed tests cannot pass');
    for (const requirement of requiredBehavior) {
      if (!evidence.coveredBehavior.includes(requirement) || !evidence.tests.some(t => t.name.includes(`[${requirement}]`) && t.status === 'pass')) throw new GuardError('MISSING_COVERAGE', `Missing executed proof for ${requirement}`);
    }
    if (evidence.suite === 'native' && evidence.evidenceKind !== 'native-os') throw new GuardError('FALSE_NATIVE', 'Native evidence requires OS controls');
    if(evidence.suite==='native' && (!evidence.nativeControls?.some(control=>control.kind==='allow'&&control.isObserved&&control.platform===evidence.platform)||!evidence.nativeControls.some(control=>control.kind==='deny'&&control.isObserved&&control.platform===evidence.platform)))throw new GuardError('FALSE_NATIVE','Native evidence requires observed permitted and denied controls');
  }
}
