import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cp, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
    createRun,
    reportRoot,
    repository,
    writeImmutable,
} from "./evidence-store.mjs";
import { contractDigest, sourceDigest } from "./run-tests.mjs";

const args = process.argv.slice(2),
    options = {
        mode: "offline",
        platform: "linux/amd64",
        model: process.env.OLLAMA_MODEL,
    };
for (let i = 0; i < args.length; i++) {
    if (
        !["--mode", "--platform", "--model", "--image"].includes(args[i]) ||
        !args[i + 1]
    )
        throw new Error(
            "Usage: npm run verify:docker -- --mode offline|live|conformance --platform linux/amd64|linux/arm64 [--model ID] [--image sha256:ID]",
        );
    options[args[i].slice(2)] = args[++i];
}
if (
    !["offline", "live", "conformance"].includes(options.mode) ||
    !["linux/amd64", "linux/arm64"].includes(options.platform)
)
    throw new Error("Unsupported Docker verification mode or platform");
const source = await sourceDigest(),
    contract = await contractDigest(),
    platform = options.platform === "linux/amd64" ? "linux-x64" : "linux-arm64";
const run = await createRun({
    platform,
    sourceDigest: source,
    contractDigest: contract,
    provenance: "orchestration",
    mode: options.mode,
    command: `npm run verify:docker -- --mode ${options.mode} --platform ${options.platform}${options.model ? ` --model ${options.model}` : ""}`,
});
const ownedName = `pi-auto-review-${randomUUID()}`,
    context = join(run.directory, "build-context");
let containerId,
    imageDigest = options.image,
    dockerHostArchitecture,
    kernelArchitecture,
    dockerSecurityOptions,
    outerAppArmorProfile,
    containerResult,
    errorMessage,
    isInterrupted = false,
    isExecutionTimedOut = false,
    isContainerRemoved = false;
let hasAppArmor = false;
const children = new Set();
const safe = (value) =>
    String(value)
        .split(process.env.OLLAMA_API_KEY || "\0")
        .join("[REDACTED]");
async function docker(
    args,
    { log, timeoutMs = 600000, isLive = false, allowFailure = false } = {},
) {
    const env = { ...process.env };
    if (!isLive) delete env.OLLAMA_API_KEY;
    const child = spawn("docker", args, {
        cwd: repository,
        env,
        stdio: ["ignore", "pipe", "pipe"],
    });
    children.add(child);
    let output = "",
        errors = "",
        hasTimedOut = false;
    const timer = setTimeout(() => {
        hasTimedOut = true;
        child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.length > 20000000) {
            output = output.slice(-20000000);
        }
    });
    child.stderr.on("data", (chunk) => {
        errors += chunk;
        if (errors.length > 20000000) {
            errors = errors.slice(-20000000);
        }
    });
    let code;
    try {
        code = await new Promise((resolve, reject) => {
            child.on("error", reject);
            child.on("close", resolve);
        });
    } finally {
        clearTimeout(timer);
        children.delete(child);
    }
    if (log)
        await writeImmutable(
            join(run.directory, log),
            safe(`${output}\n${errors}`),
        );
    if ((code !== 0 || hasTimedOut) && !allowFailure)
        throw new Error(
            safe(
                `Docker ${args[0]} ${hasTimedOut ? "timed out" : `exited ${code}`}: ${errors.slice(-2500)}`,
            ),
        );
    return { code, hasTimedOut, stdout: output.trim(), stderr: errors.trim() };
}
function interrupt() {
    isInterrupted = true;
    for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
try {
    dockerHostArchitecture = (
        await docker(["info", "--format", "{{.Architecture}}"], {
            timeoutMs: 30000,
        })
    ).stdout;
    kernelArchitecture = {
        aarch64: "arm64",
        arm64: "arm64",
        x86_64: "x64",
        amd64: "x64",
    }[dockerHostArchitecture];
    if (!kernelArchitecture)
        throw new Error(
            "ENVIRONMENT_BLOCKED: unsupported Docker kernel architecture",
        );
    dockerSecurityOptions = JSON.parse(
        (
            await docker(["info", "--format", "{{json .SecurityOptions}}"], {
                timeoutMs: 30000,
            })
        ).stdout,
    );
    if (
        !Array.isArray(dockerSecurityOptions) ||
        dockerSecurityOptions.some((option) => typeof option !== "string")
    )
        throw new Error(
            "ENVIRONMENT_BLOCKED: Docker security capabilities could not be identified",
        );
    hasAppArmor = dockerSecurityOptions.some((option) =>
        /^name=apparmor(?:,|$)/.test(option),
    );
    if (
        options.mode !== "offline" &&
        (!process.env.OLLAMA_API_KEY || !options.model)
    )
        throw new Error(
            "ENVIRONMENT_BLOCKED: live verification requires runtime OLLAMA_API_KEY and a selected OLLAMA_MODEL / --model",
        );
    if (!imageDigest) {
        await mkdir(context, { recursive: true });
        // Explicit allowlist: no host credentials, .env, .git, node_modules or old reports enter the build context.
        for (const path of [
            "src",
            "test",
            "scripts",
            "native",
            ".github",
            "docs",
            "package.json",
            "package-lock.json",
            "tsconfig.json",
            "README.md",
            "LICENSE",
            "NOTICE",
        ])
            await cp(join(repository, path), join(context, path), {
                recursive: true,
                errorOnExist: true,
                force: false,
            });
        const imageTag = `pi-codex-auto-review-test:${run.runId.toLowerCase()}`;
        console.log(
            `Building ${options.platform}; evidence ${run.artifactPath}`,
        );
        await docker(
            [
                "build",
                "--platform",
                options.platform,
                "--file",
                join(context, "test/docker/Dockerfile"),
                "--build-arg",
                `SOURCE_DIGEST=${source}`,
                "--tag",
                imageTag,
                context,
            ],
            { log: "build.log" },
        );
        imageDigest = (
            await docker(
                ["image", "inspect", "--format", "{{.Id}}", imageTag],
                {
                    timeoutMs: 30000,
                },
            )
        ).stdout;
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(imageDigest))
        throw new Error("An immutable Docker image ID is required");
    const imageSource = (
        await docker(
            [
                "image",
                "inspect",
                "--format",
                '{{index .Config.Labels "org.pi-codex-auto-review.source"}}',
                imageDigest,
            ],
            { timeoutMs: 30000 },
        )
    ).stdout;
    if (imageSource !== source)
        throw new Error(
            "Docker image does not match the current source; rebuild before verifying",
        );
    const imagePlatform = (
        await docker(
            [
                "image",
                "inspect",
                "--format",
                "{{.Os}}/{{.Architecture}}",
                imageDigest,
            ],
            { timeoutMs: 30000 },
        )
    ).stdout;
    if (imagePlatform !== options.platform)
        throw new Error(
            "Docker image architecture does not match the requested platform",
        );
    const create = [
        "create",
        "--init",
        "--platform",
        options.platform,
        "--name",
        ownedName,
        "--label",
        "org.pi-codex-auto-review.verification=true",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--pids-limit=256",
        "--memory=2g",
        "--network",
        options.mode === "offline" ? "none" : "bridge",
        "--env",
        "PI_OLLAMA_WEB_TOOLS=0",
        "--env",
        `PI_GUARD_IMAGE_DIGEST=${imageDigest}`,
    ];
    if (options.mode !== "offline")
        create.push(
            "--env",
            "OLLAMA_API_KEY",
            "--env",
            `OLLAMA_MODEL=${options.model}`,
        );
    containerId = (
        await docker([...create, imageDigest, options.mode], {
            timeoutMs: 30000,
            isLive: options.mode !== "offline",
        })
    ).stdout;
    if (!/^[a-f0-9]{64}$/.test(containerId))
        throw new Error("Docker did not return a container identity");
    outerAppArmorProfile = (
        await docker(
            ["inspect", "--format", "{{.AppArmorProfile}}", containerId],
            {
                timeoutMs: 30000,
            },
        )
    ).stdout;
    console.log(
        `Running ${options.mode} in ${options.platform}; container ${containerId.slice(0, 12)}`,
    );
    const execution = await docker(["start", "--attach", containerId], {
        log: "container.log",
        isLive: options.mode !== "offline",
        allowFailure: true,
        timeoutMs: 900000,
    });
    isExecutionTimedOut = execution.hasTimedOut;
    if (execution.code !== 0 || execution.hasTimedOut)
        errorMessage = `Container ${execution.hasTimedOut ? "timed out" : `exited ${execution.code}`}; see retained container.log`;
} catch (error) {
    errorMessage = safe(error.message);
} finally {
    if (containerId) {
        try {
            if (isInterrupted || isExecutionTimedOut)
                await docker(["stop", "--time", "5", containerId], {
                    allowFailure: true,
                    timeoutMs: 15000,
                });
            const exported = join(run.directory, "exported");
            await mkdir(exported, { recursive: true });
            const copied = await docker(
                [
                    "cp",
                    `${containerId}:/opt/pi-guard/.reports/pi-guard/runs/.`,
                    exported,
                ],
                { allowFailure: true, timeoutMs: 30000 },
            );
            if (copied.code === 0) {
                for (const entry of await readdir(exported, {
                    withFileTypes: true,
                })) {
                    if (!entry.isDirectory()) continue;
                    const destination = join(reportRoot, "runs", entry.name);
                    await cp(join(exported, entry.name), destination, {
                        recursive: true,
                        errorOnExist: true,
                        force: false,
                    });
                    const recordPath = join(
                        destination,
                        platform,
                        `docker-${options.mode}.json`,
                    );
                    try {
                        containerResult = JSON.parse(
                            await readFile(recordPath, "utf8"),
                        );
                    } catch {}
                }
            }
        } catch (error) {
            errorMessage = safe(`Evidence export failed: ${error.message}`);
        } finally {
            try {
                isContainerRemoved =
                    (
                        await docker(["rm", "--force", containerId], {
                            timeoutMs: 30000,
                            allowFailure: true,
                        })
                    ).code === 0;
            } catch {
                isContainerRemoved = false;
            }
        }
    }
    await rm(context, { recursive: true, force: true });
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
}
const isStable =
    source === (await sourceDigest()) && contract === (await contractDigest());
const usesArchitectureEmulation = !(
    options.platform === "linux/amd64"
        ? ["x86_64", "amd64"]
        : ["aarch64", "arm64"]
).includes(dockerHostArchitecture);
const status = isInterrupted
    ? "environment-blocked"
    : !isStable ||
        (containerId && !isContainerRemoved) ||
        (errorMessage && containerResult?.status === "pass")
      ? "fail"
      : (containerResult?.status ??
        (errorMessage?.includes("ENVIRONMENT_BLOCKED")
            ? "environment-blocked"
            : "fail"));
const report = {
    schemaVersion: 2,
    status,
    sourceDigest: source,
    contractDigest: contract,
    mode: options.mode,
    targetPlatform: options.platform,
    dockerHostArchitecture,
    kernelArchitecture,
    dockerSecurityOptions,
    usesArchitectureEmulation,
    imageDigest,
    containerId,
    containerRemoved: isContainerRemoved,
    containerResult: containerResult?.artifactPath,
    packageIdentity: containerResult?.identity,
    provider: containerResult?.provider,
    executionCapabilities: containerResult?.executionCapabilities,
    command: run.command,
    envNames:
        options.mode === "offline"
            ? ["PI_OLLAMA_WEB_TOOLS"]
            : ["OLLAMA_API_KEY", "OLLAMA_MODEL", "PI_OLLAMA_WEB_TOOLS"],
    outerContainer: {
        init: true,
        pidsLimit: 256,
        capabilities: "all dropped",
        noNewPrivileges: true,
        seccomp: "daemon default",
        systemPaths: "daemon default",
        apparmor: {
            enabledOnDaemon: hasAppArmor,
            requested: "daemon default",
            effectiveProfile: outerAppArmorProfile,
        },
        hostMounts: [],
        publishedPorts: [],
    },
    blockedReasons: [
        ...(containerResult?.blockedReasons ?? []),
        ...(errorMessage ? [errorMessage] : []),
        ...(!isStable ? ["Source changed while Docker verification ran"] : []),
        ...(containerId && !isContainerRemoved
            ? ["Owned container cleanup failed"]
            : []),
    ],
    recordedAt: new Date().toISOString(),
};
await writeImmutable(join(run.directory, "docker-orchestration.json"), report);
console.log(
    JSON.stringify(
        {
            ...report,
            artifactPath: `${run.artifactPath}/docker-orchestration.json`,
        },
        null,
        2,
    ),
);
if (status !== "pass") process.exitCode = 1;
