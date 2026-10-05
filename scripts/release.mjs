import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { input, select } from "@inquirer/prompts";
import release, { Config } from "release-it";
import semver from "semver";
import {
    InquirerPrompt,
    ReleaseStopped,
    requireAnswer,
} from "./release-prompts.mjs";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const guardPath = fileURLToPath(
    new URL("./release-prompts.mjs", import.meta.url),
);
const lockfilePath = fileURLToPath(
    new URL("./release-lockfile.mjs", import.meta.url),
);
const prompt = new InquirerPrompt();
const interactiveOptions = {
    ci: false,
    "only-version": false,
    "release-version": false,
    changelog: false,
    "dry-run": false,
    snapshot: false,
    preRelease: false,
};
let selectedPackage;
const readCurrentVersion = () =>
    JSON.parse(readFileSync(join(selectedPackage.path, "package.json"), "utf8"))
        .version;
const git = (...args) =>
    execFileSync("git", args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    }).trim();
let headBefore;
let hasReportedReleaseError = false;

function listPublishablePackages() {
    const workspaces = JSON.parse(
        execFileSync("npm", ["query", ".workspace"], {
            cwd: root,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
            shell: process.platform === "win32",
        }),
    );
    return (
        workspaces
            .filter((workspace) => workspace.private !== true)
            // npm redacts UUID-like segments in printed absolute paths, so use location.
            .map(({ name, location }) => ({
                name,
                path: realpathSync(join(root, location)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
    );
}

async function choosePackage() {
    const packages = listPublishablePackages();
    if (!packages.length)
        throw new Error("릴리스할 수 있는 작업 공간 패키지가 없습니다.");
    return requireAnswer(
        select({
            message: "릴리스할 패키지를 선택하세요.",
            choices: packages.map((workspace) => ({
                value: workspace,
                name: `${workspace.name} (${relative(root, workspace.path)})`,
            })),
        }),
        "패키지",
    );
}

function hasLocalTag(tagName) {
    try {
        git("show-ref", "--verify", "--quiet", "--", `refs/tags/${tagName}`);
        return true;
    } catch (error) {
        if (error.status === 1) return false;
        throw error;
    }
}

async function chooseVersion(currentVersion) {
    const increments = [
        ["patch", "패치"],
        ["minor", "마이너"],
        ["prepatch", "시험 패치", "alpha"],
        ["preminor", "시험 마이너", "beta"],
        [
            "prerelease",
            "시험 버전 번호 증가",
            semver.prerelease(currentVersion)?.[0] || "rc",
        ],
        ["major", "메이저"],
        ["premajor", "시험 메이저", "alpha"],
    ];
    const choices = increments
        .map(([increment, label, identifier]) => {
            const version = semver.inc(
                currentVersion,
                increment,
                String(identifier || ""),
            );
            return {
                value: version,
                name: `${label}: ${currentVersion} → ${version}`,
            };
        })
        .filter(
            (choice) => choice.value && semver.gt(choice.value, currentVersion),
        );
    if (!hasLocalTag(`${selectedPackage.name}@${currentVersion}`)) {
        choices.unshift({
            value: currentVersion,
            name: `현재 준비 버전 ${currentVersion} 출시 (첫 태그 생성)`,
        });
    }
    const selected = await requireAnswer(
        select({
            message: `${selectedPackage.name}의 릴리스 버전을 선택하세요. 현재 버전: ${currentVersion}`,
            choices: [
                ...choices,
                { value: "custom", name: "다음 버전 직접 입력" },
            ],
        }),
        "버전",
    );
    if (selected !== "custom") return selected;
    const entered = await requireAnswer(
        input({
            message: `다음 버전 (현재 ${currentVersion})`,
            validate: (value) =>
                !semver.valid(value) ||
                !semver.gt(value, currentVersion) ||
                semver.parse(value).build.length
                    ? `${currentVersion}보다 큰 SemVer를 입력하세요. 빌드 메타데이터는 사용할 수 없습니다.`
                    : true,
        }),
        "버전",
    );
    return semver.valid(entered);
}

function reportState() {
    if (!headBefore) return;
    try {
        console.info(
            `시작 HEAD: ${headBefore}\n현재 HEAD: ${git("rev-parse", "HEAD")}`,
        );
        console.info(
            `남은 파일·인덱스 변경:\n${git("status", "--short") || "(없음)"}`,
        );
        console.info(`현재 파일 버전: ${readCurrentVersion()}`);
        if (prompt.tagName) {
            console.info(
                `로컬 태그 ${prompt.tagName}: ${hasLocalTag(prompt.tagName) ? git("rev-parse", `refs/tags/${prompt.tagName}`) : "(없음)"}`,
            );
        }
        console.info(
            prompt.completed.includes("push")
                ? "푸시 명령을 완료했습니다. npm 게시 결과는 GitHub Actions에서 확인하세요."
                : prompt.attempted.includes("push")
                  ? "푸시를 시도했습니다. 원격 상태를 확인하세요."
                  : "푸시는 실행하지 않았습니다.",
        );
    } catch (error) {
        console.warn(
            `남은 릴리스 상태를 모두 확인하지 못했습니다: ${error.message}`,
        );
    }
}

try {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error(
            "대화형 터미널에서 pnpm release를 실행하세요. 릴리스 작업은 시작하지 않았습니다.",
        );
    }
    if (process.argv.length > 2)
        throw new Error(
            "인자 없이 pnpm release를 실행하고 메뉴에서 버전을 선택하세요.",
        );
    process.chdir(root);
    if (git("status", "--porcelain", "--untracked-files=no")) {
        throw new Error(
            "릴리스 전에 저장소의 수정 사항과 인덱스를 커밋해 주세요.",
        );
    }
    if (git("branch", "--show-current") !== "master")
        throw new Error("master 브랜치에서 릴리스를 실행하세요.");
    if (
        git("rev-parse", "--symbolic-full-name", "@{upstream}") !==
        "refs/remotes/origin/master"
    ) {
        throw new Error("릴리스 브랜치는 origin/master를 추적해야 합니다.");
    }
    selectedPackage = await choosePackage();
    for (const file of [
        relative(root, join(selectedPackage.path, "package.json")),
        "package-lock.json",
        ".release-it.json",
        "scripts/release.mjs",
        "scripts/release-prompts.mjs",
        "scripts/release-lockfile.mjs",
    ]) {
        git("ls-files", "--error-unmatch", "--", file);
    }
    headBefore = git("rev-parse", "HEAD");
    // release-it bumps the package.json in the current directory.
    process.chdir(selectedPackage.path);
    const config = new Config({
        config: join(root, ".release-it.json"),
        ...interactiveOptions,
    });
    await config.init();
    const options = config.getContext();
    if (
        !options.git?.commit ||
        !options.git.tag ||
        !options.git.push ||
        options.git.addUntrackedFiles ||
        options.npm?.publish !== false ||
        options.npm.ignoreVersion ||
        options.github?.release ||
        options.gitlab?.release
    ) {
        throw new Error(
            "로컬 릴리스는 package.json 버전 변경과 Git 커밋·태그·푸시만 수행해야 합니다.",
        );
    }
    const currentVersion = readCurrentVersion();
    if (
        !semver.valid(currentVersion) ||
        semver.parse(currentVersion).build.length
    )
        throw new Error(
            "package.json에 빌드 메타데이터 없는 SemVer가 필요합니다.",
        );
    const selectedVersion = await chooseVersion(currentVersion);
    const packageName = selectedPackage.name;
    const tagName = `${packageName}@${selectedVersion}`;
    try {
        await release(
            {
                ...options,
                config: false,
                extends: false,
                ...interactiveOptions,
                increment: selectedVersion,
                npm: {
                    ...options.npm,
                    allowSameVersion: selectedVersion === currentVersion,
                },
                git: {
                    ...options.git,
                    tagName: `${packageName}@\${version}`,
                    tagMatch: `${packageName}@[0-9]*`,
                    tagAnnotation: `${packageName} \${version}`,
                    commitMessage: `chore(${packageName} \${version} 릴리스): \${branchName}\n\n1. ${packageName} 패키지 버전 \${version}의 출시를 기록합니다.\n2. 버전 태그로 GitHub Actions의 npm 게시를 시작합니다.`,
                    requireCleanWorkingDir: false,
                    pushRepo: "",
                    commitArgs: [
                        ...options.git.commitArgs,
                        ...(selectedVersion === currentVersion
                            ? ["--allow-empty"]
                            : []),
                    ],
                    pushArgs: [
                        "--atomic",
                        "--no-follow-tags",
                        "origin",
                        "HEAD:refs/heads/master",
                        `refs/tags/${tagName}:refs/tags/${tagName}`,
                    ],
                },
                plugins: {
                    [guardPath]: { currentVersion, selectedVersion },
                    [lockfilePath]: { root },
                    ...options.plugins,
                },
            },
            { prompt },
        );
    } catch (error) {
        hasReportedReleaseError = true;
        throw error;
    }
    console.info(`${tagName} 릴리스 태그를 푸시했습니다.`);
} catch (error) {
    if (!hasReportedReleaseError) {
        if (error instanceof ReleaseStopped) console.info(error.message);
        else console.error(error.message);
    }
    process.exitCode = 1;
} finally {
    process.chdir(root);
    reportState();
}
