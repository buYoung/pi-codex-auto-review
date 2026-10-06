import { globSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";

/** Workspace manifests are authoritative even when node_modules is stale. */
export function listPublishablePackages(root) {
    const { workspaces } = JSON.parse(
        readFileSync(join(root, "package.json"), "utf8"),
    );
    const manifests = new Set(
        globSync(
            workspaces.map((pattern) => `${pattern}/package.json`),
            {
                cwd: root,
            },
        ),
    );
    return [...manifests]
        .map((location) => {
            const manifestPath = join(root, location);
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
            return {
                name: manifest.name,
                path: realpathSync(dirname(manifestPath)),
                isPrivate: manifest.private === true,
            };
        })
        .filter((workspace) => !workspace.isPrivate)
        .sort((a, b) => a.name.localeCompare(b.name));
}

/** Packing uses workspace sources, so runtime pins must match their manifests. */
export function validateWorkspaceDependencyVersions(manifest, workspaces) {
    const paths = new Map(
        workspaces.map((workspace) => [workspace.name, workspace.path]),
    );
    for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
        const path = paths.get(name);
        if (!path) continue;
        const { version } = JSON.parse(
            readFileSync(join(path, "package.json"), "utf8"),
        );
        if (range !== version)
            throw new Error(
                `${manifest.name}의 의존 버전 ${name}@${range}가 작업 공간 ${version}과 다릅니다. 소비 패키지의 dependencies와 루트 package-lock.json을 갱신한 뒤 릴리스하세요.`,
            );
    }
}
