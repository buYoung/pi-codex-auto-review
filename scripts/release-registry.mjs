import semver from "semver";

/** Reads public registry metadata without loading local npm credentials. */
export async function readPublishedVersions(packageName) {
    const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        { signal: AbortSignal.timeout(15_000) },
    );
    if (response.status === 404) return new Set();
    if (!response.ok)
        throw new Error(
            `${packageName}의 npm 등록 상태를 확인하지 못했습니다: HTTP ${response.status}`,
        );
    const metadata = await response.json();
    return new Set(Object.keys(metadata.versions ?? {}));
}

export async function verifyPublishedWorkspaceDependencies(
    manifest,
    workspaceNames,
) {
    for (const [name, range] of Object.entries(manifest.dependencies ?? {})) {
        if (!workspaceNames.has(name)) continue;
        const versions = await readPublishedVersions(name);
        if (![...versions].some((version) => semver.satisfies(version, range)))
            throw new Error(
                `${manifest.name}의 의존 패키지 ${name}@${range}가 npm에 없습니다. ${name}을 먼저 게시하고 다시 릴리스하세요. 등록 절차: docs/publishing.ko.md`,
            );
    }
}
