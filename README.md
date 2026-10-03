# Pi 권한 플러그인

Codex 공개 소스 [`rust-v0.160.0`](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc)의 실행 승인 동작을 참고한 독립 구현입니다. Pi 0.99.1의 공개 API와 운영체제 샌드박스를 연결합니다. 일반 실행은 Docker에 의존하지 않으며, Docker는 재현 가능한 검증 환경에 사용합니다.

## 실행

Node.js 22.19 이상과 Pi 0.99.1이 필요합니다. 개발 의존성을 설치하고 빌드합니다.

```sh
npm ci
npm run build
node dist/cli.js --help
node dist/cli.js --cwd /작업/디렉터리
node dist/cli.js --mode print "프로젝트를 분석해줘"
node dist/cli.js --mode rpc
```

보호 실행은 `pi-guard` 진입점이나 `pi-guard/startup`의 `createGuardedRuntime()`을 사용합니다. 도구와 샌드박스 준비 상태를 검사하고, 재로딩과 직접 사용자 쉘 호출에도 같은 검사를 적용합니다. 일반 Pi에 확장만 등록하는 경우 Pi 자체가 확장 로딩 실패를 무시할 수 있으므로 보호 시작을 보장하지 않습니다.

```ts
import { createGuardedRuntime } from 'pi-guard/startup';

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

`approvalPolicy`는 `"on-request"`, `"never"` 또는 `{"sandbox": true, "rules": false}` 형태입니다. `never`와 꺼진 범주의 경계 요청은 검토 없이 차단합니다. `reviewModel` 예시는 `{"provider": "ollama-cloud", "id": "glm-5.3"}`이며, 해당 공급자를 먼저 등록해야 합니다.

`ruleFiles`에는 Codex `.rules`의 리터럴 `prefix_rule(pattern=[...], decision="allow|prompt|forbidden")`을 지정할 수 있습니다. 대안 인자 목록, `match`·`not_match`, `justification`을 지원하고 복합 명령에서 가장 강한 규칙을 적용합니다. 일반 Starlark 코드는 실행하지 않습니다. 해석하지 못하는 쉘 구문은 접두사 허용을 빌려 쓰지 않고 기본 격리에서 실행합니다. 신뢰한 `allow` 규칙은 일치하는 명령의 권한을 넓힐 수 있으므로 필요한 명령에만 지정합니다.

`reviewPolicy`는 검토자의 조직 정책 부분을 교체합니다. 위험 평가·출처 구분·결과 기준은 유지합니다. `reviewMaxRounds`·`reviewMaxOutputTokens`·`reviewContextChars`는 각각 검토 왕복·출력·문맥 상한입니다. `writableRoots`는 추가 쓰기 루트이며, `excludeSlashTmp`·`excludeTmpdir`로 기본 임시 경로 허용을 제외할 수 있습니다.

## 실행 경계

`@anthropic-ai/sandbox-runtime` 0.0.78을 호출마다 별도 중개 프로세스에서 사용합니다. 쉘의 하위 프로세스와 `read/edit/write/grep/find/ls`의 보조 파일 접근도 같은 OS 경계 안에서 실행합니다. 스트리밍, 구조화 결과, 편집 형식과 오류 처리는 Pi 도구 구현을 유지합니다.

상속 환경은 기본 실행 변수만 전달하고, 호출자 환경에서도 자격 증명·로더·쉘 초기화·프록시 변수를 제거합니다. Unix 소켓과 로컬 포트 직접 접근은 기본 차단합니다. 모델과 승인 창 시간 제한은 밀리초, Pi 쉘 시간 제한은 초입니다. 실패한 명령을 자동으로 다시 실행하지 않습니다.

Pi와 명시적으로 신뢰한 확장은 제어 계층입니다. 임의의 같은 프로세스 확장 코드나 원격 MCP 서버 내부까지 이 샌드박스로 보호하지는 않습니다. 보호 진입점은 자동 확장 탐색을 끄고, 알 수 없는 도구는 신뢰한 어댑터가 없으면 차단합니다. `trustedExtensionPaths`에 설치된 공급자의 진입 파일을 명시하면 Pi의 공개 로더로 읽습니다. 예를 들어 이 저장소에서는 `node_modules/pi-ollama-cloud/index.ts`를 절대 경로로 지정합니다.

보호 진입점은 자동 컨텍스트 파일 탐색도 끕니다. Pi가 실제 제공한 지시만 검토에 반영하며, `AGENTS.md`라는 파일명이나 도구 출력만으로 권한을 만들지 않습니다. 이 자동 탐색 설정, 제어 계층의 절대 보호, 일반 Starlark 미지원은 Codex와의 명시적 차이입니다.

Linux에서 아직 없는 파일을 만들려면 기존 상위 디렉터리의 쓰기 마운트가 필요할 수 있습니다. 이때 실제 상위 경로를 검토 요청에 포함하며, 승인된 호출 동안 그 디렉터리가 쓰기 범위가 됩니다. 기존 파일의 좁은 승인과 다음 호출의 격리는 별도로 검증합니다. 파일 하나만 생성할 수 있는 권한과 완전히 같다고 보장하지 않습니다.

네이티브 런타임이 기본으로 추가하는 임시·로그 쓰기 경로도 선언된 권한 밖이면 차단합니다. 그 내부를 승인할 때 런타임이 디렉터리 전체 권한을 필요로 하면 검토 요청에 실제 범위를 포함합니다. SDK에서 그 경로의 일부만 쓰기 루트로 직접 지정하는 구성은 범위를 몰래 넓히지 않고 `NATIVE_SCOPE_UNSUPPORTED`로 거부합니다.

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

`verify:guard`는 빌드와 전체 로컬 검증을 실행한 다음, **같은 소스의 `darwin-arm64`·`linux-x64` 전체 결과와 같은 Linux x64 이미지의 GLM5.3 실모델 결과**를 합칩니다. 하나라도 없거나 차단·실패·오래된 결과이면 종료 코드는 1입니다. ARM64 Linux 결과는 별도 관찰이며 x64를 대체하지 않습니다.

## Docker에서 Ollama Cloud 검증

저장소 루트에서 Docker 엔진이 실행 중이어야 합니다. 이미지는 Node 24.14.0의 다중 아키텍처 digest, Pi 0.99.1, `pi-ollama-cloud` 0.12.2, `sandbox-runtime` 0.0.78과 `fd` 10.3.0의 해시를 고정합니다. `npm ci`로 공급자를 설치하고 현재 플러그인의 `npm pack` 결과를 별도 소비자 디렉터리에 배치합니다. 로컬 Ollama 서버는 설치하지 않습니다.

먼저 키 없는 검증을 실행합니다. 처음에는 이미지 빌드에 네트워크가 필요하고, 오프라인 검증 컨테이너는 네트워크 없이 실행합니다.

```sh
npm run verify:docker -- --mode offline --platform linux/amd64
```

ARM Docker 호스트에서 별도 ARM64 결과를 얻으려면 `--platform linux/arm64`로 실행합니다. 중첩 네임스페이스와 새 `/proc`, 네이티브 seccomp를 지원해야 합니다. 하네스는 외부 컨테이너의 seccomp·systempaths 제한만 해제하고 모든 capability를 제거하며 `no-new-privileges`를 적용합니다. 내부 파일·네트워크·Unix 소켓 격리와 PID 네임스페이스를 약화하는 옵션은 켜지 않습니다. 호스트 디렉터리·Docker 소켓 마운트와 포트 공개는 없습니다.

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

현재 실행 결과와 차이 목록은 [최종 인계](docs/handoffs/auto-review/07-conformance.json), 환경 복구 경위는 [Docker 인계](docs/handoffs/auto-review/06-docker-cloud.json), 고정 기준과 담당 검증은 [기준 계약](docs/handoffs/auto-review/02-contracts.json)에 있습니다. 과거 Docker 코드는 확인되지 않아 하네스를 재구성했으며, 새 검증 성공을 과거 실행의 증거로 사용하지 않습니다.

이전 ARM 호스트의 x64 실행에서 발생한 `apply-seccomp: prctl(PR_SET_SECCOMP): Invalid argument`는 프로그램 기준으로 보조 프로그램을 고르던 문제였습니다. 현재는 커널 기준으로 선택하고, 실제 필터 활성화와 Unix 소켓 차단을 검증합니다. ARM 커널 위의 x64 워크로드 검증과 물리 x64 호스트의 검증은 구분합니다. 최신 결과는 최종 인계 보고서에 기록합니다. GLM5.3 실모델 검증은 이전 실행에서 키가 전달되지 않아 아직 확인하지 못했습니다. 공개 정책·흐름의 호환성 검증은 독점 Codex 모델과 모든 판단이 같다는 뜻이 아닙니다.
