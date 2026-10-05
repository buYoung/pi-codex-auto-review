import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageDirectory = fileURLToPath(
    new URL("../packages/pi-codex-auto-review/", import.meta.url),
);
const packed = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
        cwd: packageDirectory,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        shell: process.platform === "win32",
    },
);
if (packed.error) throw packed.error;
assert.equal(packed.status, 0, packed.stderr);
const [packageInfo] = JSON.parse(packed.stdout);
const files = new Set(packageInfo.files.map((file) => file.path));
for (const path of [
    "dist/index.js",
    "dist/startup.js",
    "dist/cli.js",
    "dist/tools/executor.js",
    "dist/approval-commands.js",
    "dist/policy/rules.js",
    "dist/policy/rule-engine.js",
    "dist/policy/rules-worker.js",
    "dist/policy/rules-sync.js",
    "dist/policy/starlark/evaluator.js",
    "dist/policy/starlark/parser.js",
    "dist/policy/starlark/lexer.js",
    "dist/policy/starlark/builtins.js",
    "dist/policy/starlark/values.js",
    "dist/policy/starlark/validation.js",
    "LICENSE",
    "NOTICE",
    "docs/usage.md",
    "docs/publishing.md",
])
    assert.ok(files.has(path), `Missing package file: ${path}`);
assert.ok(
    ![...files].some(
        (path) =>
            /^(src|test|tmp|vendor|native|node_modules)\//.test(path) ||
            /^dist\/(sandbox|native)\//.test(path) ||
            /\.(node|wasm|exe)$/.test(path),
    ),
    "The package must not contain native binaries, development dependencies, or removed sandbox assets",
);
const [manifest, engine] = await Promise.all(
    ["pi-codex-auto-review", "redact"].map(async (name) =>
        JSON.parse(
            await readFile(
                new URL(`../packages/${name}/package.json`, import.meta.url),
                "utf8",
            ),
        ),
    ),
);
assert.deepEqual(
    manifest.dependencies,
    { "@buyong/redact": engine.version },
    "The package must depend on exactly the workspace @buyong/redact version",
);
assert.ok(
    !manifest.bundleDependencies?.length &&
        !manifest.bundledDependencies?.length,
    "The package must not bundle its runtime dependency",
);
const { evaluateRules } = await import(
    "../packages/pi-codex-auto-review/dist/policy/rules.js"
);
const result = await evaluateRules(
    [
        {
            name: "package.rules",
            source: 'prefix_rule(["package-check"], decision="prompt")',
        },
    ],
    [["package-check", "--verify"]],
);
assert.equal(result.matches[0][0].decision, "prompt");
console.log(
    "Package verified: JavaScript rule engine and worker; @buyong/redact runtime dependency; no platform binaries or bundled Pi dependencies",
);
