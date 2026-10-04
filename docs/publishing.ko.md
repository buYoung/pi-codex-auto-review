# npm 배포 안내

[English](publishing.md) | **한국어**

`pnpm release`에서 버전을 선택하고 커밋·태그·푸시를 확인하면 GitHub Actions가 macOS ARM64와 Linux x64 실행 파일을 빌드하고 npm에 게시합니다. 로컬 명령은 npm 자격 증명을 사용하지 않습니다.

## 처음 한 번 설정

### 소스와 의존성

릴리스 설정, 스크립트, 패키지 수정 사항과 워크플로를 `master`에 커밋하고 원격 저장소에 반영합니다. 릴리스 브랜치는 `origin/master`를 추적해야 합니다. 수정된 파일이나 인덱스가 남아 있으면 릴리스 명령은 중단합니다.

Node.js 24.14.0과 pnpm 10을 사용할 수 있는 터미널에서 저장소 루트로 이동하고 의존성을 설치합니다.

```sh
npm ci --ignore-scripts
```

의존성 설치와 CI 빌드는 기존 `package-lock.json`을 사용합니다. `pnpm`은 릴리스 스크립트의 실행 진입점으로 사용하며, `pnpm-lock.yaml`로 설치 방식을 바꾸지 않습니다. 현재 패키지는 샌드박스 의존성을 묶지 않고 Pi 호스트를 peer dependency로 사용합니다.

### npm Trusted Publisher

`pi-codex-auto-review`의 npm **Settings → Trusted publishing**에서 GitHub Actions 연결을 추가합니다.

| 항목 | 입력 값 |
|---|---|
| Organization or user | `buYoung` |
| Repository | `pi-codex-auto-review` |
| Workflow filename | `npm-package.yml` |
| Environment name | 비워 둠 |
| Allowed actions | 직접 게시하는 `npm publish` 허용 |

워크플로 이름은 파일명만 입력합니다. `.github/workflows/` 경로를 붙이지 않습니다. 기본 `npm stage publish` 권한만 허용하면 이 워크플로의 직접 게시가 실패합니다.

게시 작업에는 `id-token: write` 권한이 설정되어 있고 npm 11.5.1 이상인지 확인합니다. GitHub-hosted runner가 발급하는 OIDC 인증을 사용하므로 `NPM_TOKEN`을 GitHub Secret에 추가하지 않습니다. npm의 연결은 저장 시 검증되지 않으므로 실제 첫 게시에서 확인해야 합니다. [npm Trusted Publishing 공식 안내](https://docs.npmjs.com/trusted-publishers/)

## 버전 선택과 릴리스

`master`의 변경 사항이 커밋된 상태에서 실행합니다.

```sh
pnpm release
```

1. 현재 버전과 구체적인 다음 버전을 보고 하나를 선택합니다. `0.1.1`에서 `0.1.2`를 출시할 때는 **patch**를 선택합니다. 로컬 버전 태그가 없으면 **현재 준비 버전 출시**도 선택할 수 있습니다.
2. 커밋 여부를 확인하고 릴리스 커밋을 만듭니다. 현재 버전을 그대로 출시할 때는 출시 기록을 남기는 빈 커밋을 만듭니다.
3. `v<버전>` 태그 생성 여부를 확인하고 주석 태그를 만듭니다.
4. `master`와 해당 태그의 푸시 여부를 확인합니다. 승인하면 두 참조를 원자적으로 함께 푸시하고 Actions의 npm 게시를 시작합니다.

각 확인의 기본값은 승인입니다. `n`이나 `Ctrl+C`를 입력하면 해당 작업과 이후 흐름을 중단합니다. `--ci`, 버전 인자나 자동 응답으로 질문을 건너뛰는 방식은 지원하지 않습니다.

버전 선택은 자동으로 `0.1.2` 등을 적용하지 않습니다. `package.json`과 `package-lock.json`의 버전 변경은 release-it이 수행하며 npm 버전 수명 주기 스크립트는 실행하지 않습니다. 로컬에서는 실행 파일을 다시 빌드하거나 npm에 게시하지 않습니다.

같은 npm 버전은 다시 게시할 수 없습니다. 현재 준비 버전이 이미 npm에 게시됐다면 더 큰 버전을 선택합니다. 시험 버전은 npm의 `next` 태그로, 정식 버전은 `latest` 태그로 게시합니다.

## GitHub Actions가 수행하는 작업

`v*` 태그의 푸시가 `.github/workflows/npm-package.yml`을 시작합니다.

1. `macos-14` ARM64와 `ubuntu-22.04` x64에서 같은 커밋의 Rust 규칙 엔진을 Rust 1.95.0으로 빌드합니다.
2. 패키지 작업은 태그와 `package.json` 버전이 일치하고 태그 커밋이 `origin/master`에 포함되는지 확인합니다.
3. npm 잠금 파일로 의존성을 설치하고 두 실행 파일을 취합합니다. `npm pack`의 `prepack`이 TypeScript와 실행 파일 형식·CPU·소스 해시, 필수 배포 파일을 검사합니다. 삭제한 샌드박스 빌드 결과를 정리하고 `dist/sandbox`·`node_modules`가 압축 파일에 없는지도 검사합니다.
4. 검증한 `pi-codex-auto-review-<버전>.tgz`를 `npm-package` 결과물에 보관합니다.
5. 별도 게시 작업이 같은 결과물을 내려받아 OIDC로 npm에 게시합니다.

**Actions → npm 배포 → Run workflow**로 수동 실행하면 압축 패키지 준비만 수행하며 게시 작업은 생략합니다. 태그 게시에는 같은 워크플로의 태그 실행을 사용합니다.

Linux 규칙 엔진은 Ubuntu 22.04의 GNU 환경에서 빌드합니다. Alpine 등 musl 환경과 macOS x64·Linux ARM64는 이 규칙 엔진 배포의 지원 대상에 포함하지 않습니다. 승인 동작의 검증은 [검증 안내](testing/auto-review-protection.ko.md)를 따릅니다.

## 중단과 실패 후 확인

로컬 명령은 종료 시 파일·인덱스 변경, 현재 HEAD, 로컬 태그 및 푸시 시도 상태를 출력합니다. 질문에서 거절하거나 취소해도 이미 변경한 버전·인덱스·커밋·태그는 보존합니다.

푸시 실패 시 release-it은 원격 태그 정리를 시도할 수 있습니다. 출력만으로 원격 상태를 단정하지 말고 아래 결과를 확인합니다.

```sh
git status --short
git log -1
git ls-remote origin refs/heads/master 'refs/tags/v*'
```

태그 푸시 후 Actions가 실패하면 해당 실행의 로그를 확인하고 실패한 작업을 다시 실행합니다. 실제 npm 게시가 성공했는지 먼저 확인합니다. 이미 게시된 버전을 되풀이하지 않고 새 변경에는 새 버전을 사용합니다.

## 게시 결과와 Pi 설치 확인

`0.1.4` 게시 후 다음 명령으로 확인합니다.

```sh
npm view pi-codex-auto-review@0.1.4 version --registry=https://registry.npmjs.org/
pi install npm:pi-codex-auto-review@0.1.4
pi list
pi
```

다음 릴리스부터는 선택한 버전으로 명령을 바꿉니다. `0.1.2`는 샌드박스를 포함한 이전 구조이며, `0.1.3`은 샌드박스를 제거하고 승인 설정 명령을 추가한 버전입니다. `0.1.4`는 영문 승인 설명, 모델 범위 연동, 사용자 재승인과 검토 문맥 전달·복원을 보완합니다. 설치 후 `/approve`의 영문 설명과 `/approve-model`의 `/scoped-models` 범위 연동을 확인하고, 저장한 선택이 재시작 후 유지되는지 확인합니다. 설정 파일과 SDK 진입점은 [사용법](usage.ko.md)을 따릅니다.

## 로컬에서 압축 패키지만 준비

게시용 압축 파일을 직접 확인해야 할 때 사용합니다. TypeScript와 같은 네이티브 소스로 만든 두 플랫폼의 실행 파일·메타데이터가 먼저 준비되어 있어야 합니다.

```sh
npm run build
mkdir -p tmp/npm-release
npm pack --pack-destination tmp/npm-release
```

`npm run build`는 현재 운영체제·아키텍처의 실행 파일만 만듭니다. 다른 플랫폼의 결과물은 Actions의 빌드 결과에서 가져와 `dist/native/<플랫폼>-<아키텍처>/`에 둡니다. 실행 파일이 없거나 소스 해시가 다르면 압축 패키지 검사는 중단합니다. 정상 게시 준비에서 `--ignore-scripts`로 `prepack`을 생략하지 않습니다.

## 관련 근거

- [release-it 21.0.1](https://github.com/release-it/release-it/tree/21.0.1)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [GitHub-hosted runner 종류](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Pi 패키지 등록](https://github.com/earendil-works/pi/blob/v0.99.1/packages/coding-agent/docs/packages.md)
