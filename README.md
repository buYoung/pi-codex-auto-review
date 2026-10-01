# Pi 권한 플러그인

Pi 0.99.1의 공개 API를 사용해 규칙 기반 권한 판단, 현재 모델의 별도 검토, 사용자 승인, 운영체제 샌드박스를 연결합니다. OpenShell과 Docker는 사용하지 않습니다.

## 실행

Node.js 22.19 이상과 Pi 0.99.1이 필요합니다. 개발 의존성을 설치하고 빌드합니다.

```sh
npm install
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

기본 모드는 작업 디렉터리 쓰기를 허용합니다. 작업 디렉터리 밖의 접근과 불명확한 명령은 검토를 거치고, 권한 확대는 사용자 승인이 필요합니다. 보호 경로 차단은 모델 판단이나 저장된 승인보다 우선합니다.

TUI·RPC에서 한 번, 세션, 규칙 저장 승인을 선택할 수 있습니다. print·JSON에서는 사용자 승인이 필요한 작업을 차단합니다. 저장 승인은 정확한 도구·입력·작업 디렉터리·호출 경로·정책·권한에 묶이며, 설정 변경 시 재승인이 필요합니다. 한 번 승인은 파일 편집의 읽기·접근 확인·쓰기 등 하나의 논리적 동작 전체에만 적용됩니다.

`--policy /절대/경로/policy.json`으로 사용자가 관리하는 설정을 지정할 수 있습니다. 잘못된 설정은 실행을 막습니다.

```json
{
  "mode": "workspace-write",
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

`mode`는 `read-only` 또는 `workspace-write`입니다. 지원하지 않는 쉘 문법과 인터프리터 호출은 검토 대상으로 처리합니다. 규칙은 리터럴 인자 접두사이며, 복합 명령의 모든 구간에서 차단 규칙을 우선합니다. Codex의 `.rules` 문법과 완전히 호환되지는 않습니다.

## 실행 경계

`@anthropic-ai/sandbox-runtime` 0.0.78을 호출마다 별도 중개 프로세스에서 사용합니다. 쉘의 하위 프로세스와 `read/edit/write/grep/find/ls`의 보조 파일 접근도 같은 OS 경계 안에서 실행합니다. 스트리밍, 구조화 결과, 편집 형식과 오류 처리는 Pi 도구 구현을 유지합니다.

상속 환경은 기본 실행 변수만 전달하고, 호출자 환경에서도 자격 증명·로더·쉘 초기화·프록시 변수를 제거합니다. Unix 소켓과 로컬 포트 직접 접근은 기본 차단합니다. 모델과 승인 창 시간 제한은 밀리초, Pi 쉘 시간 제한은 초입니다. 실패한 명령을 자동으로 다시 실행하지 않습니다.

Pi와 명시적으로 신뢰한 확장은 제어 계층입니다. 임의의 같은 프로세스 확장 코드나 원격 MCP 서버 내부까지 이 샌드박스로 보호하지는 않습니다. 보호 진입점은 자동 확장 탐색을 끄고, 알 수 없는 도구는 신뢰한 어댑터가 없으면 차단합니다.

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
npm run verify:guard
```

테스트는 실제 자격 증명과 유료 모델을 사용하지 않습니다. 네이티브 테스트는 임시 파일·로컬 서비스에서 허용 동작과 차단 효과를 함께 관찰합니다. 호스트의 중첩 샌드박스 제한이나 의존성 부재는 통과로 처리하지 않습니다.

macOS와 Linux 결과를 각각 기록합니다. Linux에서 직접 검증하기 전에는 Linux 지원을 주장하지 않으며, 전체 검증 명령은 필수 플랫폼 증거가 없으면 실패 상태를 기록합니다. 실제 결과와 인계 자료는 `.reports/pi-guard/` 및 `docs/handoffs/pi-guard/`에 저장합니다.
