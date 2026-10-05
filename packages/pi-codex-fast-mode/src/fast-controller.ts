import type {
    BeforeProviderRequestEvent,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { type FastConfig, isRecord, type ServiceTier } from "./config.js";

type FastContext = Pick<ExtensionContext, "model" | "modelRegistry">;

export interface FastState {
    desiredTier: ServiceTier;
    active: boolean;
    hasExplicitStandard: boolean;
}

export interface PayloadInjection {
    at: string;
    model: string;
    tier: "priority" | "default" | "ultrafast";
}

/** Tracks user intent separately from whether the current model can apply it. */
export class FastController {
    private state: FastState = {
        desiredTier: "standard",
        active: false,
        hasExplicitStandard: false,
    };
    private lastInjection: PayloadInjection | undefined;

    constructor(private readonly serviceTier = "priority" as const) {}

    get desiredTier(): ServiceTier {
        return this.state.desiredTier;
    }

    get active(): boolean {
        return this.state.active;
    }

    get lastPayloadInjection(): PayloadInjection | undefined {
        return this.lastInjection ? { ...this.lastInjection } : undefined;
    }

    snapshot(): FastState {
        return { ...this.state };
    }

    restore(state: FastState): void {
        this.state = { ...state };
    }

    initializeForSession(
        ctx: FastContext,
        cfg: FastConfig,
        forceFast: boolean,
    ): void {
        this.state = {
            desiredTier: forceFast ? "fast" : cfg.serviceTier,
            active: false,
            hasExplicitStandard: !forceFast && cfg.hasExplicitStandard,
        };
        this.lastInjection = undefined;
        this.applyDesiredState(ctx, cfg);
    }

    supportsFast(ctx: FastContext, cfg: FastConfig): boolean {
        return (
            !!ctx.model &&
            cfg.supportedModels.includes(
                `${ctx.model.provider}/${ctx.model.id}`,
            )
        );
    }

    supportsUltrafast(ctx: FastContext): boolean {
        const model = ctx.model;
        if (
            model?.provider !== "openai" ||
            model.id !== "gpt-6-astra" ||
            model.api !== "openai-responses" ||
            ctx.modelRegistry.isUsingOAuth(model) ||
            !ctx.modelRegistry.hasConfiguredAuth(model)
        )
            return false;
        try {
            const url = new URL(model.baseUrl);
            return (
                url.protocol === "https:" &&
                (url.hostname === "api.openai.com" ||
                    url.hostname === "us.api.openai.com") &&
                (url.port === "" || url.port === "443") &&
                /^\/v1\/?$/.test(url.pathname) &&
                !url.username &&
                !url.password &&
                !url.search &&
                !url.hash
            );
        } catch {
            return false;
        }
    }

    applyDesiredState(ctx: FastContext, cfg: FastConfig): boolean {
        const previous = this.state.active;
        this.state.active =
            this.desiredTier === "fast"
                ? this.supportsFast(ctx, cfg)
                : this.desiredTier === "ultrafast"
                  ? this.supportsUltrafast(ctx)
                  : false;
        return previous !== this.state.active;
    }

    setDesired(tier: ServiceTier, ctx: FastContext, cfg: FastConfig): void {
        this.state.desiredTier = tier;
        this.state.hasExplicitStandard = tier === "standard";
        this.applyDesiredState(ctx, cfg);
    }

    setActive(isActive: boolean, ctx: FastContext, cfg: FastConfig): void {
        this.setDesired(isActive ? "fast" : "standard", ctx, cfg);
    }

    statusSegment(ctx: FastContext, cfg: FastConfig): string | undefined {
        this.applyDesiredState(ctx, cfg);
        return this.active && ctx.model
            ? `${ctx.model.id} ${this.desiredTier}`
            : undefined;
    }

    persistedState(): {
        serviceTier: ServiceTier;
        desiredActive: boolean;
        active: boolean;
    } {
        return {
            serviceTier: this.desiredTier,
            desiredActive: this.desiredTier !== "standard",
            active: this.active,
        };
    }

    injectProviderPayload(
        event: BeforeProviderRequestEvent,
        ctx: FastContext,
        cfg: FastConfig,
    ): Record<string, unknown> | undefined {
        const payload = event.payload;
        if (!isRecord(payload) || !ctx.model || payload.model !== ctx.model.id)
            return undefined;
        this.applyDesiredState(ctx, cfg);
        let tier: PayloadInjection["tier"];
        if (this.desiredTier === "standard") {
            if (!this.state.hasExplicitStandard || !this.supportsFast(ctx, cfg))
                return undefined;
            tier = "default";
        } else {
            if (!this.active) return undefined;
            tier =
                this.desiredTier === "ultrafast"
                    ? "ultrafast"
                    : this.serviceTier;
        }
        this.lastInjection = {
            at: new Date().toISOString(),
            model: `${ctx.model.provider}/${ctx.model.id}`,
            tier,
        };
        return { ...payload, service_tier: tier };
    }
}
