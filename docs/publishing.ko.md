# 작업 공간 패키지를 npm에 배포하기

[English](publishing.md) | **한국어**

`pnpm release`에서 **패키지 하나와 버전 하나**를 선택하고 릴리스 커밋·태그·푸시를 확인합니다. GitHub Actions가 해당 패키지를 빌드·검사하고 압축 파일을 보관한 뒤, 같은 파일을 Trusted Publishing으로 npm에 게시합니다. 로컬 릴리스 명령은 npm에 게시하지 않으며 npm 게시용 자격 증명을 요구하지 않습니다.

저장소 관리자를 위한 안내입니다. 별도 설명이 없으면 모든 셸 명령은 저장소 루트에서 실행합니다. 게시한 npm 버전은 공개되며 덮어쓸 수 없습니다. 게시를 승인하기 전에 선택한 패키지·버전·압축 파일을 확인하세요.

## 패키지와 릴리스 순서

루트 패키지는 비공개입니다. 아래 작업 공간 패키지 6개를 독립적으로 릴리스할 수 있습니다.

| 패키지 | 디렉터리 | 현재 체크아웃의 매니페스트 버전 |
| --- | --- | --- |
| `@buyong/redact` | `packages/redact` | `0.1.0` |
| `@buyong/pi-codex-auto-review` | `packages/pi-codex-auto-review` | `0.3.0` |
| `@buyong/pi-codex-computer-use` | `packages/pi-codex-computer-use` | `0.1.0` |
| `@buyong/pi-codex-fast-mode` | `packages/pi-codex-fast-mode` | `0.1.0` |
| `@buyong/pi-codex-image-gen` | `packages/pi-codex-image-gen` | `0.2.1` |
| `@buyong/pi-codex` | `packages/pi-codex` | `0.1.0` |

이는 **로컬 매니페스트 버전이며 npm 게시 상태나 태그 푸시의 근거가 아닙니다.** 릴리스 명령은 실행할 때마다 공개 레지스트리를 다시 확인합니다.

의존 패키지를 사용하는 패키지보다 먼저 게시합니다.

1. 자동 검토보다 `@buyong/redact`를 먼저 게시합니다. 자동 검토는 `@buyong/redact@0.1.0`에 고정하며 번들로 포함하지 않습니다.
2. 통합 패키지보다 개별 확장을 먼저 게시합니다. 통합 패키지는 자동 검토 `0.3.0`, Computer Use `0.1.0`, Fast 모드 `0.1.0`, 이미지 생성 `0.2.1`에 고정합니다.
3. 의존 패키지를 갱신한 뒤 사용하는 패키지의 고정 버전과 루트 `package-lock.json`을 갱신하고 커밋한 다음 릴리스합니다. 릴리스 명령이 의존 버전을 **자동 갱신하지는 않습니다.**

통합 압축 파일에는 확장 4개와 런타임 의존성을 묶습니다. Pi 호스트와 Codex 비공개 런타임은 포함하지 않습니다. 기존 패키지 검사는 통합 패키지의 확장 고정 버전이 포장하는 작업 공간 버전과 일치하는지 확인합니다.

Git 태그는 `<스코프 포함 패키지 이름>@<버전>`입니다. 예를 들어 `@buyong/pi-codex-auto-review@0.3.0`입니다. 워크플로는 정식 버전의 npm 배포 태그로 `latest`, 시험 버전에는 `next`를 사용합니다.

## 체크아웃 준비

`origin`의 `master`와 태그를 푸시할 권한, 릴리스 질문에 응답할 대화형 터미널이 필요합니다.

- CI와 같은 Node.js **24.14.0**, npm **11.5.1 이상**, 문서의 `pnpm release` 진입점용 pnpm **10**을 사용합니다.
- 루트 npm 잠금 파일로 설치합니다. npm 작업 공간 저장소이며 pnpm은 릴리스 스크립트만 실행합니다. `package-lock.json`을 pnpm 잠금 파일로 교체하지 마세요.
- 릴리스 스크립트·설정·워크플로·패키지 변경을 커밋합니다.
- `origin/master`를 추적하는 `master`에서 작업합니다. 사전 검사는 저장소 전체의 추적 파일·인덱스 변경을 거부합니다. 무관한 미추적 파일은 릴리스 커밋에 자동 포함하지 않습니다.

```sh
npm ci --ignore-scripts
git status --short
git branch --show-current
git rev-parse --symbolic-full-name '@{upstream}'
```

마지막 두 명령에서 `master`와 `refs/remotes/origin/master`가 나와야 합니다. 일반 릴리스 전에 선택한 패키지와 필요한 작업 공간 의존 버전의 npm 등록을 확인하세요.

## 패키지마다 Trusted Publishing 설정

npm에 등록된 패키지의 **Settings → Trusted publishing**에서 GitHub Actions 연결을 추가합니다.

| 항목 | 값 |
| --- | --- |
| Organization or user | `buYoung` |
| Repository | `pi-codex-auto-review` |
| Workflow filename | `npm-package.yml` |
| Environment name | 비워 둠 |
| Allowed actions | 직접 게시하는 `npm publish` 허용 |

`.github/workflows/npm-package.yml` 전체 경로가 아니라 파일명만 입력합니다. 이 워크플로는 직접 게시하므로 `npm stage publish`만 허용하면 부족합니다.

`@buyong/pi-codex`를 포함해 **패키지마다 별도로 연결**합니다. 의존 패키지의 연결은 사용하는 패키지의 게시를 허용하지 않습니다.

게시 작업은 GitHub-hosted runner에서 `id-token: write` 권한으로 실행하며 npm 최소 버전을 검사합니다. npm이 OIDC로 인증하므로 `NPM_TOKEN` GitHub Secret은 필요하지 않습니다. 연결 저장만으로 검증되지는 않으며 첫 실제 게시에서 확인합니다. [npm Trusted Publishing 공식 문서](https://docs.npmjs.com/trusted-publishers/)를 참고하세요.

### 미등록 패키지의 최초 게시

이 저장소의 태그 워크플로는 패키지가 먼저 등록되어 있어야 합니다. 선택한 패키지에 게시 버전이 없으면 `pnpm release`는 버전·커밋·태그를 변경하기 전에 중단하고 최초 게시 명령을 출력합니다.

이 초기 등록 단계에는 2FA를 설정한 npm 계정과 `@buyong` 게시 권한이 필요합니다. 필요한 의존 버전을 먼저 게시하세요. 이미 npm에 있는 버전에는 이 단계를 **반복하지 마세요.**

다음 예시는 통합 패키지를 선택합니다. `PACKAGE_NAME`을 등록할 패키지로 바꾸세요. `VERSION`은 해당 작업 공간의 매니페스트에서 읽습니다.

```sh
PACKAGE_NAME=@buyong/pi-codex
VERSION=$(npm pkg get version --workspace "$PACKAGE_NAME" | node --input-type=module -e 'let text = ""; for await (const chunk of process.stdin) text += chunk; console.log(Object.values(JSON.parse(text))[0]);')
npm view "$PACKAGE_NAME" versions --json --registry=https://registry.npmjs.org/
```

레지스트리 `404`는 미등록을 뜻합니다. 인증·네트워크·서비스 오류는 미등록의 근거가 아닙니다. 등록된 패키지는 일반 릴리스 흐름을 사용하세요.

첫 공개 게시 전에 빌드하고 압축 파일을 검사합니다.

```sh
npm run build -- --filter="$PACKAGE_NAME"
mkdir -p tmp/npm-release
npm pack --workspace "$PACKAGE_NAME" --pack-destination tmp/npm-release
```

`prepack`이 압축 내용을 검사합니다. 생성된 파일 목록과 선택한 버전을 확인하세요. 그다음 인증하고 선택한 작업 공간을 게시합니다.

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --workspace "$PACKAGE_NAME" --access public --registry=https://registry.npmjs.org/
npm view "$PACKAGE_NAME@$VERSION" version --registry=https://registry.npmjs.org/
```

2FA 요청에 응답합니다. 마지막 명령은 앞에서 선택한 매니페스트 버전을 반환해야 합니다. 해당 패키지의 Trusted Publisher를 연결하고 이후 게시는 `pnpm release`에서 새 버전으로 진행합니다. `npm publish --workspace`는 다시 포장하며 패키지 수명 주기 검사를 실행합니다. 이 초기 등록 경로는 CI의 검증한 결과물 게시와 다릅니다.

## 등록된 패키지 릴리스

`master`에서 변경을 커밋한 뒤 인자 없이 실행합니다.

```sh
pnpm release
```

1. **패키지를 선택합니다.** 루트 `workspaces` 선언의 실제 매니페스트를 읽고 비공개 패키지는 제외합니다. 오래된 `node_modules` 목록에 의존하지 않습니다.
2. **버전을 선택합니다.** 등록 여부와 작업 공간 런타임 의존 버전의 게시를 확인합니다. 구체적인 증가 버전을 선택하거나 빌드 메타데이터 없는 더 높은 SemVer를 입력합니다. 게시된 버전은 제외합니다. 현재 버전이 미게시 상태이고 로컬 패키지 릴리스 태그가 없으면 **현재 준비 버전 … 출시 (첫 태그 생성)**도 선택할 수 있습니다.
3. **커밋을 확인합니다.** release-it이 npm 버전 수명 주기 스크립트 없이 선택한 매니페스트 버전을 바꿉니다. 플러그인이 루트 잠금 파일을 갱신하고 스테이징합니다. 확인하면 릴리스 커밋을 만듭니다. 같은 버전의 출시는 빈 커밋으로 기록합니다.
4. **태그를 확인합니다.** `<패키지>@<버전>` 주석 태그를 만듭니다.
5. **푸시를 확인합니다.** `HEAD`를 `origin/master`에, 선택한 정확한 태그를 원자적으로 함께 푸시합니다. 아직 원격에 없는 다른 브랜치 커밋도 함께 전달합니다. 태그가 GitHub Actions 게시를 시작합니다.

**각 Git 질문에서 Enter는 승인입니다.** `n`이나 Ctrl+C는 해당 단계와 이후 단계를 중단합니다. 커밋 질문 전에 파일 변경과 스테이징이 끝났을 수 있습니다. 취소해도 완료한 작업은 보존합니다. [복구 안내](#중단과-실패-후-확인)를 참고하세요.

진입점은 TTY를 요구하고 명령 인자를 거부합니다. `--ci`, 자동 응답, 버전 인자와 커밋·태그·푸시 단계 생략을 지원하지 않습니다. 로컬 릴리스는 패키지 재빌드·패키지 테스트 실행·npm 게시를 하지 않습니다. 아래 패키지 검사는 CI가 실행합니다.

의존성을 갱신했다면 의존 순서대로 이 흐름을 반복합니다. 준비한 버전이 이미 게시됐다면 더 높은 버전을 선택하세요. 같은 npm 버전을 다시 게시하지 마세요.

## GitHub Actions의 검사와 게시

패키지 태그를 푸시하면 `.github/workflows/npm-package.yml`이 시작합니다. Actions에는 **npm 배포**로 표시됩니다.

| 단계 | 검사와 결과 |
| --- | --- |
| 검증 | 태그의 작업 공간을 찾고 태그·매니페스트 버전과 `origin/master`에 포함된 커밋인지 확인합니다. 등록 여부, 버전 중복과 작업 공간 런타임 의존 버전의 게시도 확인합니다. |
| 빌드 | `ubuntu-22.04`, Node.js 24.14.0과 커밋된 npm 잠금 파일로 선택한 Turborepo 빌드를 실행합니다. |
| 관련 테스트 | 자동 검토는 `test:policy`를 실행합니다. `@buyong/redact`는 작업 공간을 빌드하고 `test:redaction`을 실행합니다. 전체 실모델·운영체제 검증은 아닙니다. |
| 포장 | `npm pack --workspace`로 패키지의 `prepack`과 압축 검사를 실행합니다. |
| 보관 | 검증한 `.tgz`를 `npm-package` 결과물로 업로드합니다. |
| 게시 | 별도 작업이 같은 압축 파일을 내려받아 OIDC로 `npm publish`를 실행합니다. 배포 태그는 `latest` 또는 `next`입니다. |

패키지별 압축 검사는 다음과 같습니다.

- **자동 검토:** TypeScript를 컴파일하고 저장소의 공용 README·라이선스·출처 고지·문서를 임시 복사합니다. 필수 모듈과 JavaScript 규칙 작업 스레드를 확인하며 네이티브 결과물과 묶인 의존성을 거부합니다. `postpack`은 복사한 파일을 제거합니다.
- **Computer Use·Fast 모드·이미지 생성·redact:** 필수 JavaScript·선언·패키지 문서와 허용 파일 목록을 확인합니다. 이미지 생성은 번들 스킬과 출처 표시도, redact는 가림·개인정보 데이터 모듈도 확인합니다.
- **통합 패키지:** 원래 확장 진입점, `imagegen` 스킬과 런타임 의존성을 빌드·준비합니다. 정확한 버전·필수 파일을 확인하고 Pi 호스트·네이티브 결과물·Codex 비공개 런타임의 포함을 거부합니다.

**Actions → npm 배포 → Run workflow**는 선택한 패키지의 압축 파일을 준비하지만 **게시하지 않습니다.** 미등록 패키지도 수동 경로로 검사할 수 있습니다. 등록·의존 버전 게시 검사는 태그 게시에 적용합니다.

JavaScript 배포는 플랫폼별 규칙 바이너리 요구를 없앱니다. 모든 호스트 운영체제나 셸의 지원을 뜻하지는 않습니다. 별도 **자동 검토 운영체제 검증** 워크플로에는 Linux x64·Windows x64 실행 검사가 있습니다. 범위는 [검증 안내](testing/auto-review-protection.ko.md)를 참고하세요.

## 중단과 실패 후 확인

릴리스 상태를 보고할 수 있는 단계부터 로컬 명령은 시작·현재 HEAD, 남은 파일·인덱스 변경, 선택한 파일 버전, 관련 로컬 태그와 푸시 시도를 출력합니다. 중단해도 이미 완료한 버전·인덱스·커밋·태그 변경은 되돌리지 않습니다.

계속할 방법을 정하기 전에 로컬과 원격 상태를 확인합니다.

```sh
git status --short
git log -1
git ls-remote origin refs/heads/master 'refs/tags/*@*'
```

- **커밋 전 중단:** 매니페스트와 루트 잠금 파일 변경을 확인합니다. 인덱스가 그대로라고 가정하지 마세요.
- **커밋·태그 후 중단:** 해당 기록을 보존하고 확인합니다. `pnpm release` 재실행은 이어하기가 아니며, 기존 태그와 충돌하거나 다른 버전을 선택할 수 있습니다.
- **푸시 실패:** 확인하기 전에는 원격 상태를 알 수 없습니다. release-it은 푸시 오류 후 원격 태그 정리를 시도할 수 있으므로 한 메시지만으로 최종 상태를 판단하지 마세요.
- **Actions 실패:** 실패한 작업을 보고 npm을 먼저 확인합니다. 미게시 상태라면 원인을 해결한 뒤 해당 실패 작업을 다시 실행합니다. 게시가 성공했다면 같은 버전을 다시 게시하지 말고 새 변경에 새 버전을 사용합니다.

푸시한 릴리스 태그를 자동 복구 목적으로 삭제하거나 다시 만들지 마세요.

## 게시와 설치 확인

`PACKAGE_NAME`과 `VERSION`을 실제 릴리스한 패키지·버전으로 설정합니다. 다음은 자동 검토 릴리스 이후의 예시입니다.

```sh
PACKAGE_NAME=@buyong/pi-codex-auto-review
VERSION=0.3.1
npm view "$PACKAGE_NAME@$VERSION" version --registry=https://registry.npmjs.org/
npm view "$PACKAGE_NAME" dist-tags --registry=https://registry.npmjs.org/
pi install "npm:$PACKAGE_NAME@$VERSION"
pi list
pi
```

`0.3.1`은 예시이며 존재한다는 뜻이 아닙니다. 레지스트리가 선택한 버전을 반환하고 예상 배포 태그가 그 버전을 가리켜야 합니다. `pi list`에는 설치 소스가 나와야 합니다.

자동 검토는 `/approve`·`/approve-model`을 실행해 검토 모델이 대화 모델을 바꾸지 않는지 확인하고, 재시작 후 저장한 선택을 확인합니다. Full Access는 유지되지 않아야 합니다. 설정 경로와 보호 시작은 [사용법](usage.ko.md)을 참고하세요.

통합 패키지는 겹치는 개별 설치 소스를 제거한 뒤 활성화합니다. 구성 요소의 요구 사항은 계속 적용됩니다. [통합 패키지 안내](https://github.com/buYoung/pi-codex-auto-review/blob/master/packages/pi-codex/README.ko.md)와 [README의 개별 안내](../README.ko.md#작업-공간-패키지)를 참고하세요. `@buyong/redact`는 Pi 확장이 아닌 라이브러리이므로 `pi install` 대신 공개 import를 확인합니다.

## 게시하지 않고 압축 파일 준비

개발 의존성을 설치한 상태에서 패키지를 선택하고 실행합니다.

```sh
PACKAGE_NAME=@buyong/pi-codex-auto-review
npm run build -- --filter="$PACKAGE_NAME"
mkdir -p tmp/npm-release
npm pack --workspace "$PACKAGE_NAME" --pack-destination tmp/npm-release
```

압축 파일은 `tmp/npm-release`에 생깁니다. 다른 작업 공간을 검사하려면 `PACKAGE_NAME`을 바꿉니다. 릴리스 포장에 `--ignore-scripts`를 쓰면 필수 준비·검사를 건너뛰므로 사용하지 마세요. 공용 문서의 임시 복사본은 정상 포장 후 `postpack`이 제거합니다. 실패했다면 다시 시도하기 전에 작업 공간에 남은 복사본을 확인하세요.

## 관련 문서

- [release-it 21.0.1](https://github.com/release-it/release-it/tree/21.0.1)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [공개 스코프 패키지 게시](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [Pi 패키지 등록](https://github.com/earendil-works/pi/blob/v0.99.1/packages/coding-agent/docs/packages.md)
