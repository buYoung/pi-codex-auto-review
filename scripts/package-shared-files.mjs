import { copyFile, mkdir, readFile, rm, rmdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// npm pack only reads the package directory, so repository documents listed in
// "files" are copied in by prepack and removed again by postpack.
const repository = fileURLToPath(new URL("../", import.meta.url));
const packageDirectory = process.cwd();
const { files } = JSON.parse(
    await readFile(join(packageDirectory, "package.json"), "utf8"),
);
const sharedFiles = files.filter((path) => !path.startsWith("dist/"));
const mode = process.argv[2];

if (mode === "copy") {
    for (const path of sharedFiles) {
        await mkdir(dirname(join(packageDirectory, path)), { recursive: true });
        await copyFile(join(repository, path), join(packageDirectory, path));
    }
} else if (mode === "remove") {
    await Promise.all(
        sharedFiles.map((path) =>
            rm(join(packageDirectory, path), { force: true }),
        ),
    );
    const directories = [
        ...new Set(
            sharedFiles.flatMap((path) => {
                const parents = [];
                for (let parent = dirname(path); parent !== "."; ) {
                    parents.push(parent);
                    parent = dirname(parent);
                }
                return parents;
            }),
        ),
    ].sort((a, b) => b.length - a.length);
    for (const directory of directories) {
        await rmdir(join(packageDirectory, directory)).catch((error) => {
            if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
        });
    }
} else {
    throw new Error("Usage: node package-shared-files.mjs <copy|remove>");
}
