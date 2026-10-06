# pi-codex-auto-review

[English](README.md) | **한국어**

Codex의 **Approve for me**에서 영감을 받은 [Pi](https://pi.dev) 자동 실행 승인 검토 확장입니다. 도구 호출을 로컬 규칙으로 판단하고, 승인이 필요한 작업은 검토 모델에 맡기거나 사용자에게 승인을 요청합니다. 승인된 호출은 Pi의 원래 실행기로 실행합니다.

**승인을 돕는 확장이며 OS 샌드박스가 아닙니다.** 승인된 명령은 호스트 권한으로 실행합니다. 파일·프로세스·네트워크 접근을 격리하지 않습니다.

이 저장소에는 Computer Use, Fast 모드, 이미지 생성, 민감 정보 가림 라이브러리와 Pi 통합 패키지도 있습니다. 필요한 패키지는 [작업 공간 패키지](#작업-공간-패키지)에서 선택하세요.

## 요구 사항

| 항목 | 요구 사항 |
| --- | --- |
| Node.js | 22.19 이상 |
| 자동 검토용 Pi | 0.99.1 또는 1.0.0. 매니페스트의 peer 범위가 더 넓어도 보호 CLI·SDK는 다른 호스트 버전을 거부합니다. |
| 모델 접근 | Pi에 공급자와 모델을 설정해야 합니다. 별도로 선택하지 않으면 현재 모델로 검토합니다. |
| 규칙 엔진 | TypeScript를 컴파일한 JavaScript입니다. Rust 컴파일러나 플랫폼별 규칙 바이너리는 필요하지 않습니다. Pi 자체의 네이티브 의존성은 별개입니다. |

이 문서는 현재 체크아웃을 설명합니다. npm으로 설치한 릴리스에는 아직 게시하지 않은 소스 변경이 없을 수 있습니다.

## 설치하고 자동 검토 사용하기

최근 게시된 자동 검토 패키지를 설치합니다.

```sh
pi install npm:@buyong/pi-codex-auto-review
pi list
pi
```

Pi에서 다음 순서로 진행하세요.

1. 필요하면 `/login`으로 모델 접근을 설정하고 대화 모델을 선택합니다.
2. `/approve`를 실행해 **Approve for me**를 선택합니다.
3. `이 프로젝트의 README를 읽고 실행 방법을 요약해 줘. 파일은 변경하지 마.`라고 요청합니다.

Pi가 요약을 반환하면 첫 사용을 마친 것입니다. 일반 정책 범위의 호출은 바로 실행할 수 있고, 승인이 필요한 호출은 선택한 방식으로 검토합니다. `/approve-model`로 대화 모델을 바꾸지 않고 별도의 검토 모델을 선택할 수 있습니다.

프로젝트에만 설치하려면 `pi install`에 `--local`을 추가합니다. 프로젝트 패키지는 Pi가 그 프로젝트를 신뢰한 뒤 로드합니다. 특정 릴리스로 고정하려면 npm 패키지 이름 뒤에 `@<version>`을 붙입니다. 이전 이름인 `pi-codex-auto-review`를 설치했다면 해당 소스를 제거한 뒤 스코프 패키지를 설치하세요.

**승인 제어가 로드되지 않으면 시작 자체를 거부해야 하나요?** [보호 CLI·SDK](docs/usage.ko.md#보호가-준비된-상태에서-시작하기)를 사용하세요. 일반 Pi 실행은 확장 로딩 실패를 알린 뒤 확장 없이 계속할 수 있습니다.

## 승인 방식 선택하기

| `/approve` 선택 | 동작 | 저장 여부 |
| --- | --- | --- |
| **Approve for me** | 승인이 필요한 호출을 모델이 검토합니다. 기본값입니다. | 저장 |
| **Ask for approval** | 승인이 필요한 호출을 사용자가 검토합니다. 일반 읽기나 작업 공간 쓰기까지 매번 묻지는 않습니다. | 저장 |
| **Full Access** | 확인 후 승인과 경로·명령·네트워크 제한을 건너뜁니다. | Pi를 종료하거나 다른 승인 방식을 선택할 때까지 적용하며 저장하지 않음 |

설정은 `<agentDir>/guard/settings.json` 또는 CLI·SDK에서 선택한 정책 파일에 저장합니다. `agentDir`은 보통 `~/.pi/agent`이며 `PI_CODING_AGENT_DIR`을 따릅니다. 선택창을 취소하면 기존 설정을 유지합니다. 명령·선택창·승인 창의 고정 문구는 영어입니다.

## 보호하는 범위

**Full Access를 끈 상태**에서는 다음과 같이 동작합니다.

- `workspace-write`는 작업 공간과 기본 임시 디렉터리의 일반 쓰기를 허용합니다. `read-only`에서는 쓰기를 승인 검토로 보냅니다.
- 가드 제어 파일, 선택한 정책 파일과 규칙 파일은 보호 도구로 읽거나 쓸 수 없습니다. 확장 자체 코드와 명시적으로 신뢰한 확장의 코드 디렉터리는 모델 쓰기에서 보호합니다.
- 프로젝트의 `.git`·`.agents`·`.codex`·`.aws`·`.pi` 메타데이터 쓰기는 무조건 차단하지 않고 검토합니다. 프로젝트 `.pi/guard`는 쓰기를 계속 차단합니다.
- 절대 거부는 모델 검토와 저장 승인보다 먼저 적용합니다. 검토 오류·시간 초과·취소를 승인으로 바꾸지 않습니다.
- 정확한 작업에 대한 승인은 도구·입력·실행 문맥·정책·요청 범위에 묶입니다. 조건을 충족하는 MCP 도구와 스킬 스크립트는 같은 버전·내용의 승인을 재사용할 수도 있습니다.
- 검토자에게 전달할 증거는 `@buyong/redact`로 가립니다. 개인정보 탐지와 사용자 지정 가림 규칙도 설정할 수 있습니다.

정책 설정, 승인 재사용, 재시도와 MCP 동작은 [사용법](docs/usage.ko.md)을 참고하세요.

## 사용 전에 알아둘 한계

- 검토 범위는 OS가 강제하는 권한 경계가 아닙니다. 승인된 셸과 인터프리터는 간접적으로 파일에 접근하거나 실행 중 다른 네트워크 목적지에 연결할 수 있습니다.
- 모든 디렉터리나 하드링크 별칭을 전수 검사하지 않고, 네트워크 프록시를 만들거나 외부 MCP 서버 내부 실행을 격리하지 않습니다.
- Pi, 로드한 확장 코드와 외부 MCP 서버는 신뢰하는 실행 구성 요소입니다. 다른 신뢰한 확장이 등록한 도구에 이 확장의 승인 제어가 자동으로 적용되지는 않습니다.
- 이미 MCP 서버에 전달한 요청의 취소 효과는 해당 서버 구현에 달려 있습니다.
- 참고한 Codex 공개 정책·규칙 계약은 독점 모델과 같은 판단이나 Codex 샌드박스의 보안을 보장하지 않습니다.
- 저장소 잠금 파일은 별도로 설치한 Pi 호스트의 의존성을 바꾸지 않습니다. [의존성 보안](docs/security/dependencies.ko.md)을 참고하세요.

정책·규칙의 기준은 Codex [`rust-v0.160.0`](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc)입니다.

## 작업 공간 패키지

저장소는 `packages/` 아래의 npm 작업 공간을 사용합니다. 각 패키지는 버전과 릴리스를 독립적으로 관리합니다. 연결된 패키지 안내의 실행 조건은 통합 설치 후에도 그대로 적용됩니다.

| 패키지 | 용도 |
| --- | --- |
| `@buyong/pi-codex-auto-review` | 자동 승인 검토. 이 README와 [사용법](docs/usage.ko.md)에서 설명합니다. |
| [`@buyong/pi-codex`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex/README.ko.md) | 확장 4개와 `imagegen` 스킬을 함께 설치하는 통합 패키지 |
| [`@buyong/pi-codex-computer-use`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-computer-use/README.ko.md) | 설치된 Codex Desktop 런타임을 통한 Computer Use·Chrome Browser Use. Linux는 지원하지 않습니다. |
| [`@buyong/pi-codex-fast-mode`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-fast-mode/README.ko.md) | 지원하는 OpenAI 모델의 Standard·Fast·Ultrafast 서비스 등급 선택 |
| [`@buyong/pi-codex-image-gen`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-image-gen/README.ko.md) | Pi의 `openai-codex` 구독 로그인으로 이미지 생성·편집 |
| [`@buyong/redact`](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/redact/README.ko.md) | 호스트와 독립적인 자격 증명·개인 키 가림과 선택적 개인정보 가림 |

통합 패키지와 같은 개별 확장을 함께 활성화하지 마세요. 도구·명령·이벤트 처리기가 중복 등록될 수 있습니다. 새로 준비한 패키지는 설치 전에 npm 게시 여부를 확인하세요. 로컬 매니페스트 버전만으로 게시 여부를 알 수는 없습니다.

## 소스 빌드와 검증

저장소 루트에서 실행합니다.

```sh
npm ci --ignore-scripts
npm run build
npm run verify:guard
```

`verify:guard`는 다시 빌드하고 현재 운영체제의 자동 검토 검증을 실행합니다. 유료 모델 호출 대신 모델·UI 고정 응답을 사용합니다. 결과는 `.reports/pi-guard/runs/<run ID>/<platform>/`에 저장하며, 체크아웃의 검증 인계 기록도 갱신합니다.

로컬 통과는 다른 운영체제나 실모델의 결과를 대신하지 않습니다. 별도 운영체제 워크플로에는 Linux x64·Windows x64 작업이 있습니다. Windows 검증은 규칙·승인 정책·파일 실행·취소를 다루며 전체 셸 지원을 확인하지는 않습니다. [검증표](docs/testing/auto-review-protection.ko.md)와 [Docker 안내](docs/usage.ko.md#docker에서-ollama-cloud-검증)를 참고하세요.

## 문서와 문의

- [사용법](docs/usage.ko.md) · [English](docs/usage.md) — 설치, 승인 설정, 보호 시작, 정책과 검증
- [배포 안내](docs/publishing.ko.md) · [English](docs/publishing.md) — 패키지별 릴리스, 최초 게시, Trusted Publishing과 복구
- [의존성 보안](docs/security/dependencies.ko.md) · [English](docs/security/dependencies.md) — 기록된 의존성 수정과 적용 범위
- [보호 경계 검증](docs/testing/auto-review-protection.ko.md) · [English](docs/testing/auto-review-protection.md) — 현재 검증, 과거 결과와 미검증 경계
- [이슈](https://github.com/buYoung/pi-codex-auto-review/issues) — 결함 신고와 질문

## 라이선스

[Apache-2.0](LICENSE). Codex 규칙 계약의 TypeScript 이식과 포함된 정책의 출처 표시는 [NOTICE](NOTICE)에 유지합니다.
