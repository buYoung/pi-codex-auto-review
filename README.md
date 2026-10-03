# pi-codex-auto-review

Codex의 ‘Approve for me’에서 영감을 받은 Pi용 자동 실행 승인 검토 확장입니다. 규칙과 Pi의 현재 모델로 도구 실행을 검토하고, 필요한 경우 사용자 승인을 요청합니다.

Codex 공개 소스 [`rust-v0.160.0`](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc)의 실행 승인 동작을 참고한 독립 구현입니다. Pi 0.99.1의 공개 API와 운영체제 샌드박스를 연결합니다. 일반 실행은 Docker에 의존하지 않으며, Docker는 재현 가능한 검증 환경에 사용합니다.

## 실행

Node.js 22.19 이상, Pi 0.99.1, Rust 1.95 이상이 필요합니다. 소스 빌드는 고정된 Codex 규칙 엔진도 함께 컴파일합니다. 설치 패키지에는 빌드한 운영체제·아키텍처용 실행 파일이 들어가므로 대상 환경에서 빌드합니다. 네이티브 격리는 macOS와 Linux를 지원하며 `/usr/bin/find`가 필요합니다. 개발 의존성을 설치하고 빌드합니다.

```sh
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js --cwd /작업/디렉터리
node dist/cli.js --mode print "프로젝트를 분석해줘"
node dist/cli.js --mode rpc
```

보호 실행은 `pi-codex-auto-review` 진입점이나 `pi-codex-auto-review/startup`의 `createGuardedRuntime()`을 사용합니다. 도구와 샌드박스 준비 상태를 검사하고, 재로딩과 직접 사용자 쉘 호출에도 같은 검사를 적용합니다. 일반 Pi에 확장만 등록하는 경우 Pi 자체가 확장 로딩 실패를 무시할 수 있으므로 보호 시작을 보장하지 않습니다.

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

## 권한 동작

기본 `workspace-write` 모드는 작업 디렉터리와 임시 디렉터리 쓰기를 허용하고, 제어·인증 경로를 제외한 파일을 읽을 수 있습니다. `.git`과 기존 `.agents`·`.codex` 디렉터리는 읽을 수 있지만 쓰기는 검토합니다. `read-only`에서는 기본 작업 파일 쓰기를 허용하지 않습니다.

일반 명령과 인터프리터는 현재 OS 격리 안에서 실행합니다. 경계를 넘는 파일 접근, 명시적 `sandbox_permissions: "require_escalated"` 요청, 검토 규칙, 실행 중 새 네트워크 목적지는 별도 검토를 거칩니다. 구조화된 자동 승인은 검토한 권한을 한 호출에 적용합니다. `additional_permissions`로 범위를 지정할 수 있으며, 명시적 전체 명령 승인은 더 넓은 명령 권한을 부여합니다. 제어·인증 경로의 절대 차단과 네이티브 런타임의 필수 보호는 유지됩니다.

자동 검토는 print·JSON에서도 동작합니다. `approvalsReviewer: "user"`로 선택한 사용자 검토와 이전 `decision/reason` 공급자의 확인 요청은 TUI·RPC 승인 창을 사용하고, 창이 없는 모드에서는 실행하지 않습니다. 자동 검토의 오류·시간 초과는 승인으로 바뀌지 않습니다.

사용자 승인 창에서는 한 번·세션·규칙 저장을 선택할 수 있습니다. 전체 명령 권한은 한 번만 승인할 수 있습니다. 저장 승인은 정확한 도구·입력·작업 디렉터리·호출 경로·정책·권한에 묶이며, 정책 변경 시 기존 승인을 무효화합니다. 한 번 승인은 파일 편집의 보조 작업을 포함한 한 논리적 동작에 적용됩니다.

검토자는 누적된 사용자 지시와 Pi가 제공한 지시의 출처를 유지하며, 도구 결과는 실행 증거로 취급합니다. 현재 모델을 기본으로 사용하고 `reviewModel`로 등록된 다른 모델을 선택할 수 있습니다. 조사는 읽기 전용 파일·디렉터리 도구로 제한합니다. 연속 3회 또는 최근 50회 중 10회 거부되면 실제 Pi 작업을 중단합니다. `/approve` 또는 `/approve <거부 ID>`는 최근 거부한 정확한 동작 한 번을 다시 검토하도록 요청합니다. 치명적 위험이나 절대 차단을 해제하지는 않습니다.

`--policy /절대/경로/policy.json`으로 사용자가 관리하는 설정을 지정할 수 있습니다. 잘못된 설정은 실행을 막습니다.

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

`approvalPolicy`는 `"on-request"`, `"never"` 또는 `{"sandbox": true, "rules": false, "mcp_elicitations": true}` 형태입니다. 기존 두 필드 구성도 지원하며, 생략한 `mcp_elicitations`는 허용하지 않습니다. `never`와 꺼진 범주의 경계 요청은 검토 없이 차단합니다. `reviewModel` 예시는 `{"provider": "ollama-cloud", "id": "glm-5.3"}`이며, 해당 공급자를 먼저 등록해야 합니다.

`ruleFiles`의 `.rules`는 고정 리비전의 Codex `codex-execpolicy`가 직접 평가합니다. Starlark 함수·조건식·컴프리헨션·문자열 보간, `prefix_rule`, `host_executable`, `network_rule`, `match`·`not_match` 검증을 지원합니다. 복합 명령에는 가장 강한 규칙을 적용합니다. Codex의 네트워크 규칙 변환처럼 프로토콜 표시는 호스트 허용·거부 목록으로 합쳐지며, 별도 프로토콜별 권한으로 분리하지 않습니다. 해석하지 못하는 쉘 구문은 접두사 허용을 빌려 쓰지 않고 기본 격리에서 실행합니다. 신뢰한 `allow` 규칙은 일치하는 명령의 권한을 넓힐 수 있으므로 필요한 명령에만 지정합니다.

`reviewPolicy`는 검토자의 조직 정책 부분을 교체합니다. 위험 평가·출처 구분·결과 기준은 유지합니다. `reviewMaxRounds`·`reviewMaxOutputTokens`·`reviewContextChars`는 각각 검토 왕복·출력·문맥 상한입니다. `writableRoots`는 추가 쓰기 루트이며, `excludeSlashTmp`·`excludeTmpdir`로 기본 임시 경로 허용을 제외할 수 있습니다.

## 실행 경계

`@anthropic-ai/sandbox-runtime` 0.0.78을 호출마다 별도 중개 프로세스에서 사용합니다. 쉘의 하위 프로세스와 `read/edit/write/grep/find/ls`의 보조 파일 접근도 같은 OS 경계 안에서 실행합니다. 스트리밍, 구조화 결과, 편집 형식과 오류 처리는 Pi 도구 구현을 유지합니다.

상속 환경은 기본 실행 변수만 전달하고, 호출자 환경에서도 자격 증명·로더·쉘 초기화·프록시 변수를 제거합니다. Unix 소켓과 로컬 포트 직접 접근은 기본 차단합니다. 모델과 승인 창 시간 제한은 밀리초, Pi 쉘 시간 제한은 초입니다. 실패한 명령을 자동으로 다시 실행하지 않습니다.

Pi와 명시적으로 신뢰한 확장은 제어 계층입니다. 임의의 같은 프로세스 확장 코드나 원격 MCP 서버 내부까지 이 샌드박스로 보호하지는 않습니다. 보호 진입점은 자동 확장 탐색을 끄고, 알 수 없는 도구는 신뢰한 어댑터가 없으면 차단합니다. `trustedExtensionPaths`에 설치된 공급자의 진입 파일을 명시하면 Pi의 공개 로더로 읽습니다. 예를 들어 이 저장소에서는 `node_modules/pi-ollama-cloud/index.ts`를 절대 경로로 지정합니다.

보호 진입점은 선택한 `agentDir`의 전역 지침과 프로젝트 루트부터 현재 디렉터리까지의 지침을 자동 탐색합니다. 같은 디렉터리에서는 `AGENTS.override.md`, `AGENTS.md`, `projectDocFallbackFilenames` 순서로 선택합니다. 기본 루트 표시는 `.git`이며 `projectRootMarkers: []`는 상위 탐색을 끕니다. 프로젝트 지침의 합산 한도는 `projectDocMaxBytes`의 기본값 32768바이트입니다. Pi가 비신뢰로 표시한 프로젝트는 제외하고, 새로고침 때 다시 읽습니다. 보호 파일로 연결되는 별칭은 거부하며, 도구 출력에 등장한 파일명을 지침의 출처로 취급하지 않습니다.

MCP는 Pi에 등록된 서버와 `agentDir/mcp.json`, 신뢰한 프로젝트의 `.pi/mcp.json`을 사용합니다. 서버의 실제 도구 등록을 최종 실행 승인에 연결하며 입력·스키마·등록 정보가 바뀌거나 취소되면 실행하지 않습니다. `auto_review`는 읽기 전용 표시나 이전 승인으로 검토를 생략하지 않습니다. 사용자 검토 모드는 Codex의 annotation 우선순위를 따릅니다. `createGuardedRuntime()`의 `mcp: false`로 연결을 끄거나, `mcpToolPolicies`의 `서버/도구` 키에 `approvalMode`와 `kind`를 지정할 수 있습니다.

Computer Use 실행 도구는 설치된 공급자가 제공해야 합니다. `node_repl`의 `js`나 `externalExtensions`의 신뢰한 어댑터를 승인 계층에 연결할 수 있습니다. 민감한 중첩 요청은 살아 있는 원래 호출에 결합해 별도로 검토합니다. `codex_requires_user_input`은 모델이 대신 승인하지 않습니다. 빈 승인 폼은 처리하지만, 입력 필드가 있는 일반 폼과 URL 인증 요청은 이 어댑터에서 거부합니다.

Linux에서 아직 없는 파일을 만들려면 기존 상위 디렉터리의 쓰기 마운트가 필요할 수 있습니다. 이때 실제 상위 경로를 검토 요청에 포함하며, 승인된 호출 동안 그 디렉터리가 쓰기 범위가 됩니다. 기존 파일의 좁은 승인과 다음 호출의 격리는 별도로 검증합니다. 파일 하나만 생성할 수 있는 권한과 완전히 같다고 보장하지 않습니다.

네이티브 런타임이 기본으로 추가하는 임시·로그 쓰기 경로도 선언된 권한 밖이면 차단합니다. 그 내부를 승인할 때 런타임이 디렉터리 전체 권한을 필요로 하면 검토 요청에 실제 범위를 포함합니다. SDK에서 그 경로의 일부만 쓰기 루트로 직접 지정하는 구성은 범위를 몰래 넓히지 않고 `NATIVE_SCOPE_UNSUPPORTED`로 거부합니다.

실행 전에 만들어진 하드링크도 검사합니다. 같은 inode의 모든 이름이 허용 범위에 포함되어야 하며, 경계를 넘는 별칭은 `HARD_LINK_BOUNDARY`로 차단합니다. 검사 실패·출력 초과·30초 시간 초과도 실행을 막습니다. 실행과 동시에 격리 밖의 호스트 프로그램이 링크 구조를 바꾸는 공격까지 방어한다고 보장하지 않습니다.

의존성 보안 조치는 [적용 근거와 재생성 방법](docs/security/dependencies.md)에 있습니다. `node-forge`는 상류의 미병합 수정 리비전으로 고정했고, 개발용 Pi 패키지는 소스 코드를 보존한 채 내부 의존성 잠금만 교정했습니다. 별도로 설치한 Pi 호스트의 의존성까지 자동 교체하지 않습니다.

## 검증

```sh
npm run build
npm run test:contracts
npm run test:policy
npm run test:reviewer
npm run test:approvals
npm run test:native
npm run test:integration
npm run test:e2e
npm run test:conformance
npm run verify:guard
```

`test:*`는 실제 자격 증명이나 유료 모델을 사용하지 않습니다. 네이티브 테스트는 임시 파일·로컬 서비스에서 허용 동작과 차단 효과를 함께 관찰합니다. 모델 대역을 쓰는 결정적 검증과 실제 OS 효과를 구분해서 기록합니다.

[보호 경계 검증표](docs/testing/auto-review-protection.md)는 보호·허용·검토 실패·취소 사례와 검증하지 않은 범위를 설명합니다. Codex의 유한 응답 재생 하네스 방식을 반영해 호출 누락·초과, 다음 모델 요청에 전달되는 도구 결과 본문, 실제 파일·네트워크 효과를 함께 검사합니다.

`verify:guard`는 빌드와 전체 로컬 검증을 실행한 다음, **같은 소스의 `darwin-arm64`·`linux-x64` 전체 결과와 같은 Linux x64 이미지의 GLM5.3 실모델 결과**를 합칩니다. 실제 x64 커널에서 실행한 `verify:platform` 결과도 필요합니다. 하나라도 없거나 차단·실패·오래된 결과이면 종료 코드는 1입니다. ARM64 Linux 결과는 별도 관찰이며 x64를 대체하지 않습니다.

`npm run verify:platform`은 현재 운영체제의 전체 검증만 실행합니다. GitHub Actions의 `자동 검토 운영체제 검증`은 실제 Linux x64 검사와 Docker 이미지·결과 반출을 수행합니다. Windows의 `npm run verify:windows`는 원본 규칙 엔진·승인 정책과 미지원 네이티브 실행의 사전 거부를 검증합니다. Windows 보고서의 성공은 네이티브 격리 지원을 뜻하지 않습니다. workflow에는 Ollama 키를 전달하지 않습니다.

## Docker에서 Ollama Cloud 검증

저장소 루트에서 Docker 엔진이 실행 중이어야 합니다. 이미지는 Node 24.14.0의 다중 아키텍처 digest, Pi 0.99.1, `pi-ollama-cloud` 0.12.2, `sandbox-runtime` 0.0.78과 `fd` 10.3.0의 해시를 고정합니다. `npm ci`로 공급자를 설치하고 현재 플러그인의 `npm pack` 결과를 별도 소비자 디렉터리에 배치합니다. 로컬 Ollama 서버는 설치하지 않습니다.

먼저 키 없는 검증을 실행합니다. 처음에는 이미지 빌드에 네트워크가 필요하고, 오프라인 검증 컨테이너는 네트워크 없이 실행합니다.

```sh
npm run verify:docker -- --mode offline --platform linux/amd64
```

ARM Docker 호스트에서 별도 ARM64 결과를 얻으려면 `--platform linux/arm64`로 실행합니다. 중첩 네임스페이스와 새 `/proc`, 네이티브 seccomp를 지원해야 합니다. 하네스는 외부 컨테이너의 seccomp·systempaths 제한만 해제하고 모든 capability를 제거하며 `no-new-privileges`를 적용합니다. 내부 파일·네트워크·Unix 소켓 격리와 PID 네임스페이스를 약화하는 옵션은 켜지 않습니다. 호스트 디렉터리·Docker 소켓 마운트와 포트 공개는 없습니다.

`--init`으로 종료된 고아 프로세스를 회수하고, 사전 검사에서 실제 회수를 확인합니다. 회수에 실패하면 본 검증을 시작하지 않습니다. PID 한도는 256개입니다.

하네스는 Docker 엔진이 보고한 커널 아키텍처를 `PI_GUARD_KERNEL_ARCH`로 제어 계층에 전달합니다. ARM 커널에서 x64 프로그램을 에뮬레이션할 때도 커널과 일치하는 ARM64용 `seccomp` 보조 프로그램으로 동일한 필터를 적용합니다. 이 값은 도구의 환경변수로 덮어쓸 수 없습니다. 보고서에는 프로그램·커널·보조 프로그램 아키텍처와 에뮬레이션 여부를 따로 기록합니다.

실모델 검증은 실행할 셸에 **export된 `OLLAMA_API_KEY`**가 필요합니다. `.zshrc`에 저장했다면 그 파일을 불러온 셸에서 실행합니다. 키는 명령 인자, 이미지 빌드 인자, `auth.json`에 쓰지 않습니다. 모델 이름은 사용자가 선택한 `glm-5.3`입니다.

```sh
export OLLAMA_MODEL=glm-5.3
npm run verify:docker -- --mode live --platform linux/amd64
npm run verify:docker -- --mode conformance --platform linux/amd64
```

`live`는 실제 주 에이전트와 검토자의 외부 경로 쓰기를 확인하는 기본 점검입니다. `conformance`는 일반 허용·외부 경로 승인·보호 경로 차단·명시적 검토 정책 거부의 네 경우를 실행합니다. 경우마다 최대 24회 모델 호출·180초, 검토 60초, 요청 출력 최대 4096토큰으로 제한하고 자동 공급자 재시도를 끕니다. 웹 도구와 사용량 조회는 비활성화합니다. 실제 호출에는 계정 사용량이 발생할 수 있습니다.

출력의 `imageDigest`를 `--image`에 추가하면 **소스와 아키텍처가 일치하는** 기존 이미지를 재사용합니다. 소스 수정 후에는 `--image` 없이 다시 빌드합니다. 키 부재·미지원 모델·서비스 오류·격리 오류는 성공으로 바꾸지 않습니다.

## 결과 확인과 재실행

각 실행은 `.reports/pi-guard/runs/<실행 ID>/<플랫폼>/`에 저장됩니다. Docker 출력의 `artifactPath`는 실행 관리 보고서이고, 그 안의 `containerResult`는 반출한 컨테이너 보고서입니다. 빌드 로그·컨테이너 로그·세부 검증·실제 이미지와 패키지 해시를 함께 보존합니다. 컨테이너를 지우기 전에 결과를 반출하며, 해당 실행이 만든 컨테이너만 정리합니다. 재실행은 새 디렉터리를 만들고 이전 결과를 덮어쓰지 않습니다.

이미지는 재사용을 위해 남겨 둡니다. 정리가 필요하면 해당 보고서에서 확인한 `imageDigest` 하나만 `docker image rm <imageDigest>`로 삭제합니다. 컨테이너 정리가 실패했다면 보고서의 `containerId`가 그 실행의 소유 컨테이너인지 확인한 뒤 `docker rm -f <containerId>`로 제거합니다.

현재 실행 결과와 차이 목록은 [최종 인계](docs/handoffs/auto-review/07-conformance.json), 보호 사례 확장·Docker 수정·GLM5.3 재검증은 [보호 경계 인계](docs/handoffs/auto-review/10-protection-matrix.json), 환경 복구 경위는 [Docker 인계](docs/handoffs/auto-review/06-docker-cloud.json), 고정 기준과 담당 검증은 [기준 계약](docs/handoffs/auto-review/02-contracts.json)에 있습니다. 과거 Docker 코드는 확인되지 않아 하네스를 재구성했으며, 새 검증 성공을 과거 실행의 증거로 사용하지 않습니다.

이전 ARM 호스트의 x64 실행에서 발생한 `apply-seccomp: prctl(PR_SET_SECCOMP): Invalid argument`는 프로그램 기준으로 보조 프로그램을 고르던 문제였습니다. 현재는 커널 기준으로 선택하고, 실제 필터 활성화와 Unix 소켓 차단을 검증합니다. ARM 커널의 x64 실행과 실제 x64 커널의 실행은 보고서에서 구분합니다. 이전 112개 검증과 GLM5.3 네 사례의 완료 기록은 보호 경계 인계에 남아 있으며, 새 변경의 완료 여부는 최종 인계의 현재 소스 해시와 실행 근거를 확인해야 합니다. 공개 정책·흐름의 호환성 검증은 독점 Codex 모델과 모든 판단이 같다는 뜻이 아닙니다.
