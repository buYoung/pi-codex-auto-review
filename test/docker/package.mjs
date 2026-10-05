import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { contractDigest, sourceDigest } from "../../scripts/run-tests.mjs";

const exec = promisify(execFile),
    artifacts = "/opt/guard-artifacts",
    consumer = "/opt/installed";
await mkdir(artifacts, { recursive: true });
await mkdir(consumer, { recursive: true });
// Lifecycle scripts stay off, so add the repository documents prepack would copy.
await exec("node", ["../../scripts/package-shared-files.mjs", "copy"], {
    cwd: "packages/pi-codex-auto-review",
});
const [packed] = JSON.parse(
    (
        await exec("npm", [
            "pack",
            "--workspace",
            "packages/pi-codex-auto-review",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            artifacts,
        ])
    ).stdout,
);
const tarball = join(artifacts, packed.filename);
await exec("tar", ["-xzf", tarball, "-C", consumer]);
await mkdir(join(consumer, "package/node_modules"), { recursive: true });
// Install the runtime dependency from its own packed artifact, as npm would.
const [redactPacked] = JSON.parse(
    (
        await exec("npm", [
            "pack",
            "--workspace",
            "packages/redact",
            "--ignore-scripts",
            "--json",
            "--pack-destination",
            artifacts,
        ])
    ).stdout,
);
const redactTarball = join(artifacts, redactPacked.filename),
    redactDirectory = join(consumer, "package/node_modules/@buyong/redact");
await mkdir(redactDirectory, { recursive: true });
await exec("tar", [
    "-xzf",
    redactTarball,
    "-C",
    redactDirectory,
    "--strip-components=1",
]);
await symlink(
    "/opt/pi-guard/node_modules/@earendil-works",
    join(consumer, "package/node_modules/@earendil-works"),
);
const packages = {};
for (const name of ["@earendil-works/pi-coding-agent", "pi-ollama-cloud"]) {
    const pkg = JSON.parse(
        await readFile(join("node_modules", name, "package.json"), "utf8"),
    );
    packages[name] = pkg.version;
}
await writeFile(
    join(artifacts, "identity.json"),
    `${JSON.stringify(
        {
            sourceDigest: await sourceDigest(),
            contractDigest: await contractDigest(),
            packages,
            plugin: {
                name: packed.name,
                version: packed.version,
                sha256: createHash("sha256")
                    .update(await readFile(tarball))
                    .digest("hex"),
                integrity: packed.integrity,
            },
            runtimeDependencies: {
                [redactPacked.name]: {
                    version: redactPacked.version,
                    sha256: createHash("sha256")
                        .update(await readFile(redactTarball))
                        .digest("hex"),
                    integrity: redactPacked.integrity,
                },
            },
            installation:
                "npm ci with locked provider; npm pack artifacts of the plugin and its runtime dependency extracted into an isolated SDK consumer with explicitly linked host peers",
        },
        null,
        2,
    )}\n`,
);
