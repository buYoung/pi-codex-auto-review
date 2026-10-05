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
