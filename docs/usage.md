# 사용법

pi-codex-auto-review를 Pi 확장으로 등록하는 방법과 CLI·SDK·정책 파일 설정을 다룹니다.

## npm에서 설치

npm에 게시된 버전은 Node.js 22.19 이상과 Pi 0.99.1 또는 1.0.0에서 설치합니다. 배포 대상은 macOS ARM64와 Linux x64이며, 패키지에 두 플랫폼의 규칙 엔진을 포함하므로 설치할 때 Rust가 필요하지 않습니다. 운영체제 샌드박스가 사용할 수 있는 환경이어야 하며 Windows의 네이티브 격리는 지원하지 않습니다.

```sh
pi install npm:pi-codex-auto-review@0.1.2
pi list
pi remove npm:pi-codex-auto-review
```

`--local`을 추가하면 현재 프로젝트의 `.pi/settings.json`에 등록합니다. 프로젝트 패키지는 해당 프로젝트의 신뢰 결정 후 로드됩니다. 버전을 명시한 설치는 그 버전으로 고정됩니다.

0.1.0에서 `Cannot find package '@earendil-works/pi-coding-agent'`로 시작에 실패하면 0.1.2로 업데이트합니다. Pi는 관리하는 확장에 호스트 SDK의 물리적 복사본을 설치하지 않습니다. 0.1.1부터 Pi의 공개 경로 API로 호스트 SDK를 찾고, 그 절대 경로를 격리 워커에도 전달합니다. 별도의 SDK 복사본이나 심볼릭 링크를 추가할 필요가 없습니다.

0.1.1에서 `Directory metadata scope is too large to qualify safely`로 시작에 실패해도 0.1.2로 업데이트합니다. 0.1.2는 별도 프로세스에서 디렉터리 메타데이터를 탐색하며, 10만 개 제한을 제거합니다. 기본 `/tmp`·`TMPDIR`의 쓰기 범위와 하드링크 보호, 30초 검사 제한 및 취소 처리는 유지합니다. 검사에 실패하거나 제한 시간을 초과하면 실행을 차단합니다.

기본 설치 위치인 `.pi/agent/npm` 안에서도 실행에 필요한 확장 코드와 의존성을 읽을 수 있습니다. 에이전트 설정과 자격 증명 경로의 보호는 유지합니다.

## 소스에서 빌드

소스 빌드에는 Rust 1.95 이상도 필요합니다. 저장소 루트에서 개발 의존성을 설치하고 빌드합니다. 이 명령은 현재 운영체제·아키텍처용 실행 파일을 `dist/native/<플랫폼>-<아키텍처>/`에 만듭니다. npm 게시용 패키지 준비는 [배포 안내](publishing.md)를 따릅니다.

```sh
npm ci --ignore-scripts
npm run build
node dist/cli.js --help
```

## Pi 플러그인으로 등록

빌드한 저장소를 로컬 패키지로 등록합니다. 로컬 경로는 복사 없이 해당 위치에서 직접 로드됩니다.

```sh
pi install ./pi-codex-auto-review
pi list
pi remove ./pi-codex-auto-review
```

- 등록하면 로컬 도구와 공식 MCP가 승인 경로에 연결되고, Pi의 기본 MCP 확장은 중복 연결되지 않도록 교체됩니다.
- 확장 등록만으로는 보호 시작을 보장하지 않습니다. Pi 자체가 확장 로딩 실패를 무시할 수 있으므로, 보호 시작이 필요하면 아래 CLI 진입점이나 SDK의 `createGuardedRuntime()`을 사용합니다.
- 프로젝트 지침·설정·MCP 서버는 Pi에 저장된 프로젝트 신뢰 결정과 전역 `defaultProjectTrust`를 따릅니다. 결정이 없으면 프로젝트 자원을 시작하지 않습니다. 이번 실행에서 명시적으로 신뢰하려면 CLI의 `--trust-project` 또는 SDK의 `isProjectTrusted: true`를 사용합니다.

## CLI

```sh
node dist/cli.js --cwd /작업/디렉터리
node dist/cli.js --mode print "프로젝트를 분석해줘"
node dist/cli.js --mode rpc
node dist/cli.js --mode tui
```

등록된 외부 공급자는 `--extension`으로 명시하고 `--provider`와 `--model`을 함께 선택합니다. `OLLAMA_API_KEY`를 export한 셸에서 실행합니다.

```sh
node dist/cli.js \
  --extension node_modules/pi-ollama-cloud/index.ts \
  --provider ollama-cloud --model glm-5.3 \
  --mode print "현재 프로젝트를 분석해줘"
```

| 옵션 | 설명 |
| --- | --- |
| `--mode tui\|print\|json\|rpc` | 실행 모드. 기본은 TUI. 자동 검토는 print·JSON에서도 동작합니다 |
| `--cwd 경로` | 시작 작업 디렉터리 |
| `--agent-dir 경로` | Pi 자원 디렉터리. 생략하면 `PI_CODING_AGENT_DIR`, 그다음 기본 Pi 자원 디렉터리를 사용합니다 |
| `--policy 파일` | 사용자가 관리하는 정책 JSON의 절대 경로. 잘못된 설정은 실행을 막습니다 |
| `--trust-project` | 이번 실행에서 선택한 프로젝트를 명시적으로 신뢰합니다 |
| `--extension 경로`, `-e` | 반복할 수 있습니다. 경로는 명령을 실행한 디렉터리 기준이며, 해당 코드 디렉터리를 신뢰하고 모델 쓰기에서 보호합니다 |
| `--provider 공급자 --model 모델` | 함께 지정해야 합니다. 등록된 모델이 없으면 시작을 거부합니다. 키는 명령 인자에 넣지 않습니다 |

## SDK

보호 실행은 `pi-codex-auto-review` 진입점이나 `pi-codex-auto-review/startup`의 `createGuardedRuntime()`을 사용합니다. 도구와 샌드박스 준비 상태를 검사하고, 모드 재연결과 직접 사용자 쉘 호출에도 같은 검사를 적용합니다.

```ts
import { createGuardedRuntime } from 'pi-codex-auto-review/startup';

const runtime = await createGuardedRuntime({
  cwd: process.cwd(),
  agentDir: '/사용자가/선택한/pi/자원/디렉터리',
});
try {
  await runtime.session.prompt('프로젝트를 분석해줘');
} finally {
  await runtime.dispose();
}
```

| 옵션 | 설명 |
| --- | --- |
| `cwd`, `agentDir` | 시작 디렉터리와 Pi 자원 디렉터리 |
| `settings` 또는 `settingsPath` | 정책 파일과 같은 형식의 실행 정책 |
| `isProjectTrusted` | 명시적 프로젝트 신뢰. 지시가 없으면 Pi의 신뢰 결정과 전역 `defaultProjectTrust`를 따릅니다. 이후 디렉터리 변경은 각 디렉터리의 신뢰 기록을 따릅니다 |
| `model` 또는 `modelSelection` | 모델 객체 또는 `{provider, id}` 선택. 둘을 함께 쓸 수는 없습니다 |
| `trustedExtensionPaths` | 신뢰하는 확장 진입 파일. Pi의 공개 로더로 읽고, 상대 import까지 보호하도록 파일이 있는 디렉터리 전체를 모델 쓰기에서 보호합니다 |
| `profile` | `readOnlyPaths` 등 SDK 프로필을 직접 전달합니다. 필수 제어·인증 경로 보호는 함께 적용됩니다 |
| `mcp: false`, `mcpToolPolicies` | MCP 연결 끄기와 `서버/도구` 키별 `approvalMode` |

보호 진입점은 자동 확장 탐색을 끕니다. 알려진 도구 외에는 신뢰한 어댑터가 없는 도구를 차단합니다.

## 정책 파일

`--policy` 또는 SDK의 `settings`·`settingsPath`로 지정합니다.

```json
{
  "mode": "workspace-write",
  "approvalPolicy": "on-request",
  "approvalsReviewer": "auto_review",
  "reviewModel": null,
  "ruleFiles": [],
  "commandRules": [
    {"prefix": ["git", "status"], "decision": "allow"},
    {"prefix": ["git", "push"], "decision": "deny"}
  ],
  "allowedDomains": [],
  "reviewTimeoutMs": 20000,
  "approvalTimeoutMs": 60000,
  "executionTimeoutSeconds": 120
}
```

| 필드 | 기본값 | 설명 |
| --- | --- | --- |
| `mode` | `workspace-write` | `read-only` 또는 `workspace-write` |
| `approvalPolicy` | `on-request` | `"on-request"`, `"never"`, 또는 `{"sandbox": true, "rules": false, "mcp_elicitations": true}`. 기존 두 필드 구성도 지원하며 생략한 `mcp_elicitations`는 허용하지 않습니다. `never`와 꺼진 범주의 경계 요청은 검토 없이 차단합니다 |
| `approvalsReviewer` | `auto_review` | `"user"`면 사용자 검토 |
| `reviewModel` | `null` | 현재 모델 대신 사용할 등록 모델 (`{"provider": "ollama-cloud", "id": "glm-5.3"}`). 해당 공급자를 먼저 등록해야 합니다 |
| `ruleFiles` | `[]` | 아래 규칙 파일 경로 |
| `commandRules` | `[]` | 리터럴 인자 접두사 규칙 (`allow`·`ask`·`deny`) |
| `allowedDomains` | `[]` | 허용 도메인 패턴 |
| `trustedTools` | `[]` | 알려진 도구 외에 통과할 추가 도구 이름 |
| `reviewTimeoutMs`, `approvalTimeoutMs`, `executionTimeoutSeconds` | 20000, 60000, 120 | 검토자·승인 창은 밀리초, 쉘은 초 단위입니다 |
| `reviewPolicy`, `reviewMaxRounds`, `reviewMaxOutputTokens`, `reviewContextChars` | `null`, 4, 2048, 60000 | 검토자의 조직 정책 부분을 교체합니다. 위험 평가·출처 구분·결과 기준은 유지합니다 |
| `writableRoots` | `[]` | 추가 쓰기 루트 |
| `excludeSlashTmp`, `excludeTmpdir` | `false` | 기본 임시 경로(`/tmp`, `os.tmpdir()`) 허용을 제외합니다 |
| `projectDocMaxBytes`, `projectDocFallbackFilenames`, `projectRootMarkers` | 32768, `[]`, `null` | 프로젝트 지침 합산 한도, 보조 파일명, 루트 표시 (`null`은 `.git`, `[]`은 상위 탐색 해제) |

## 규칙 파일

`ruleFiles`의 `.rules`는 고정 리비전의 Codex `codex-execpolicy`가 직접 평가합니다.

- Starlark 함수·조건식·컴프리헨션·문자열 보간, `prefix_rule`, `host_executable`, `network_rule`, `match`·`not_match` 검증을 지원합니다.
- 복합 명령에는 가장 강한 규칙을 적용합니다.
- Codex의 네트워크 규칙 변환처럼 프로토콜 표시는 호스트 허용·거부 목록으로 합쳐지며, 별도 프로토콜별 권한으로 분리하지 않습니다.
- 해석하지 못하는 쉘 구문은 접두사 허용을 빌려 쓰지 않고 기본 격리에서 실행합니다.
- 신뢰한 `allow` 규칙은 일치하는 명령의 권한을 넓힐 수 있으므로 필요한 명령에만 지정합니다.

## 동작 상세

### 명령 검토와 승인

- 일반 명령과 인터프리터는 현재 OS 격리 안에서 실행합니다.
- 경계를 넘는 파일 접근, 명시적 권한 상승 요청, 검토 규칙, 실행 중 새 네트워크 목적지는 별도 검토를 거칩니다.
- 구조화된 자동 승인은 검토한 권한을 한 호출에 적용합니다. `additional_permissions`로 범위를 지정할 수 있고, 명시적 전체 명령 승인은 더 넓은 명령 권한을 부여합니다.
- TUI·RPC 승인 창에서 한 번, 세션, 규칙 저장을 선택할 수 있습니다. 전체 명령 권한은 한 번만 승인할 수 있습니다. 저장 승인은 정확한 도구·입력·작업 디렉터리·호출 경로·정책·권한에 묶이며, 정책 변경 시 기존 승인을 무효화합니다.
- 모델 작업이 반복 거부로 중단돼도 이후 사용자가 직접 입력한 쉘 명령은 독립적으로 평가합니다.

### 자동 검토자

- 현재 모델을 기본으로 사용하고 `reviewModel`로 등록된 다른 모델을 선택할 수 있습니다.
- 누적된 사용자 지시와 Pi가 제공한 지시의 출처를 유지하며, 도구 결과는 실행 증거로 취급합니다.
- 조사는 읽기 전용 파일·디렉터리 도구로 제한합니다.
- 연속 3회 또는 최근 50회 중 10회 거부되면 실제 Pi 작업을 중단합니다.
- 오류와 시간 초과는 승인으로 바뀌지 않으며, 잘못된 위험 등급·승인 수준 응답도 검토 실패로 처리합니다.
- `/approve` 또는 `/approve <거부 ID>`는 최근 거부한 정확한 동작 하나를 다시 검토합니다. 치명적 위험이나 절대 차단을 해제하지는 않습니다.

### 컨텍스트 파일

- `agentDir`의 전역 지침과 프로젝트 루트부터 현재 디렉터리까지의 지침을 자동 탐색합니다.
- 같은 디렉터리에서는 `AGENTS.override.md` → `AGENTS.md` → `projectDocFallbackFilenames` 순서로 선택합니다.
- 보호 파일로 연결되는 별칭은 거부하고, 도구 출력에 등장한 파일명을 지침의 출처로 취급하지 않습니다. 비신뢰 프로젝트는 제외하며 새로고침 때 다시 읽습니다.

### MCP

- Pi에 등록된 서버, `agentDir/mcp.json`, 신뢰한 프로젝트의 `.pi/mcp.json`을 사용합니다. 모드를 다시 연결할 때 기존 연결을 종료하고 새 연결을 만듭니다.
- 최종 실행 승인은 서버의 실제 도구 등록에 결합합니다. 검토 중 등록 정보가 바뀌거나 호출이 취소되면 실행하지 않습니다.
- 일반 경로는 검토자 종류와 별개로 Codex의 annotation 우선순위와 승인 모드를 따릅니다. 엄격한 검토 요청·민감 작업·필수 사용자 입력은 새 승인을 요구하고, 읽기 전용 표시나 이전 승인으로 생략하지 않습니다.
- `codex_requires_user_input`은 모델이 대신 승인하지 않습니다. 빈 승인 폼은 처리하지만, 입력 필드가 있는 일반 폼과 URL 인증 요청은 이 어댑터에서 거부합니다.
- `node_repl/js` 이름에도 같은 승인 규칙을 적용합니다. 추가 승인 요청은 살아 있는 원래 호출의 도구·연결·실제 입력에 결합하며, 다른 도구나 커넥터를 대신 지목하면 거부합니다.

### 특수 경로와 링크

- 권한 루트 이름에 `*`, `?`, `[`, `]`가 들어가면 패턴으로 해석하므로, 이 문자가 들어간 새 권한 범위는 승인 전에 차단합니다. 허용된 작업 디렉터리 안의 파일·폴더 이름은 그대로 사용할 수 있습니다.
- Linux에서 아직 없는 파일을 만드는 쓰기는 상위 디렉터리 권한을 검토 요청에 함께 포함합니다.
- 선언된 권한 밖의 런타임 기본 임시·로그 경로도 차단합니다.
- 실행 전 하드링크를 검사해 범위 밖 별칭은 차단합니다.

## Docker에서 Ollama Cloud 검증

### 준비

- 저장소 루트에서 Docker 엔진이 실행 중이어야 합니다. 로컬 Ollama 서버는 설치하지 않습니다.
- 이미지는 Node 24.14.0, Pi 0.99.1, `pi-ollama-cloud` 0.12.2, `sandbox-runtime` 0.0.78, `fd` 10.3.0의 해시를 고정합니다. 하네스는 컨테이너 격리를 약화하는 구성(호스트 디렉터리·소켓 마운트, 포트 공개, 격리 완화 옵션)을 허용하지 않습니다.
- 처음 이미지 빌드에만 네트워크가 필요하고, 검증 컨테이너는 네트워크 없이 실행합니다.

### 키 없는 검증

```sh
npm run verify:docker -- --mode offline --platform linux/amd64
```

ARM Docker 호스트에서 별도 ARM64 결과를 얻으려면 `--platform linux/arm64`로 실행합니다.

### 실모델 검증

실행할 셸에 `OLLAMA_API_KEY`를 export해야 합니다. 키는 명령 인자·이미지 빌드 인자·`auth.json`에 쓰지 않으며, 실제 호출에는 계정 사용량이 발생할 수 있습니다.

```sh
export OLLAMA_MODEL=glm-5.3
npm run verify:docker -- --mode live --platform linux/amd64
npm run verify:docker -- --mode conformance --platform linux/amd64
```

- `live`는 실제 주 에이전트와 검토자의 외부 경로 쓰기를 확인합니다.
- `conformance`는 허용·외부 경로 승인·보호 경로 차단·정책 거부 사례와 배포된 CLI의 공급자 선택 승인을 검사합니다.
- 사례마다 모델 호출 횟수·시간·출력을 제한하고 자동 공급자 재시도를 끕니다. 관찰 확장은 호출 수와 선택한 모델만 기록하고 응답을 대체하지 않습니다. 웹 도구와 사용량 조회는 비활성화합니다.
- 키 부재·미지원 모델·서비스 오류·격리 오류는 성공으로 바꾸지 않습니다.
- 출력의 `imageDigest`를 `--image`에 추가하면 소스와 아키텍처가 일치하는 기존 이미지를 재사용합니다. 소스 수정 후에는 `--image` 없이 다시 빌드합니다.
