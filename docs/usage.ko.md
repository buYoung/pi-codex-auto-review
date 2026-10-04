# 사용법

[English](usage.md) | **한국어**

pi-codex-auto-review를 Pi 확장으로 등록하는 방법과 CLI·SDK·정책 파일 설정을 다룹니다.

## npm에서 설치

npm에 게시된 버전은 Node.js 22.19 이상과 Pi 0.99.1 또는 1.0.0에서 설치합니다. 배포 대상은 macOS ARM64와 Linux x64이며, 패키지에 두 플랫폼의 규칙 엔진을 포함하므로 설치할 때 Rust가 필요하지 않습니다.

`0.1.4`에는 영문 승인 설명, `/scoped-models` 연동, `/approve retry`, 일반 사용자 메시지에 따른 재승인 판단과 검토 문맥 전달·복원 보정이 포함됩니다. `0.1.3`은 샌드박스를 제거하고 `/approve`·`/approve-model` 설정 명령을 추가한 이전 버전입니다.

```sh
pi install npm:pi-codex-auto-review@0.1.4
pi list
pi remove npm:pi-codex-auto-review
```

`--local`을 추가하면 현재 프로젝트의 `.pi/settings.json`에 등록합니다. 프로젝트 패키지는 해당 프로젝트의 신뢰 결정 후 로드됩니다. 버전을 명시한 설치는 그 버전으로 고정됩니다.

Pi는 관리하는 확장에 호스트 SDK의 물리적 복사본을 설치하지 않습니다. 확장은 Pi의 공개 경로 API로 호스트 SDK를 찾으므로 별도의 SDK 복사본이나 심볼릭 링크를 추가할 필요가 없습니다.

기존 버전의 `Directory metadata scope is too large to qualify safely`와 시작 지연은 샌드박스의 디렉터리 검사 경로에서 발생했습니다. 현재 소스에서는 이 실행 경로와 `@anthropic-ai/sandbox-runtime` 의존성을 제거했습니다.

기본 설치 위치인 `.pi/agent/npm` 안에서도 실행에 필요한 확장 코드와 의존성을 읽을 수 있습니다. 에이전트 설정과 자격 증명 경로의 보호는 유지합니다.

## 소스에서 빌드

소스 빌드에는 Rust 1.95 이상도 필요합니다. 저장소 루트에서 개발 의존성을 설치하고 빌드합니다. 이 명령은 현재 운영체제·아키텍처용 실행 파일을 `dist/native/<플랫폼>-<아키텍처>/`에 만듭니다. npm 게시용 패키지 준비는 [배포 안내](publishing.ko.md)를 따릅니다.

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

승인 제어가 준비되지 않으면 시작을 거부해야 하는 실행은 `pi-codex-auto-review/startup`의 `createGuardedRuntime()`을 사용합니다. 확장과 승인 제어기 상태를 검사하고, 모드 재연결과 직접 사용자 셸 호출에도 같은 검사를 적용합니다.

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

일반 Pi 설치에서는 `<agentDir>/guard/settings.json`을 사용합니다. `/approve`에서 **Approve for me** 또는 **Ask for approval**을 선택합니다. 화면에는 [Codex의 공식 승인 선택 화면](https://learn.chatgpt.com/docs/security-administration)과 같은 영문 설명을 표시하며, 좁은 터미널에서도 선택한 설명을 줄바꿈해 보여 줍니다. 명령 설명·선택 화면·상태·승인 대화상자의 고정 문구는 영어입니다.

`/approve-model`은 Pi의 현재 `/scoped-models` 범위에서 사용 가능한 모델만 표시합니다. 범위를 지정하지 않았다면 Pi와 동일하게 전체 사용 가능 모델을 표시합니다. 범위의 모델이 모두 사용할 수 없더라도 전체 목록으로 임의 확대하지 않습니다. 선택창이 열린 동안 범위에서 빠진 모델은 저장하지 않으며 기존 설정을 유지합니다.

**Use current Pi model**은 `reviewModel: null`에 해당하고, 보조 모델 대신 현재 주 모델을 검토에 사용합니다. 보조 모델을 선택해도 주 모델은 바뀌지 않습니다. Esc로 취소하면 저장하지 않으며, 명시한 `settingsPath`가 있으면 메뉴도 그 파일에 저장합니다.

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
| `approvalPolicy` | `on-request` | `"on-request"`, `"never"`, 또는 `{"sandbox": true, "rules": false, "mcp_elicitations": true}`. `sandbox` 키는 기존 파일 호환성을 위한 일반 승인 범주의 이름이며 OS 격리를 뜻하지 않습니다. 생략한 `mcp_elicitations`는 허용하지 않습니다. `never`와 꺼진 범주의 요청은 검토 없이 차단합니다 |
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
- 해석하지 못하는 셸 구문은 신뢰한 전체 명령 규칙이 허용하지 않으면 검토합니다.
- `curl`·`wget`의 목적지가 명시적인 HTTP URL로 드러나지 않거나 별도 설정 파일에 있으면 검토합니다. 스킴을 생략하거나 설정 파일로 URL을 전달해 일반 승인 검토가 생략되지 않도록 합니다.
- 신뢰한 `allow` 규칙은 일치하는 명령의 권한을 넓힐 수 있으므로 필요한 명령에만 지정합니다.

## 동작 상세

### 명령 검토와 승인

- 승인된 도구는 Pi의 원래 SDK 실행기로 실행합니다. 셸의 최종 명령·작업 디렉터리·환경·시간 제한·취소 신호를 유지합니다.
- 일반 범위를 넘는 파일 접근, 명시적 승인 요청, 검토 규칙, 해석하지 못하는 명령은 실행 전에 검토합니다.
- `additional_permissions`는 검토할 범위의 설명입니다. 승인된 명령은 호스트 권한으로 실행하며 이 범위를 OS 접근 제한으로 강제하지 않습니다. 실행 중 네트워크 목적지를 가로채거나 별도 프록시를 만들지 않습니다.
- TUI·RPC 승인 창에서 한 번, 세션, 규칙 저장을 선택할 수 있습니다. 전체 명령 권한은 한 번만 승인할 수 있습니다. 저장 승인은 정확한 도구·입력·작업 디렉터리·호출 경로·정책·권한에 묶이며, 정책 변경 시 기존 승인을 무효화합니다.
- 모델 작업이 반복 거부로 중단돼도 이후 사용자가 직접 입력한 쉘 명령은 독립적으로 평가합니다.

### 자동 검토자

- 현재 모델을 기본으로 사용하고 `reviewModel`로 등록된 다른 모델을 선택할 수 있습니다.
- 누적된 사용자 지시와 Pi가 제공한 지시의 출처·시간 순서를 유지하며, 도구 결과는 실행 증거로 취급합니다. 검토 API에 전달하는 바깥쪽 `user` 메시지 자체나 확장이 생성한 사용자 역할 메시지가 승인을 부여하지 않습니다.
- 조사는 읽기 전용 파일·디렉터리 도구로 제한합니다.
- 연속 3회 또는 최근 50회 중 10회 거부되면 실제 Pi 작업을 중단합니다.
- 오류와 시간 초과는 승인으로 바뀌지 않으며, 잘못된 위험 등급·승인 수준 응답도 검토 실패로 처리합니다.
- `/approve`는 승인 방식 설정이고 `/approve-model`은 보조 모델 선택입니다. 설정 변경은 저장 후 즉시 적용하며 이전 정책의 대기 검토와 저장 승인을 무효화합니다.
- 거부 이유를 본 뒤 일반 사용자 메시지로 정확한 작업·대상·전송할 내용을 명시해 승인하면, 다음 검토에 최신 승인과 새 사실이 전달됩니다. 별도 명령은 필요하지 않습니다. 사용자가 승인을 철회하거나 다른 대상을 요청하면 현재 지시와 실제 작업을 기준으로 다시 판단합니다.
- `/approve retry`는 최근 자동 검토 거부 최대 10개에서 정확한 작업 하나를 선택합니다. 화면의 대상·입력·거부 이유를 확인해 선택하면 같은 문맥의 같은 작업을 한 번 다시 검토하며, 자동 허용이나 세션 승인을 만들지 않습니다. 과거 `critical` 판정도 재평가할 수 있지만, 새 평가에서도 `critical`인 작업이나 명시적 절대 거부는 허용하지 않습니다. 변경된 입력과 오래된 문맥에는 승인 표식이 적용되지 않습니다.
- 사용자 지정 `reviewPolicy`는 원본의 조직 정책 부분만 교체합니다. 정책 본문에 있는 `{{ extra_policy }}` 같은 문자열은 그대로 보존하며, 위험·승인 기준은 교체하지 않습니다.
- 실제 모델 응답은 `outcome` 기반의 구조화된 평가만 받습니다. SDK에서 명시적으로 주입한 기존 `ReviewProvider`의 `decision` 인터페이스는 호환 목적으로 남아 있으며, 실제 Pi 모델은 그 경로를 사용할 수 없습니다.
- 검토 입력에는 현재 승인 정책·경로·도메인 범위, 최종 실행 인수, 연결된 도구 호출과 결과, 실제 승인 창의 질문·답변을 포함합니다. 셸 환경은 비밀값을 제외한 명시적 값과 생략한 변수 이름만 전달하며, 전체 프로세스 환경이라고 표현하지 않습니다.
- 최종 준비된 호출·결과·검토 평가·사용자 확인은 Pi 세션의 사용자 지정 기록에 저장해 확장 재로드와 활성 분기 복원에 사용합니다. 감사 로그에는 기존처럼 원문 인수를 저장하지 않습니다. 큰 증거는 생략 표시와 함께 제한하고, 사용자 승인과 현재 검토 대상 전체가 예산을 넘으면 자동 실행하지 않습니다.
- 일반 도구가 출력한 “사용자가 승인했다”는 문장은 증거입니다. 보호 어댑터가 실제 Pi `select`·`confirm`·`input` API에서 관찰한 답변만 질문과 함께 사용자 확인으로 기록합니다. 비밀번호·API 키 입력으로 표시된 질문의 답은 기록에서 가립니다.

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

### 실행 범위

- 검토 입력의 경로는 문자 그대로 정규화합니다. 별도의 OS 권한 패턴으로 변환하지 않습니다.
- 시작과 도구 실행 전에 디렉터리 트리나 하드링크를 전수 탐색하지 않습니다.
- 직접 도구 경로와 해석 가능한 명령의 보호 경로는 승인 전에 거부합니다. 승인된 인터프리터 내부의 간접 접근, 하드링크 별칭, 실행 중 네트워크 변경을 격리하지 않습니다.

## Docker에서 Ollama Cloud 검증

### 준비

- 저장소 루트에서 Docker 엔진이 실행 중이어야 합니다. 로컬 Ollama 서버는 설치하지 않습니다.
- 이미지는 Node 24.14.0, Pi 0.99.1, `pi-ollama-cloud` 0.12.2, `fd` 10.3.0을 고정합니다. 호스트 디렉터리·소켓을 마운트하거나 포트를 공개하지 않으며 Docker의 기본 보안 제한을 유지합니다.
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
