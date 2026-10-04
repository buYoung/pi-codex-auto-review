import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import {
    nativeSourceDigest,
    repository as root,
    stageNativeArtifact,
} from "./native-artifact.mjs";

const target = resolve(root, "tmp", "execpolicy-target");
const suffix = process.platform === "win32" ? ".exe" : "";
const sourceDigest = await nativeSourceDigest();
const result = spawnSync(
    "cargo",
    [
        "build",
        "--locked",
        "--release",
        "--manifest-path",
        join(root, "native/execpolicy/Cargo.toml"),
        "--target-dir",
        target,
    ],
    { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
await stageNativeArtifact(
    join(target, `release/pi-guard-execpolicy${suffix}`),
    sourceDigest,
);
