# Pi Codex 통합 패키지

`@buyong/pi-codex` 하나로 자동 승인 검토, Computer Use·Browser Use, Fast 모드, 이미지 생성 확장과 `imagegen` 스킬을 함께 설치합니다. 각 기능은 기존 패키지의 구현과 설정을 그대로 사용합니다.

## 설치

`0.1.0`은 첫 게시를 준비한 버전입니다. 다음 명령은 npm 게시 후 사용할 수 있습니다.

```sh
pi install npm:@buyong/pi-codex@0.1.0
pi list
pi
```

이미 개별 확장을 설치했다면 `pi list`에 표시된 설치 소스를 `pi remove <source>`로 제거하고 통합 패키지로 전환하세요. 두 설치를 함께 활성화하면 도구·명령·이벤트가 중복 등록될 수 있습니다. 프로젝트에 설치한 항목은 같은 범위에서 `pi remove --local <source>`로 제거합니다. 설정 파일의 위치는 기존 패키지와 같으므로 이전 설정을 계속 사용합니다.

## 포함 기능과 요구사항

Node.js 22.19 이상과 Pi 0.99.1 이상이 필요합니다. 통합 설치가 각 기능의 실행 조건을 대신 충족하지는 않습니다.

| 패키지 | 기능·명령 | 추가 조건·설명 |
| --- | --- | --- |
| `@buyong/pi-codex-auto-review` | 실행 승인 검토, `/approve`, `/approve-model` | 승인된 도구는 Pi 실행기로 실행하며 OS 샌드박스를 구성하지 않습니다. |
| `@buyong/pi-codex-computer-use` | Computer Use·Browser Use, `/computer-use`, `/computer-use-check` | Codex 데스크톱의 설치된 런타임이 필요합니다. Browser Use에는 Chrome과 관련 확장이 필요합니다. |
| `@buyong/pi-codex-fast-mode` | Fast·Ultrafast, `/codex-fast` | 지원 모델·인증 조건에서만 적용하며 기존 기본값을 유지합니다. |
| `@buyong/pi-codex-image-gen` | `image_gen`, `/codex-imagen`, `imagegen` 스킬 | Pi의 `/login openai-codex` 로그인이 필요하며 로그인 전에는 모델에게 도구와 스킬을 숨깁니다. |

Computer Use는 Linux를 지원하지 않으며 Windows 실기기 검증은 이루어지지 않았습니다. 세부 요구사항과 사용법은 [자동 승인 검토](https://github.com/buYoung/pi-codex-auto-review/blob/master/README.ko.md), [Computer Use](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-computer-use/README.ko.md), [Fast 모드](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-fast-mode/README.ko.md), [이미지 생성](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex-image-gen/README.ko.md) 안내를 참고하세요.

## 소스에서 실행

저장소 루트에서 실행합니다.

```sh
npm install
npm run build -- --filter=@buyong/pi-codex
node_modules/.bin/pi -ne -e ./packages/pi-codex
```

`-ne`는 자동 확장 탐색을 끄고 지정한 통합 패키지를 로드합니다. Computer Use 런타임 준비와 이미지 생성 로그인은 배포 패키지와 동일하게 필요합니다.

## 의존성과 배포

네 패키지를 `dependencies`에 검증할 버전으로 고정하고 `bundleDependencies`로 배포 압축 파일에 포함합니다. Pi의 `pi.extensions`와 `pi.skills`는 포함된 패키지의 원래 진입점과 스킬 경로를 직접 가리킵니다. 통합 패키지에는 별도의 기능 구현이나 확장 초기화 코드가 없습니다. 이 구성은 [Pi의 패키지 의존성 규칙](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/packages.md)을 따릅니다.

빌드는 의존 패키지를 먼저 빌드하고 npm 배포 파일 목록에 따라 실행 의존성과 문서를 내부에 준비합니다. 개발 의존성, Pi 호스트, Codex의 비공개 런타임은 포함하지 않습니다. 개별 패키지를 업데이트한 뒤에는 통합 패키지의 의존 버전도 갱신하고 다시 배포해야 합니다.

저장소의 기존 릴리스 메뉴와 `npm-package.yml`에서 `@buyong/pi-codex`를 선택할 수 있습니다. 최초 npm 등록, 패키지별 Trusted Publisher 연결, 이후 GitHub Actions 릴리스는 [배포 안내](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/publishing.ko.md)를 따릅니다. 현재 릴리스 절차는 작업 공간 의존성의 npm 게시 여부를 확인하므로 개별 패키지를 먼저 게시합니다.

## 라이선스

[Apache-2.0](LICENSE). 포함된 의존성의 라이선스와 출처 표시는 각 패키지에 유지합니다.
