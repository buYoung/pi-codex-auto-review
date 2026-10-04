import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { matrixResults, reference } from "./auto-review-evidence.mjs";
import {
    createRun,
    preserveLegacy,
    repository,
    writeImmutable,
} from "./evidence-store.mjs";
import { writeHandoffs } from "./handoffs.mjs";
import {
    contractDigest,
    runSuite,
    runtimeVersions,
    sourceDigest,
} from "./run-tests.mjs";
import { suites } from "./suites.mjs";

const legacyArchive = await preserveLegacy();
const source = await sourceDigest(),
    contract = await contractDigest(),
    versions = await runtimeVersions();
const run = await createRun({
    sourceDigest: source,
    contractDigest: contract,
    runtimeVersions: versions,
    legacyArchive,
    command: "npm run verify:guard",
});
const results = {};
let buildProof;
try {
    await promisify(execFile)("npm", ["run", "build"], {
        cwd: repository,
        maxBuffer: 2_000_000,
    });
    buildProof = {
        command: "npm run build",
        cwd: repository,
        status: "pass",
        exitCode: 0,
        recordedAt: new Date().toISOString(),
    };
} catch (error) {
    await writeImmutable(join(run.directory, "build.json"), {
        status: "fail",
        exitCode: error.code,
        recordedAt: new Date().toISOString(),
    });
    throw error;
}
await writeImmutable(join(run.directory, "build.json"), buildProof);
for (const name of Object.keys(suites)) {
    try {
        results[name] = await runSuite(name, run);
    } catch (error) {
        console.error(`${name}: ${error.message}`);
        process.exitCode = 1;
    }
}
const isSourceStable =
    source === (await sourceDigest()) && contract === (await contractDigest());
const isPassed =
    isSourceStable &&
    Object.keys(results).length === Object.keys(suites).length &&
    Object.values(results).every((result) => result.status === "pass");
const status = isPassed
    ? "pass"
    : Object.values(results).some(
            (result) => result.status === "environment-blocked",
        )
      ? "environment-blocked"
      : "fail";
const current = {
    schemaVersion: 2,
    runId: run.runId,
    artifactPath: `${run.artifactPath}/platform.json`,
    platform: run.platform,
    status,
    sourceDigest: source,
    contractDigest: contract,
    runtimeVersions: versions,
    results,
    recordedAt: new Date().toISOString(),
};
await writeImmutable(join(run.directory, "platform.json"), current);
const auditProof = {
    status: "fail",
    artifact: `${run.artifactPath}/owned-audits.jsonl`,
    recordCount: 0,
};
try {
    const data = await readFile(
        join(run.directory, "owned-audits.jsonl"),
        "utf8",
    );
    auditProof.recordCount = data.trim() ? data.trim().split("\n").length : 0;
    if (
        !auditProof.recordCount ||
        /SYNTHETIC_GUARD_SECRET_[a-z0-9-]+/i.test(data)
    )
        throw new Error("Audit population is empty or leaked a marker");
    auditProof.status = "pass";
} catch (error) {
    auditProof.reason = error.message;
}
await writeHandoffs(results, buildProof, run);
const state =
    isPassed && auditProof.status === "pass"
        ? "complete"
        : status === "environment-blocked"
          ? "environment-blocked"
          : "failed";
const final = {
    schemaVersion: 2,
    runId: run.runId,
    artifactPath: `${run.artifactPath}/final.json`,
    state,
    verificationScope: "current-platform approval assistant",
    osIsolation: false,
    liveProviderExecuted: false,
    sourceDigest: source,
    contractDigest: contract,
    runtimeVersions: versions,
    requiredPlatforms: [current.platform],
    platformResults: [current],
    testFiles: Object.values(suites).flatMap((suite) => suite.files),
    coveredBehavior: Object.values(results).flatMap(
        (result) => result.coveredBehavior,
    ),
    suiteCommands: Object.keys(suites).map((name) => `npm run test:${name}`),
    results,
    reference,
    scenarioMatrix: matrixResults([current]),
    blockedReasons: [
        ...Object.entries(results)
            .filter(([, result]) => result.status !== "pass")
            .map(([name, result]) => `${name}: ${result.status}`),
        ...(!isSourceStable ? ["Source changed during verification"] : []),
        ...(auditProof.status !== "pass" ? [auditProof.reason] : []),
    ],
    packageProof: results.e2e?.tests.filter((test) =>
        test.name.includes("[package]"),
    ),
    cleanup: {
        platform: current.platform,
        status:
            results.e2e?.tests.find((test) => test.name.includes("[cleanup]"))
                ?.status ?? "not-run",
        auditProof,
    },
    limitations: [
        "Model and UI fixtures verify routing, not the judgment accuracy of a live model.",
        "Approval interception does not enforce OS filesystem or network isolation.",
        "Other platforms and live-provider runs require separate executed evidence.",
    ],
    legacyArchive,
    recordedAt: new Date().toISOString(),
};
await writeImmutable(join(run.directory, "final.json"), final);
const conformance = {
    ...final,
    status: state,
    implementationStatus: "implemented",
};
await writeImmutable(
    join(run.directory, "auto-review-conformance.json"),
    conformance,
);
await writeFile(
    join(repository, "docs/handoffs/auto-review/07-conformance.json"),
    `${JSON.stringify(conformance, null, 2)}\n`,
);
await writeFile(
    join(repository, "docs/handoffs/pi-guard/06-verification.json"),
    `${JSON.stringify(final, null, 2)}\n`,
);
await writeFile(
    join(repository, ".reports/pi-guard/final.json"),
    `${JSON.stringify(final, null, 2)}\n`,
);
console.log(
    JSON.stringify(
        {
            state,
            artifactPath: final.artifactPath,
            currentPlatform: current.platform,
            currentStatus: current.status,
            auditProof,
            blockedReasons: final.blockedReasons,
        },
        null,
        2,
    ),
);
if (state !== "complete") process.exitCode = 1;
