import { Plugin } from "release-it";

/**
 * Records the bumped workspace version in the shared root lockfile.
 * Runs as a plugin, not a hook: release-it shows an ora spinner for hooks,
 * which stalls the event loop after the Inquirer prompts.
 */
export default class WorkspaceLockfile extends Plugin {
    async beforeRelease() {
        const { root } = this.options;
        await this.exec([
            "npm",
            "install",
            "--package-lock-only",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--prefix",
            root,
        ]);
        await this.exec(["git", "-C", root, "add", "--", "package-lock.json"]);
    }
}
