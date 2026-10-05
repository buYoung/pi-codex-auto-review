# pi-codex-auto-review

[English](README.md) | **한국어**

Codex의 ‘Approve for me’에서 영감을 받은 Pi 자동 실행 승인 검토 확장입니다. 승인 요청을 규칙과 보조 모델로 검토하거나 사용자가 직접 승인하도록 설정합니다. 승인된 도구는 Pi의 원래 실행기로 실행합니다. OS 샌드박스나 파일·네트워크 격리를 구성하지 않습니다. Codex 공개 소스 [`rust-v0.160.0`](https://github.com/openai/codex/tree/a956835d020762cb2b570053af06f643a11c0ecc)의 공개 승인 정책을 참고했습니다.

## 설치

`0.2.0`은 네이티브 규칙 실행 파일을 TypeScript 엔진으로 교체해 JavaScript로 배포하고, `vendor`의 재포장 Pi SDK를 제거합니다. 이 확장에는 Rust 컴파일러나 플랫폼별 규칙 바이너리가 필요하지 않습니다. Node.js와 Pi 호스트는 계속 필요하며, Pi 자체의 네이티브 모듈은 별개입니다.

```sh
pi install npm:@buyong/pi-codex-auto-review@0.2.2
pi list
```

확장 로딩 실패를 Pi가 무시할 수 있으므로 보호 시작이 필수인 실행은 [사용법](docs/usage.ko.md)의 CLI·SDK 진입점을 사용합니다.

## 동작 흐름

1. **정책 판단** — 절대 차단 경로와 `commandRules`를 먼저 평가합니다. 차단 경로는 모델 검토나 저장 승인으로 해제하지 않습니다.
2. **자동 검토** — 남은 작업은 검토 모델이 위험 등급과 결과를 판정합니다.
3. **승인** — 남은 범위는 사용자가 확정합니다.
4. **Pi 실행** — 승인된 작업을 원래 SDK 도구로 실행하며 취소 신호와 호출자 옵션을 전달합니다.

## 승인 설정

- `/approve`: **Approve for me**(보조 모델 검토) 또는 **Ask for approval**(사용자 승인)을 선택합니다.
- `/approve-model`: Pi의 현재 `/scoped-models` 범위에서 등록된 모델을 검색해 보조 검토 모델을 선택합니다. **Use current Pi model**로 현재 주 모델을 사용하도록 되돌릴 수 있습니다.

선택은 `<agentDir>/guard/settings.json`에 저장되고 다음 실행에도 적용됩니다. 주 대화 모델은 바뀌지 않습니다. 취소하면 기존 설정을 유지합니다.

## 요구 사항

| 항목 | 요구 |
| --- | --- |
| Node.js | 22.19 이상 |
| Pi | 0.99.1 또는 1.0.0 |
| 현재 소스 빌드 | TypeScript 사용. Rust 컴파일러와 플랫폼별 규칙 실행 파일 불필요 |
| 규칙 실행 | 비동기 평가는 Node.js 작업 스레드, 동기 API는 Node.js 자식 프로세스 |

## 보호 경계

- 모드는 `workspace-write`(작업 공간과 기본 임시 경로 쓰기 허용)와 `read-only`입니다.
- 제어·인증 경로와 프로젝트의 `.pi` 설정·확장 코드, 신뢰한 확장의 코드 디렉터리는 모델 쓰기를 절대 차단합니다.
- 일반 범위를 넘는 파일 접근, 검토 규칙, 해석하지 못하는 명령은 실행 전에 검토합니다. 읽기와 기존 범위 안의 일반 작업은 정책에 따라 실행합니다.
- 승인은 한 번, 세션, 규칙 저장 중 선택하며, 저장 승인은 정확한 도구·입력·정책에 묶입니다.
- 자동 검토는 기본적으로 현재 모델로 수행하고, 반복 거부되면 실제 작업을 중단합니다. 검토 오류는 승인으로 바뀌지 않습니다.
- MCP 도구 승인과 프로젝트 지침 탐색도 같은 신뢰·검토 경계 안에 둡니다.

각 결합 조건과 설정은 [사용법](docs/usage.ko.md) 문서에 있습니다.

## 한계와 비보장

- 승인된 셸과 인터프리터는 호스트 권한으로 실행합니다. 검토에 표시한 파일·도메인 범위는 OS가 강제하는 접근 제한이 아닙니다.
- 재귀 디렉터리 탐색·하드링크 전수 검사·네트워크 프록시를 구성하지 않습니다. 간접 파일 접근과 실행 중 목적지 변경을 격리하지 않습니다.
- Pi, 신뢰한 확장 코드와 외부 MCP 서버의 내부 실행은 신뢰 경계에 포함됩니다.
- 이미 MCP 서버에 전달한 요청의 취소 효과는 외부 공급자의 구현에 달려 있습니다.
- 공개 정책·흐름의 호환성 검증은 독점 Codex 모델과 모든 판단이 같다는 뜻이 아닙니다.
- 별도로 설치한 Pi 호스트의 의존성을 자동으로 교체하지 않습니다. 이 저장소의 조치 근거는 [의존성 보안](docs/security/dependencies.ko.md) 문서에 있습니다.

## 검증

```sh
npm run verify:guard
```

`verify:guard`는 빌드와 현재 운영체제의 전체 로컬 검증을 실행합니다. 다른 운영체제와 실모델의 결과는 별도 실행 근거로 기록하며 로컬 통과로 대신하지 않습니다.

- `npm run test:*` 단일 검증은 실제 자격 증명이나 유료 모델을 사용하지 않습니다. 환경 제한·의존성 부재는 통과로 처리하지 않습니다.
- `npm run verify:platform`은 현재 운영체제의 전체 검증을 실행합니다.
- GitHub Actions의 `자동 검토 운영체제 검증`은 실제 Linux x64 검사와 Docker 이미지·결과 반출을 수행합니다. workflow에는 Ollama 키를 전달하지 않습니다.
- Windows의 `verify:windows`는 규칙 엔진·승인 정책·파일 실행과 취소를 검증합니다. 전체 셸 실행 지원을 검증하는 명령은 아닙니다.
- Docker 컨테이너 검증 활용은 [사용법의 Docker 절](docs/usage.ko.md#docker에서-ollama-cloud-검증)에 있습니다.
- 각 실행은 `.reports/pi-guard/runs/<실행 ID>/<플랫폼>/`에 저장되고, 보호·허용·차단 사례는 [보호 경계 검증표](docs/testing/auto-review-protection.ko.md)에 있습니다.

## 문서

- [사용법](docs/usage.ko.md) · [English](docs/usage.md) — 설치, 소스 빌드, CLI·SDK, 정책, Docker 검증
- [배포 안내](docs/publishing.ko.md) · [English](docs/publishing.md) — `pnpm release`, npm Trusted Publishing, GitHub Actions
- [의존성 보안](docs/security/dependencies.ko.md) · [English](docs/security/dependencies.md) — 감사 항목, 수정 근거와 적용 범위
- [보호 경계 검증](docs/testing/auto-review-protection.ko.md) · [English](docs/testing/auto-review-protection.md) — 허용·차단 사례, 실패, 취소와 미검증 범위

## 라이선스

[Apache-2.0](LICENSE). Codex 규칙 계약의 TypeScript 이식과 포함된 정책의 출처 표시는 [NOTICE](NOTICE)에 유지합니다.
