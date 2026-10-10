import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const MODEL_ID = "gpt-6.1-sol";
const MAX_OUTPUT_TOKENS = 512;
const PROVIDER_REFRESH_TIMEOUT_MS = 30000;
const REQUEST_TIMEOUT_MS = 30000;
const PROMPT = "Reply with READY only. Do not use tools.";
const PROVIDERS = ["openai", "openai-codex"];
const secretValues = new Set();

function parseOptions() {
    const { values } = parseArgs({
        options: {
            live: { type: "boolean", default: false },
            provider: { type: "string", default: "openai" },
            "agent-dir": { type: "string" },
            help: { type: "boolean", default: false },
        },
    });
    if (values.help) {
        console.log(
            [
                "6.1 Sol Ultrafast PoC",
                "사용법: node scripts/poc-ultrafast-sol.mjs [--provider openai|openai-codex] [--live] [--agent-dir PATH]",
                "기본 실행: 실제 Pi 확장·공급자와 모의 HTTP 응답으로 로컬 검증",
                "--live: 선택한 Pi 공급자의 기존 설정·인증으로 실제 요청 1회; 계정 사용량 발생",
                "--agent-dir: Pi 설정 디렉터리 (기본: PI_CODING_AGENT_DIR 또는 Pi 기본 경로)",
                `--provider: ${PROVIDERS.join(", ")} (기본: openai)`,
            ].join("\n"),
        );
        return undefined;
    }
    assert.ok(
        PROVIDERS.includes(values.provider),
        "지원되는 Pi 공급자는 openai와 openai-codex입니다.",
    );
    if (values["agent-dir"] !== undefined)
        assert.ok(values["agent-dir"].trim(), "Pi 설정 경로가 비어 있습니다.");
    return {
        isLive: values.live,
        provider: values.provider,
        configuredAgentDir: values["agent-dir"]
            ? resolve(values["agent-dir"])
            : undefined,
    };
}

function createOfflineCredential(provider) {
    if (provider === "openai")
        return {
            type: "api_key",
            key: "sk-owned-offline-ultrafast-sol-poc",
        };
    const expiresMs = Date.now() + 3600000;
    return {
        type: "oauth",
        access: [
            Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url"),
            Buffer.from(
                JSON.stringify({
                    exp: Math.floor(expiresMs / 1000),
                    "https://api.openai.com/auth": {
                        chatgpt_account_id: "owned-sol-poc-account",
                    },
                }),
            ).toString("base64url"),
            "owned-offline-signature",
        ].join("."),
        refresh: "owned-offline-refresh",
        expires: expiresMs,
    };
}

function resolveRequestURL(model) {
    const url = new URL(model.baseUrl);
    assert.ok(
        url.protocol === "https:" &&
            (!url.port || url.port === "443") &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash,
        "Pi 모델의 엔드포인트가 지원되는 HTTPS 주소가 아닙니다.",
    );
    const baseUrl = url.href.replace(/\/+$/, "");
    if (model.api === "openai-codex-responses") {
        assert.ok(
            url.hostname === "chatgpt.com" &&
                /^\/backend-api(?:\/codex(?:\/responses)?)?\/?$/.test(
                    url.pathname,
                ),
            "이 PoC의 Codex 경로는 chatgpt.com/backend-api를 사용해야 합니다.",
        );
        if (baseUrl.endsWith("/codex/responses")) return baseUrl;
        if (baseUrl.endsWith("/codex")) return `${baseUrl}/responses`;
        return `${baseUrl}/codex/responses`;
    }
    assert.ok(
        url.hostname === "api.openai.com" && /^\/v1\/?$/.test(url.pathname),
        "이 PoC의 공개 API 경로는 api.openai.com/v1을 사용해야 합니다.",
    );
    return `${baseUrl}/responses`;
}

/** Feed the real OpenAI SSE parser without making a network request. */
function simulatedResponse(body, requestIndex) {
    const item = {
        id: `msg_sol_poc_${requestIndex}`,
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "READY", annotations: [] }],
    };
    const response = {
        id: `resp_sol_poc_${requestIndex}`,
        object: "response",
        model: MODEL_ID,
        status: "completed",
        service_tier: body.service_tier ?? "default",
        output: [item],
        usage: {
            input_tokens: 8,
            output_tokens: 1,
            total_tokens: 9,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 0 },
        },
    };
    const events = [
        {
            type: "response.created",
            response: { ...response, status: "in_progress", output: [] },
        },
        {
            type: "response.output_item.added",
            output_index: 0,
            item: { ...item, status: "in_progress", content: [] },
        },
        {
            type: "response.output_text.delta",
            item_id: item.id,
            output_index: 0,
            content_index: 0,
            delta: "READY",
        },
        { type: "response.output_item.done", output_index: 0, item },
        { type: "response.completed", response },
    ];
    return new Response(
        events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
        {
            headers: {
                "content-type": "text/event-stream",
                "x-request-id": `req_simulated_sol_${requestIndex}`,
            },
        },
    );
}

async function run({ isLive, provider, configuredAgentDir }) {
    const root = await mkdtemp(join(tmpdir(), "pi-ultrafast-sol-poc-"));
    const agentDir = join(root, "agent");
    const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
    let session;
    try {
        await mkdir(agentDir);
        const pi = await import("@earendil-works/pi-coding-agent");
        const piAgentDir = configuredAgentDir ?? pi.getAgentDir();
        process.env.PI_CODING_AGENT_DIR = agentDir;
        const { InMemoryCredentialStore } = await import(
            "@earendil-works/pi-ai"
        );
        const { default: fastModeExtension } = await import(
            "../packages/pi-codex-fast-mode/dist/index.js"
        );
        const credentials = isLive ? undefined : new InMemoryCredentialStore();
        if (credentials)
            await credentials.modify(provider, async () =>
                createOfflineCredential(provider),
            );
        let modelRuntime;
        try {
            modelRuntime = await pi.ModelRuntime.create({
                ...(isLive
                    ? { authPath: join(piAgentDir, "auth.json") }
                    : { credentials }),
                modelsPath: isLive ? join(piAgentDir, "models.json") : null,
                modelsStorePath: join(agentDir, "models-store.json"),
                allowModelNetwork: isLive,
                refreshOnCreate: false,
            });
        } catch {
            throw new Error(
                "Pi 인증·모델 설정을 읽지 못했습니다. Pi 설정 경로와 파일 권한을 확인하세요.",
            );
        }
        const refreshed = await modelRuntime.refresh({
            providers: [provider],
            allowNetwork: isLive,
            force: isLive,
            signal: AbortSignal.timeout(PROVIDER_REFRESH_TIMEOUT_MS),
        });
        assert.equal(
            refreshed.aborted,
            false,
            `Pi 공급자 갱신이 취소됐거나 제한 시간(${PROVIDER_REFRESH_TIMEOUT_MS}ms)을 초과했습니다.`,
        );
        assert.equal(
            refreshed.errors.size,
            0,
            "Pi 공급자 갱신 실패. 네트워크·공급자 설정·로그인을 확인하세요.",
        );
        assert.ok(
            !modelRuntime.getError(),
            "Pi 공급자·모델 설정을 읽지 못했습니다. models.json을 확인하세요.",
        );
        const model = modelRuntime.getModel(provider, MODEL_ID);
        assert.ok(model, "설치된 Pi의 모델 목록에 gpt-6.1-sol이 없습니다.");
        const isBackend = provider === "openai-codex";
        assert.equal(
            model.api,
            isBackend ? "openai-codex-responses" : "openai-responses",
        );
        assert.ok(
            modelRuntime.hasConfiguredAuth(provider),
            "선택한 Pi 공급자에 인증이 없습니다. Pi의 /login에서 로그인하세요.",
        );
        const isUsingOAuth = modelRuntime.isUsingOAuth(provider);
        const canOmitMaxOutputTokens =
            isBackend ||
            isUsingOAuth ||
            model.compat?.supportsMaxOutputTokens === false;
        const requestURL = resolveRequestURL(model);

        const extensionErrors = [];
        const requests = [];
        const completedResponses = [];
        const hookPayloads = [];
        let expectedTier;
        let requestError;
        const observeExtension = (extension) => {
            extension.on("before_provider_request", (event) => {
                hookPayloads.push({
                    model: event.payload?.model,
                    tier: event.payload?.service_tier,
                });
            });
            extension.on("provider_stream_event", (event) => {
                if (event.data?.type === "response.completed")
                    completedResponses.push(event.data.response);
            });
        };
        const observedFetch = async (input, init) => {
            try {
                const request = new Request(input, init);
                for (const name of ["authorization", "x-api-key", "api-key"]) {
                    const value = request.headers.get(name);
                    if (value) {
                        secretValues.add(value);
                        secretValues.add(value.replace(/^Bearer\s+/i, ""));
                    }
                }
                let bytes = Buffer.from(await request.clone().arrayBuffer());
                const contentEncoding = request.headers.get("content-encoding");
                if (contentEncoding === "zstd") {
                    const { zstdDecompressSync } = await import("node:zlib");
                    assert.equal(typeof zstdDecompressSync, "function");
                    bytes = zstdDecompressSync(bytes);
                } else
                    assert.ok(
                        !contentEncoding,
                        "지원하지 않는 요청 압축 형식입니다.",
                    );
                const body = JSON.parse(bytes.toString("utf8"));
                assert.equal(request.url, requestURL);
                assert.equal(request.method, "POST");
                assert.equal(body.model, MODEL_ID);
                assert.equal(body.service_tier, expectedTier);
                assert.ok(
                    canOmitMaxOutputTokens ||
                        body.max_output_tokens !== undefined,
                    "Pi 공급자가 설정한 출력 토큰 제한을 생략했습니다.",
                );
                if (body.max_output_tokens !== undefined)
                    assert.equal(
                        body.max_output_tokens,
                        MAX_OUTPUT_TOKENS,
                        "전송된 출력 토큰 제한이 PoC 설정과 다릅니다.",
                    );
                assert.ok(
                    request.headers.get("authorization")?.startsWith("Bearer "),
                    "Pi 공급자의 인증 헤더가 없습니다.",
                );
                if (isBackend) {
                    assert.ok(
                        request.headers.get("chatgpt-account-id"),
                        "Pi Codex 공급자의 계정 헤더가 없습니다.",
                    );
                }
                assert.equal(
                    body.reasoning?.effort,
                    model.thinkingLevelMap?.low ?? "low",
                );
                assert.ok(
                    !body.tools?.length,
                    "PoC 요청에 도구가 포함됐습니다.",
                );
                assert.ok(
                    requests.length < (isLive ? 1 : 3),
                    "PoC 요청 횟수를 초과했습니다.",
                );
                const trace = {
                    url: request.url,
                    model: body.model,
                    sentTier: body.service_tier ?? null,
                    maxOutputTokens: body.max_output_tokens ?? null,
                    contentEncoding,
                };
                requests.push(trace);
                const response = isLive
                    ? await fetch(request, { redirect: "error" })
                    : simulatedResponse(body, requests.length);
                trace.httpStatus = response.status;
                trace.requestId = response.headers.get("x-request-id");
                return response;
            } catch (error) {
                requestError = error;
                throw error;
            }
        };
        const streamSimple = modelRuntime.streamSimple.bind(modelRuntime);
        modelRuntime.streamSimple = (requestModel, context, streamOptions) =>
            streamSimple(requestModel, context, {
                ...streamOptions,
                maxTokens: MAX_OUTPUT_TOKENS,
                timeoutMs: REQUEST_TIMEOUT_MS,
                maxRetries: 0,
                fetch: observedFetch,
                ...(isBackend ? { transport: "sse" } : {}),
            });
        const settingsManager = pi.SettingsManager.inMemory({
            cacheWarming: "off",
            compaction: { enabled: false },
            retry: { enabled: false, provider: { maxRetries: 0 } },
            quietStartup: true,
        });
        const resourceLoader = new pi.DefaultResourceLoader({
            cwd: root,
            agentDir,
            settingsManager,
            noExtensions: true,
            noSkills: true,
            noPromptTemplates: true,
            noThemes: true,
            noContextFiles: true,
            systemPrompt: "Reply with READY only.",
            extensionFactories: [fastModeExtension, observeExtension],
        });
        await resourceLoader.reload();
        assert.deepEqual(resourceLoader.getExtensions().errors, []);
        const created = await pi.createAgentSession({
            cwd: root,
            agentDir,
            modelRuntime,
            model,
            thinkingLevel: "low",
            noTools: "all",
            resourceLoader,
            settingsManager,
            sessionManager: pi.SessionManager.inMemory(root),
        });
        session = created.session;
        await session.bindExtensions({
            onError: (error) => extensionErrors.push(error),
        });
        const settingsPath = join(agentDir, "codex-fast-mode", "settings.json");
        const checkCommand = async (command, tier) => {
            const count = requests.length;
            await session.prompt(command);
            assert.deepEqual(extensionErrors, []);
            assert.equal(requests.length, count, "명령이 모델을 호출했습니다.");
            const saved = JSON.parse(await readFile(settingsPath, "utf8"));
            assert.equal(saved.serviceTier, tier);
            assert.equal(saved.active, tier === "ultrafast");
        };
        const results = [];
        const checkRequest = async (selection, tier) => {
            expectedTier = tier;
            requestError = undefined;
            const count = requests.length;
            const startedAtMs = performance.now();
            const timer = setTimeout(
                () => void session.abort(),
                REQUEST_TIMEOUT_MS + 5000,
            );
            try {
                await session.prompt(PROMPT);
            } finally {
                clearTimeout(timer);
            }
            assert.deepEqual(extensionErrors, []);
            const assistant = session.messages.at(-1);
            const response = completedResponses[count];
            const diagnostic = JSON.stringify(
                {
                    provider,
                    authentication: isUsingOAuth ? "oauth" : "api_key",
                    observedRequests: requests.length - count,
                    ...requests[count],
                    returnedTier: response?.service_tier ?? null,
                    serverModel: response?.model ?? null,
                    responseId: response?.id ?? null,
                },
                null,
                2,
            );
            if (
                assistant?.role !== "assistant" ||
                assistant.stopReason !== "stop"
            ) {
                const failure =
                    requestError ??
                    assistant?.errorMessage ??
                    assistant?.stopReason ??
                    "assistant 응답 없음";
                throw new Error(
                    `모델 요청이 완료되지 않았습니다: ${failure instanceof Error ? failure.message : String(failure)}\n${diagnostic}`,
                );
            }
            assert.equal(
                requests.length,
                count + 1,
                `Pi 공급자의 HTTP 요청을 한 번 관찰하지 못했습니다.\n${diagnostic}`,
            );
            assert.equal(hookPayloads.length, requests.length);
            assert.equal(hookPayloads[count].model, MODEL_ID);
            assert.equal(hookPayloads[count].tier, tier);
            assert.ok(response, "response.completed가 없습니다.");
            assert.equal(response.status, "completed");
            assert.ok(
                response.model === MODEL_ID ||
                    response.model?.startsWith(`${MODEL_ID}-`),
                "서버가 다른 모델을 반환했습니다.",
            );
            if (response.service_tier !== (tier ?? "default"))
                throw new Error(
                    `응답 등급 불일치: 요청=${tier ?? "default"}, 응답=${response.service_tier ?? "없음"}. 요청한 등급의 처리를 확인하지 못했습니다.\n${diagnostic}`,
                );
            const text = assistant.content
                .filter((block) => block.type === "text")
                .map((block) => block.text)
                .join("")
                .trim();
            assert.equal(text, "READY");
            results.push({
                selection,
                ...requests[count],
                returnedTier: response.service_tier,
                serverModel: response.model,
                responseId: response.id,
                elapsedMs: Math.round(performance.now() - startedAtMs),
                usage: response.usage,
                text,
            });
        };

        if (!isLive) await checkRequest("initial-standard", undefined);
        await checkCommand("/codex-fast ultrafast on", "ultrafast");
        await checkRequest("ultrafast", "ultrafast");
        await checkCommand("/codex-fast ultrafast off", "standard");
        if (!isLive) await checkRequest("explicit-standard", "default");
        return {
            success: true,
            provider,
            model: MODEL_ID,
            piAgentDir: isLive ? piAgentDir : null,
            authentication: isUsingOAuth ? "oauth" : "api_key",
            isSimulated: !isLive,
            serverTierVerified: isLive,
            results,
            note: isLive
                ? "서버 응답 등급을 확인했습니다. 속도 비교·실제 청구 금액은 검증하지 않았습니다."
                : "로컬 확장·전송 본문·응답 파싱을 확인했습니다. 응답은 모의 데이터이며 실제 서버 지원은 검증하지 않았습니다.",
        };
    } finally {
        session?.dispose();
        if (previousAgentDir === undefined)
            delete process.env.PI_CODING_AGENT_DIR;
        else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
        await rm(root, { recursive: true, force: true });
    }
}

try {
    const configuration = parseOptions();
    if (configuration) {
        const report = await run(configuration);
        console.log(JSON.stringify(report, null, 2));
    }
} catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    if (process.env.OPENAI_API_KEY)
        secretValues.add(process.env.OPENAI_API_KEY);
    for (const value of secretValues)
        message = message.replaceAll(value, "[REDACTED]");
    message = message.replace(
        /("(?:access_token|refresh_token|api_key)"\s*:\s*")[^"]+(")/g,
        "$1[REDACTED]$2",
    );
    console.error(`PoC 실패: ${message}`);
    process.exitCode = 1;
}
