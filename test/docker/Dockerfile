FROM node:24.14.0-bookworm-slim@sha256:d8e448a56fc63242f70026718378bd4b00f8c82e78d20eefb199224a4d8e33d8
RUN apt-get update && apt-get install -y --no-install-recommends bubblewrap socat ripgrep git curl ca-certificates libcap2-bin \
    && rm -rf /var/lib/apt/lists/*
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      arm64) FD_ARCH=aarch64; FD_SHA=996b9b1366433b211cb3bbedba91c9dbce2431842144d925428ead0adf32020b ;; \
      amd64) FD_ARCH=x86_64; FD_SHA=2b6bfaae8c48f12050813c2ffe1884c61ea26e750d803df9c9114550a314cd14 ;; \
      *) exit 1 ;; \
    esac \
    && curl --fail --location --max-time 120 "https://github.com/sharkdp/fd/releases/download/v10.3.0/fd-v10.3.0-${FD_ARCH}-unknown-linux-musl.tar.gz" -o /tmp/fd.tar.gz \
    && printf '%s  /tmp/fd.tar.gz\n' "$FD_SHA" | sha256sum --check \
    && tar xzf /tmp/fd.tar.gz -C /tmp \
    && install -m 755 "/tmp/fd-v10.3.0-${FD_ARCH}-unknown-linux-musl/fd" /usr/local/bin/fd \
    && rm -rf /tmp/fd.tar.gz "/tmp/fd-v10.3.0-${FD_ARCH}-unknown-linux-musl"
WORKDIR /opt/pi-guard
COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --ignore-scripts --include=dev --no-audit --no-fund
COPY src ./src
COPY test ./test
COPY scripts ./scripts
COPY tsconfig.json README.md ./
RUN npm run build && node test/docker/package.mjs \
    && mkdir -p .reports/pi-guard docs/handoffs/pi-guard \
    && chown -R node:node /opt/pi-guard
ARG SOURCE_DIGEST
LABEL org.pi-codex-auto-review.verification="true" org.pi-codex-auto-review.source="$SOURCE_DIGEST"
ENV PI_OLLAMA_WEB_TOOLS=0 PI_CODING_AGENT_DIR=/tmp/pi-cloud-agent
USER node
ENTRYPOINT ["node", "test/docker/bootstrap.mjs"]
