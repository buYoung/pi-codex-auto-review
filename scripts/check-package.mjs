import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const requiredFiles = {
    "@buyong/pi-codex-auto-review": [
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
    ],
    "@buyong/pi-codex-computer-use": [
        "dist/index.js",
        "dist/index.d.ts",
        "dist/connection.js",
        "dist/runtime.js",
        "dist/tools.js",
        "dist/turn.js",
        "dist/elicitation.js",
        "dist/active-call.js",
        "dist/browser-checks.js",
        "dist/commands.js",
        "dist/install.js",
        "dist/log.js",
        "dist/settings.js",
        "dist/settings-ui.js",
        "dist/platform.js",
        "README.md",
        "README.ko.md",
        "LICENSE",
        "NOTICE",
        "docs/computer-use/usage.md",
        "docs/computer-use/usage.ko.md",
    ],
};

async function verifyPackage(packageDirectory) {
    const manifest = JSON.parse(
        readFileSync(join(packageDirectory, "package.json"), "utf8"),
    );
    const expected = requiredFiles[manifest.name];
    assert.ok(expected, `Unknown package: ${manifest.name}`);
    // A root-level check also works outside prepack. Stage only missing shared files and remove
    // only what this invocation copied; package-local READMEs and prepack's files stay intact.
    const shared =
        manifest.sharedFiles ??
        manifest.files.filter((path) => !path.startsWith("dist/"));
    const staged = [];
    try {
        for (const path of shared) {
            const target = join(packageDirectory, path);
            if (existsSync(target)) continue;
            mkdirSync(dirname(target), { recursive: true });
            copyFileSync(join(repository, path), target);
            staged.push(target);
        }
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
        for (const path of expected)
            assert.ok(
                files.has(path),
                `${manifest.name}: missing package file: ${path}`,
            );
        assert.ok(
            ![...files].some(
                (path) =>
                    /^(src|test|tmp|vendor|native|node_modules)\//.test(path) ||
                    /^dist\/(sandbox|native)\//.test(path) ||
                    /\.(node|wasm|exe)$/.test(path) ||
                    /(^|\/)(cua_node|@oai)(\/|$)|\.app(\/|$)/.test(path),
            ),
            "The package must not contain native binaries, development dependencies, or OpenAI runtime files",
        );
        if (manifest.name === "@buyong/pi-codex-auto-review") {
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
        } else {
            // The new package has an exact allow-list: all compiled JS/declarations/maps plus its
            // own docs. Repository briefs, runtime copies and build configuration cannot sneak in.
            const docs = new Set(
                expected.filter((path) => !path.startsWith("dist/")),
            );
            assert.ok(
                [...files].every(
                    (path) =>
                        path === "package.json" ||
                        docs.has(path) ||
                        /^dist\/.+\.(js|d\.ts|js\.map)$/.test(path),
                ),
                `${manifest.name}: unexpected archive file`,
            );
            assert.deepEqual(manifest.pi.extensions, ["./dist/index.js"]);
            assert.equal(manifest.publishConfig.access, "public");
        }
        // Lifecycle hooks must not contaminate `npm pack --json` on stdout.
        console.error(
            `${manifest.name}: package verified (${files.size} files); no bundled runtimes or host dependencies`,
        );
    } finally {
        for (const path of staged) rmSync(path, { force: true });
    }
}

const argument = process.argv[2];
const cwdManifest = join(process.cwd(), "package.json");
const cwdName = existsSync(cwdManifest)
    ? JSON.parse(readFileSync(cwdManifest, "utf8")).name
    : undefined;
const directories = argument
    ? [resolve(argument)]
    : requiredFiles[cwdName]
      ? [process.cwd()]
      : Object.keys(requiredFiles)
            .map((name) => join(repository, "packages", name.split("/").at(-1)))
            .filter((directory) => existsSync(join(directory, "package.json")));
for (const directory of directories) await verifyPackage(directory);
