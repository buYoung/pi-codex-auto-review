export const suites = {
  contracts: { files: ['test/unit/contracts.test.mjs'], kind: 'unit-doubles', behavior: ['identity', 'profiles', 'ipc', 'evidence', 'public-api'] },
  policy: { files: ['test/unit/policy.test.mjs'], kind: 'unit-doubles', behavior: ['paths', 'rules', 'shell', 'settings'] },
  reviewer: { files: ['test/unit/reviewer.test.mjs'], kind: 'simulated-provider-ui', behavior: ['review', 'deadlines', 'cancellation'] },
  approvals: { files: ['test/unit/approvals.test.mjs'], kind: 'simulated-provider-ui', behavior: ['grants', 'queue', 'persistence', 'audit'] },
  native: { files: ['test/native/sandbox.test.mjs'], kind: 'native-os', behavior: ['native-launch', 'native-files', 'native-network', 'native-lifecycle', 'native-isolation'] },
  integration: { files: ['test/integration/pi-tools.test.mjs'], kind: 'simulated-provider-ui', behavior: ['tools', 'final-input', 'user-bash', 'startup', 'nested', 'options'] },
  e2e: { files: ['test/e2e/guard.test.mjs'], kind: 'workflow', behavior: ['workflow', 'package', 'cleanup'] },
  conformance: { files: ['test/conformance/auto-review.test.mjs'], kind: 'simulated-provider-ui', behavior: ['reference', 'joined', 'creation', 'failures', 'evidence-join'] },
};
