export const suites = {
    contracts: {
        files: [
            "test/unit/contracts.test.mjs",
            "test/unit/dependency-security.test.mjs",
        ],
        kind: "unit-doubles",
        behavior: [
            "identity",
            "profiles",
            "ipc",
            "evidence",
            "public-api",
            "dependency-security",
        ],
    },
    policy: {
        files: [
            "test/unit/policy.test.mjs",
            "test/unit/execpolicy.test.mjs",
            "test/unit/context-files.test.mjs",
            "test/unit/external.test.mjs",
        ],
        kind: "unit-doubles",
        behavior: [
            "paths",
            "rules",
            "shell",
            "settings",
            "context-files",
            "external-policy",
        ],
    },
    reviewer: {
        files: ["test/unit/reviewer.test.mjs"],
        kind: "simulated-provider-ui",
        behavior: ["review", "deadlines", "cancellation", "context-binding"],
    },
    approvals: {
        files: ["test/unit/approvals.test.mjs"],
        kind: "simulated-provider-ui",
        behavior: ["grants", "queue", "persistence", "audit"],
    },
    execution: {
        files: ["test/execution/executor.test.mjs"],
        kind: "workflow",
        behavior: ["execution", "cancellation"],
    },
    integration: {
        files: [
            "test/integration/pi-tools.test.mjs",
            "test/integration/mcp.test.mjs",
            "test/integration/approval-settings.test.mjs",
            "test/integration/review-context.test.mjs",
        ],
        kind: "simulated-provider-ui",
        behavior: [
            "tools",
            "final-input",
            "user-bash",
            "startup",
            "nested",
            "options",
            "context-files",
            "external-tools",
            "approval-settings",
            "review-context",
        ],
    },
    e2e: {
        files: ["test/e2e/guard.test.mjs"],
        kind: "workflow",
        behavior: ["workflow", "package", "cleanup"],
    },
    conformance: {
        files: [
            "test/conformance/auto-review.test.mjs",
            "test/conformance/protection.test.mjs",
        ],
        kind: "simulated-provider-ui",
        behavior: [
            "reference",
            "joined",
            "creation",
            "failures",
            "evidence-join",
            "scenario-harness",
            "boundary-matrix",
            "review-routing",
            "scoped-grants",
            "review-cancellation",
        ],
    },
};
