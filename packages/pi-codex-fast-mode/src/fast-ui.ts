import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Key, matchesKey, Text } from "@earendil-works/pi-tui";
import type { ServiceTier } from "./config.js";

const MODES = ["fast", "ultrafast"] as const;

/** Tab and Enter toggle immediately; failed saves keep the displayed value unchanged. */
export async function showFastSettings(
    ctx: ExtensionCommandContext,
    getDesiredTier: () => ServiceTier,
    setTier: (tier: ServiceTier) => Promise<void>,
): Promise<void> {
    if (ctx.mode !== "tui") {
        for (;;) {
            const choices = [
                ...MODES.map(
                    (mode) =>
                        `${mode}: ${getDesiredTier() === mode ? "on" : "off"}`,
                ),
                "Close",
            ];
            const choice = await ctx.ui.select("Codex Fast", choices);
            const mode = MODES[choices.indexOf(choice ?? "")];
            if (!mode) return;
            await setTier(getDesiredTier() === mode ? "standard" : mode);
        }
    }
    return ctx.ui.custom<void>((tui, theme, keybindings, done) => {
        let selectedModeIndex = 0;
        let isBusy = false;
        let isClosed = false;
        let shouldCloseAfterSave = false;
        let errorMessage: string | undefined;
        const close = () => {
            if (isClosed) return;
            if (isBusy) {
                shouldCloseAfterSave = true;
                return;
            }
            isClosed = true;
            done();
        };
        const toggle = async () => {
            const mode = MODES[selectedModeIndex];
            const nextTier = getDesiredTier() === mode ? "standard" : mode;
            isBusy = true;
            errorMessage = undefined;
            tui.requestRender();
            try {
                await setTier(nextTier);
            } catch (error) {
                errorMessage =
                    error instanceof Error ? error.message : String(error);
            } finally {
                isBusy = false;
                if (!isClosed) {
                    if (shouldCloseAfterSave) close();
                    else tui.requestRender();
                }
            }
        };
        return {
            render: (width) => {
                const option = (label: string, isSelected: boolean) =>
                    isSelected
                        ? theme.fg("accent", theme.bold(`[${label}]`))
                        : theme.fg("muted", ` ${label} `);
                return new Text(
                    [
                        theme.bold("Codex Fast"),
                        "",
                        ...MODES.map((mode, index) => {
                            const isEnabled = getDesiredTier() === mode;
                            const label =
                                mode === "fast" ? "Fast" : "Ultrafast";
                            const marker =
                                index === selectedModeIndex ? "›" : " ";
                            return `${marker} ${label}: ${option("off", !isEnabled)}  ${option("on", isEnabled)}`;
                        }),
                        "",
                        "Enabling one mode disables the other; both off selects Standard.",
                        theme.fg(
                            "dim",
                            "↑/↓ select · Tab/Enter toggle · Esc close",
                        ),
                        ...(isBusy ? [theme.fg("muted", "Applying…")] : []),
                        ...(errorMessage
                            ? [
                                  theme.fg(
                                      "error",
                                      `Change failed: ${errorMessage}`,
                                  ),
                              ]
                            : []),
                    ].join("\n"),
                    1,
                    1,
                ).render(width);
            },
            handleInput: (data) => {
                if (isClosed) return;
                if (keybindings.matches(data, "tui.select.cancel")) {
                    close();
                } else if (
                    !isBusy &&
                    (matchesKey(data, Key.up) || matchesKey(data, Key.down))
                ) {
                    selectedModeIndex = (selectedModeIndex + 1) % MODES.length;
                    errorMessage = undefined;
                    tui.requestRender();
                } else if (
                    !isBusy &&
                    (matchesKey(data, Key.enter) ||
                        matchesKey(data, Key.tab) ||
                        matchesKey(data, Key.shift("tab")) ||
                        matchesKey(data, Key.left) ||
                        matchesKey(data, Key.right))
                ) {
                    void toggle();
                }
            },
            invalidate: () => {},
            dispose: () => {
                isClosed = true;
            },
        };
    });
}
