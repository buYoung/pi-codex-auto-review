import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Use Pi's supported OpenAI provider, including its native ChatGPT subscription login. */
export const IMAGE_AUTH_PROVIDER = "openai";
/** Fallback used only when neither Pi's resolved auth nor provider supplies a base URL. */
export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
/** Model-facing guidance when Pi cannot resolve OpenAI authentication at call time. */
export const MISSING_CREDENTIAL_MESSAGE =
    "image generation failed: no usable credentials are configured for Pi's `openai` provider. " +
    "Run `/login openai` and choose Sign in with ChatGPT. " +
    "An existing Pi OpenAI login is reused; no separate image login is required.";

export interface OpenAiCredentials {
    apiKey: string;
    headers: Record<string, string>;
    baseUrl: string;
}

export type CredentialResolution =
    | { ok: true; credentials: OpenAiCredentials }
    | { ok: false; error: string };

/**
 * Pi owns OpenAI login, credential selection, and token refresh. Treat its returned credential
 * as opaque: no JWT/account-claim requirements, alternate provider, or invented auth headers.
 * Preserve Pi's base URL and additional headers without rewriting the request to another backend.
 */
export async function resolveOpenAiCredentials(
    ctx: Pick<ExtensionContext, "modelRegistry">,
): Promise<CredentialResolution> {
    try {
        const result =
            await ctx.modelRegistry.getProviderAuth(IMAGE_AUTH_PROVIDER);
        if (!result?.auth.apiKey) {
            return { ok: false, error: MISSING_CREDENTIAL_MESSAGE };
        }
        const provider = ctx.modelRegistry.getProvider(IMAGE_AUTH_PROVIDER);
        const baseUrl = (
            result.auth.baseUrl ??
            provider?.baseUrl ??
            DEFAULT_OPENAI_BASE_URL
        ).replace(/\/+$/, "");
        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries(result.auth.headers ?? {})) {
            if (typeof value === "string") {
                headers[name] = value;
            }
        }
        return {
            ok: true,
            credentials: { apiKey: result.auth.apiKey, headers, baseUrl },
        };
    } catch {
        return { ok: false, error: MISSING_CREDENTIAL_MESSAGE };
    }
}
