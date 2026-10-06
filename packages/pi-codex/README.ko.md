# @buyong/pi-codex

[English](README.md) | **한국어**

Codex에서 영감을 받은 Pi 확장 4개를 함께 설치합니다. 자동 승인 검토, Computer Use·Browser Use, OpenAI Fast 모드와 `imagegen` 스킬을 포함한 이미지 생성을 제공합니다. 각 구성 요소는 기존 구현·명령·설정을 유지합니다. 통합 패키지가 별도의 자동화·승인 엔진을 추가하지는 않습니다.

## 요구 사항

- 매니페스트 기준 Node.js 22.19 이상과 Pi 0.99.1 이상. 저장소는 Pi 0.99.1로 빌드하며 구성 요소별 검증 범위는 더 좁을 수 있습니다.
- 설정된 Pi 대화 공급자와 모델
- 사용할 기능의 추가 요구 사항. 아래 표를 확인하세요. 통합 설치가 Codex Desktop을 설치하거나 계정 접근을 제공하지는 않습니다.

| 구성 요소 | 명령·도구 | 추가 요구 사항과 한계 |
| --- | --- | --- |
| [자동 검토](https://github.com/buYoung/pi-codex-auto-review/blob/master/README.ko.md) | `/approve`, `/approve-model`, `/approve retry` | 현재 모델이나 선택한 검토 모델을 사용합니다. OS 샌드박스가 아닙니다. 보호 CLI·SDK는 Pi 0.99.1·1.0.0만 받습니다. |
| [Computer Use](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-computer-use/README.ko.md) | `/computer-use`, `/computer-use-check`, `mcp__cua_repl__js` | 설치된 Codex Desktop 런타임이 필요합니다. Chrome Browser Use에는 확장·네이티브 호스트도 필요합니다. macOS 실검증 기록이 있으며 Windows는 구현했지만 미검증이고 Linux는 미지원입니다. |
| [Fast 모드](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-fast-mode/README.ko.md) | `/codex-fast`, `/openai-tier`, `/openai-settings` | 지원하는 공급자·모델·인증 조합에서만 적용합니다. 기본값은 Standard입니다. 요청한 등급이 실제 서버 처리나 과금의 확인은 아닙니다. |
| [이미지 생성](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-image-gen/README.ko.md) | `image_gen`, `/codex-imagen`, `imagegen` 스킬 | Pi의 `/login openai-codex` 구독 로그인이 필요합니다. 로그인 없이는 이미지 도구와 스킬을 숨깁니다. |

**통합 패키지와 같은 개별 확장을 함께 활성화하지 마세요.** 도구·명령·이벤트 처리기가 중복 등록될 수 있습니다.

## 설치하거나 개별 패키지에서 전환하기

게시된 npm 릴리스는 다음과 같이 설치합니다.

```sh
pi install npm:@buyong/pi-codex
pi list
pi
```

버전을 생략하면 최근 게시된 릴리스를 선택합니다. 고정하려면 `@<version>`을 붙입니다. 로컬 매니페스트 버전은 npm 게시의 근거가 아닙니다. 아직 등록하지 않은 패키지는 아래 소스 경로를 사용하세요.

개별 확장에서 전환할 때는 다음 순서로 진행합니다.

1. `pi list`에서 개별 확장의 설치 소스를 확인합니다.
2. 겹치는 항목을 `pi remove <source>`로 제거합니다. 프로젝트 범위의 항목은 `pi remove --local <source>`를 사용합니다.
3. 원하는 범위에 통합 패키지를 설치하고 Pi를 재시작합니다.

구성 요소의 설정 경로는 바뀌지 않아 기존 설정을 재사용합니다. 전역·프로젝트 항목을 모두 확인해 겹치는 설치가 남지 않도록 하세요. 프로젝트 설치는 `pi install --local`을 사용하며 프로젝트 신뢰가 필요합니다.

## 첫 작업 실행하기

Pi 안에서 다음과 같이 진행합니다.

1. 필요하면 대화 모델과 자격 증명을 설정합니다.
2. `/approve`에서 **Approve for me** 또는 **Ask for approval**을 선택합니다.
3. 프로젝트 README를 읽고 파일 변경 없이 실행 방법을 요약하도록 요청합니다.

다른 기능은 각 설정 명령에서 시작합니다.

| 목표 | 첫 동작 | 확인할 결과 |
| --- | --- | --- |
| 앱·Chrome 조작 | `/computer-use-check`, 그다음 `/computer-use` | 누락된 요구 사항을 해결하고 필요한 기능만 켭니다. 앱·출처 접근은 런타임 승인으로 제어합니다. |
| 더 빠른 서비스 등급 요청 | `/codex-fast`, 그다음 `/openai-tier` | 모드를 선택하고 현재 모델에서 적용되는지 확인합니다. |
| 이미지 생성 | `/login openai-codex`, 그다음 `/codex-imagen` | 로그인하고 이미지 모델을 선택한 뒤 `image_gen` 사용을 요청합니다. 대화 모델은 유지해도 됩니다. |

Computer Use는 기본으로 두 기능이 켜져 있어 Pi 시작 시 런타임 실행을 시도할 수 있습니다. 사용하지 않으면 둘 다 끄세요. 이미지 생성은 구독 로그인 전까지 숨기며, Fast 모드는 설정이나 `--fast`로 바꾸지 않았다면 Standard로 시작합니다.

일반 Pi 확장 탐색으로 이 패키지를 로드해도 보호 시작을 보장하지는 않습니다. 자동 검토 제어가 없을 때 시작을 거부해야 한다면 [자동 검토 CLI·SDK](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/usage.ko.md#보호가-준비된-상태에서-시작하기)를 사용하세요. 그 진입점에서는 추가 구성 요소를 명시적으로 로드해야 합니다.

## 소스 빌드와 로드

저장소 루트에서 실행합니다.

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex
node_modules/.bin/pi -ne -e ./packages/pi-codex
```

구성 요소를 먼저 빌드한 뒤 게시 파일과 런타임 의존성을 통합 패키지 내부에 준비합니다. `-ne`는 자동 확장 탐색을 끄고 `-e`는 영구 설치 항목 없이 이번 실행에 패키지를 로드합니다. Desktop 요구 사항과 이미지 로그인은 그대로 적용됩니다.

구성 요소를 변경한 뒤 다시 빌드하세요. 통합 패키지는 개별 소스 디렉터리가 아니라 내부에 준비한 복사본을 로드합니다.

## 패키지 내용과 배포

매니페스트는 `dependencies`에서 확장 4개의 버전을 고정하고 `bundleDependencies`로 포함합니다. `pi.extensions`·`pi.skills`는 묶인 패키지의 원래 진입점과 스킬 디렉터리를 직접 가리킵니다. 개발 의존성, Pi 호스트와 Codex 비공개 런타임은 제외합니다.

이 패키지보다 고정한 개별 확장 버전을 먼저 게시하세요. 갱신한 구성 요소를 포함하려면 고정 버전과 루트 잠금 파일을 바꾸고 다시 빌드한 뒤 통합 패키지를 릴리스합니다. 최초 등록, 패키지별 Trusted Publishing과 대화형 릴리스는 [배포 안내](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/publishing.ko.md)를 참고하세요.

## 라이선스

[Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE). npm 압축 파일에 `LICENSE`로 포함하며 의존성은 각 라이선스와 출처 표시를 유지합니다.
