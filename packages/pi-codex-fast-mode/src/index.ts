import { join } from "node:path";
import {
    type ExtensionAPI,
    type ExtensionCommandContext,
    type ExtensionContext,
    getAgentDir,
} from "@earendil-works/pi-coding-agent";
import {
    DEFAULT_CONFIG,
    type FastConfig,
    FastSettingsStore,
    isServiceTier,
    type ServiceTier,
} from "./config.js";
import { FastController } from "./fast-controller.js";
import { showFastSettings } from "./fast-ui.js";

const SERVICE_TIER = "priority";
const COMMAND_NAME = "codex-fast";
const STATUS_KEY = "codex-fast-mode";
const SETTINGS_DIRECTORY = "codex-fast-mode";
const TIERS: readonly ServiceTier[] = ["standard", "fast", "ultrafast"];

export function defaultSettingsPath(): string {
    return join(getAgentDir(), SETTINGS_DIRECTORY, "settings.json");
}

function report(
    ctx: ExtensionContext,
    message: string,
    type: "info" | "warning" | "error" = "info",
): void {
    if (ctx.hasUI) ctx.ui.notify(message, type);
    else process.stderr.write(`${message}\n`);
}

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function completions(values: readonly string[], prefix: string) {
    const matches = values
        .filter((value) => value.startsWith(prefix.trim()))
        .map((value) => ({ value, label: value }));
    return matches.length ? matches : null;
}

export default function codexFastModeExtension(pi: ExtensionAPI): void {
    const fastController = new FastController(SERVICE_TIER);
    let cfg: FastConfig = { ...DEFAULT_CONFIG };
    let store: FastSettingsStore | undefined;

    const updateStatus = (ctx: ExtensionContext) => {
        ctx.ui.setStatus(STATUS_KEY, fastController.statusSegment(ctx, cfg));
    };
    const describeState = (ctx: ExtensionContext) => {
        const model = ctx.model
            ? `${ctx.model.provider}/${ctx.model.id}`
            : "No model selected";
        const application =
            fastController.desiredTier === "standard"
                ? "Standard mode"
                : fastController.active
                  ? "Active"
                  : "Unsupported by this model; preference retained";
        return `OpenAI service tier: ${fastController.desiredTier} · ${application} · ${model}`;
    };
    const persist = async () => {
        if (cfg.persistState && store)
            await store.persist(fastController.persistedState());
    };
    const changeTier = async (
        tier: ServiceTier,
        ctx: ExtensionCommandContext,
    ): Promise<void> => {
        await ctx.waitForIdle();
        if (tier === "ultrafast" && !fastController.supportsUltrafast(ctx)) {
            report(
                ctx,
                "Ultrafast requires openai/gpt-6-astra with the openai-responses API, API-key authentication without OAuth, and an HTTPS /v1 endpoint at api.openai.com or us.api.openai.com.",
                "warning",
            );
            return;
        }
        const previous = fastController.snapshot();
        if (tier === "ultrafast") fastController.setDesired(tier, ctx, cfg);
        else fastController.setActive(tier === "fast", ctx, cfg);
        try {
            await persist();
        } catch (error) {
            fastController.restore(previous);
            updateStatus(ctx);
            throw error;
        }
        updateStatus(ctx);
        report(
            ctx,
            `${describeState(ctx)}${cfg.persistState ? "" : " · This session only"}`,
        );
    };
    const runCommand = async (
        ctx: ExtensionCommandContext,
        action: () => Promise<void>,
    ) => {
        try {
            await action();
        } catch (error) {
            report(
                ctx,
                `Could not change Fast mode: ${describeError(error)}`,
                "error",
            );
        }
    };
    const changeMode = async (
        mode: "fast" | "ultrafast",
        isEnabled: boolean,
        ctx: ExtensionCommandContext,
    ) => {
        if (!isEnabled && fastController.desiredTier !== mode) {
            report(ctx, describeState(ctx));
            return;
        }
        await changeTier(isEnabled ? mode : "standard", ctx);
    };
    const openFastSettings = async (ctx: ExtensionCommandContext) => {
        if (!ctx.hasUI) {
            report(
                ctx,
                `${describeState(ctx)}\nUsage: /${COMMAND_NAME} fast on|off or /${COMMAND_NAME} ultrafast on|off`,
            );
            return;
        }
        await ctx.waitForIdle();
        await showFastSettings(
            ctx,
            () => fastController.desiredTier,
            (tier) => changeTier(tier, ctx),
        );
    };

    pi.registerFlag("fast", {
        description: "Start the session with Fast enabled on supported models.",
        type: "boolean",
        default: false,
    });
    pi.registerCommand(COMMAND_NAME, {
        description:
            "Toggle Fast and Ultrafast modes. Use Tab or Enter to switch on/off.",
        getArgumentCompletions: (prefix) =>
            completions(
                [
                    "on",
                    "off",
                    "fast on",
                    "fast off",
                    "ultrafast on",
                    "ultrafast off",
                ],
                prefix,
            ),
        handler: (args, ctx) =>
            runCommand(ctx, async () => {
                const value = args.trim();
                if (!value) return openFastSettings(ctx);
                if (value === "on" || value === "off") {
                    await changeTier(value === "on" ? "fast" : "standard", ctx);
                    return;
                }
                const [mode, state, extra] = value.split(/\s+/);
                if (
                    !extra &&
                    (mode === "fast" || mode === "ultrafast") &&
                    (state === "on" || state === "off")
                ) {
                    await changeMode(mode, state === "on", ctx);
                    return;
                }
                report(
                    ctx,
                    `Usage: /${COMMAND_NAME} [on|off] or /${COMMAND_NAME} <fast|ultrafast> <on|off>`,
                    "error",
                );
            }),
    });
    pi.registerCommand("openai-tier", {
        description:
            "Show or select the OpenAI service tier: standard, fast, or ultrafast.",
        getArgumentCompletions: (prefix) => completions(TIERS, prefix),
        handler: (args, ctx) =>
            runCommand(ctx, async () => {
                const value = args.trim();
                if (!value) {
                    fastController.applyDesiredState(ctx, cfg);
                    const last = fastController.lastPayloadInjection;
                    report(
                        ctx,
                        [
                            describeState(ctx),
                            `Settings: ${store?.settingsPath ?? defaultSettingsPath()}`,
                            cfg.persistState
                                ? "Mode changes are saved to the settings file."
                                : "Mode changes apply only to this session.",
                            last
                                ? `Last payload injection: ${last.at} · ${last.model} · ${last.tier} (request only; server processing and billing not verified)`
                                : "No service tier has been injected into a request during this session.",
                        ].join("\n"),
                    );
                    return;
                }
                if (!isServiceTier(value)) {
                    report(
                        ctx,
                        "Usage: /openai-tier [standard|fast|ultrafast]",
                        "error",
                    );
                    return;
                }
                await changeTier(value, ctx);
            }),
    });
    pi.registerCommand("openai-settings", {
        description: "Configure Fast mode and the OpenAI service tier.",
        getArgumentCompletions: (prefix) =>
            completions(
                [
                    "fast.enabled on",
                    "fast.enabled off",
                    ...TIERS.map((tier) => `serviceTier ${tier}`),
                ],
                prefix,
            ),
        handler: (args, ctx) =>
            runCommand(ctx, async () => {
                const words = args.trim().split(/\s+/).filter(Boolean);
                if (words.length) {
                    const [key, value] = words;
                    if (words.length === 2) {
                        if (key === "serviceTier" && isServiceTier(value))
                            return changeTier(value, ctx);
                        if (
                            key === "fast.enabled" &&
                            ["on", "off", "true", "false"].includes(value)
                        )
                            return changeMode(
                                "fast",
                                value === "on" || value === "true",
                                ctx,
                            );
                    }
                    report(
                        ctx,
                        "Usage: /openai-settings [fast.enabled on|off or serviceTier standard|fast|ultrafast]",
                        "error",
                    );
                    return;
                }
                if (!ctx.hasUI) {
                    report(ctx, describeState(ctx));
                    return;
                }
                await ctx.waitForIdle();
                const field = await ctx.ui.select("OpenAI settings", [
                    `fast.enabled: ${fastController.desiredTier === "fast" ? "on" : "off"}`,
                    `serviceTier: ${fastController.desiredTier}`,
                ]);
                if (field?.startsWith("fast.enabled:"))
                    return openFastSettings(ctx);
                if (!field?.startsWith("serviceTier:")) return;
                const tier = await ctx.ui.select("OpenAI service tier", [
                    ...TIERS,
                ]);
                if (isServiceTier(tier)) await changeTier(tier, ctx);
            }),
    });

    pi.on("session_start", async (_event, ctx) => {
        store = new FastSettingsStore(
            defaultSettingsPath(),
            join(ctx.cwd, ".pi", SETTINGS_DIRECTORY, "settings.json"),
        );
        try {
            cfg = await store.load();
        } catch (error) {
            cfg = { ...DEFAULT_CONFIG, persistState: false };
            report(
                ctx,
                `Could not load Fast settings: ${describeError(error)}. Starting with defaults; changes apply only to this session.`,
                "error",
            );
        }
        fastController.initializeForSession(
            ctx,
            cfg,
            pi.getFlag("fast") === true,
        );
        updateStatus(ctx);
    });
    pi.on("model_select", async (_event, ctx) => {
        const hasChanged = fastController.applyDesiredState(ctx, cfg);
        updateStatus(ctx);
        if (!hasChanged) return;
        if (cfg.notifyOnModelSwitch) report(ctx, describeState(ctx));
        try {
            await persist();
        } catch (error) {
            report(
                ctx,
                `Could not save Fast state: ${describeError(error)}`,
                "error",
            );
        }
    });
    pi.on("before_provider_request", (event, ctx) =>
        fastController.injectProviderPayload(event, ctx, cfg),
    );
    pi.on("session_shutdown", (_event, ctx) => {
        ctx.ui.setStatus(STATUS_KEY, undefined);
    });
}
