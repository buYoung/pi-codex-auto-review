import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    realpathSync,
    renameSync,
    rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";
import { listPublishablePackages } from "./release-packages.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const packageDirectory = join(repository, "packages/pi-codex");
const readManifest = (directory) =>
    JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
const workspaces = new Map(
    listPublishablePackages(repository).map(({ name, path }) => [name, path]),
);
const manifest = readManifest(packageDirectory);
assert.deepEqual(
    manifest.bundleDependencies,
    Object.keys(manifest.dependencies),
);

function resolveDependency(name, directory) {
    for (let parent = directory; ; parent = dirname(parent)) {
        const candidate = join(parent, "node_modules", name);
        if (existsSync(join(candidate, "package.json")))
            return realpathSync(candidate);
        if (parent === dirname(parent))
            throw new Error(`실행 의존성을 찾을 수 없습니다: ${name}`);
    }
}

// Copy npm's published file set into a physical dependency tree. Packing workspace
// symlinks directly can otherwise give hoisted transitive dependencies ../ paths.
const staging = mkdtempSync(join(packageDirectory, ".package-"));
const dependencies = new Map();
function stageDependency(name, range, parentDirectory) {
    const directory =
        workspaces.get(name) ?? resolveDependency(name, parentDirectory);
    const dependency = readManifest(directory);
    assert.equal(dependency.name, name);
    assert.ok(
        semver.satisfies(dependency.version, range),
        `${name}@${dependency.version}은 ${range}에 맞지 않습니다. npm install을 실행하세요.`,
    );
    if (dependencies.has(name)) {
        assert.equal(
            dependencies.get(name),
            dependency.version,
            `통합 패키지에 서로 다른 ${name} 버전을 포함할 수 없습니다.`,
        );
        return;
    }
    dependencies.set(name, dependency.version);
    const [packed] = JSON.parse(
        execFileSync(
            process.platform === "win32" ? "npm.cmd" : "npm",
            ["pack", "--dry-run", "--json", "--ignore-scripts"],
            {
                cwd: directory,
                encoding: "utf8",
                maxBuffer: 16 * 1024 * 1024,
                shell: process.platform === "win32",
                stdio: ["ignore", "pipe", "pipe"],
            },
        ),
    );
    const files = new Map(
        packed.files.map(({ path }) => [path, join(directory, path)]),
    );
    if (workspaces.get(name) === directory) {
        const shared =
            dependency.sharedFiles ??
            dependency.files.filter((path) => !path.startsWith("dist/"));
        for (const path of shared) files.set(path, join(repository, path));
    }
    for (const [path, source] of files) {
        const target = join(staging, name, path);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
    }
    for (const [childName, childRange] of Object.entries(
        dependency.dependencies ?? {},
    ))
        stageDependency(childName, childRange, directory);
}

try {
    for (const [name, range] of Object.entries(manifest.dependencies))
        stageDependency(name, range, packageDirectory);
    rmSync(join(packageDirectory, "node_modules"), {
        recursive: true,
        force: true,
    });
    renameSync(staging, join(packageDirectory, "node_modules"));
    console.error(`통합 패키지 준비 완료: 실행 의존성 ${dependencies.size}개`);
} finally {
    rmSync(staging, { recursive: true, force: true });
}
