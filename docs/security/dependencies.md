# 의존성 보안 수정

2026-10-03 확인한 높은 심각도 3개 감사 항목을 조치했다. 깨끗한 `npm ci --ignore-scripts` 설치 후 실제 사용되는 버전은 `node-forge 1.4.1-0`, `brace-expansion 5.0.12`이며 npm 감사 결과는 0건이다. 실행 증거는 [보안 인계](https://github.com/buYoung/pi-codex-auto-review/blob/HEAD/docs/handoffs/auto-review/11-dependency-security.json)에 기록한다.

| 항목 | 적용한 수정 | 배포 상태 |
| --- | --- | --- |
| `node-forge` 및 이를 사용하는 `sandbox-runtime` | RSA `DigestAlgorithm`의 추가 요소를 거부하는 [수정 PR](https://github.com/digitalbazaar/forge/pull/1152)의 커밋 `ceba34402e329f0365134f23fe19898756527d65`을 고정 | **미병합 개발 버전**이다. 공식 수정 릴리스로 표현하지 않는다. 기존 1.4.0 대비 라이브러리 코드 변경은 RSA 검증부 한 곳이다. |
| `brace-expansion` | 공식 수정 버전 `5.0.12` 사용 | [공식 보안 공지](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr)에 기재된 수정 버전이다. |

`node-forge`는 [공식 공지](https://github.com/advisories/GHSA-86w9-cpqp-85rv)에 수정 릴리스가 없다고 표시돼 있다. 버전 문자열을 임의로 올리거나 감사를 억제하지 않았다. 실제 패치 소스를 고정하고 정상 PKCS#1·PSS 서명, 네이티브 암호 모듈이 거부하는 변형 서명을 함께 검사했다.

## Pi 패키지의 잠금 보정

Pi 0.99.1의 `npm-shrinkwrap.json`은 취약한 `brace-expansion 5.0.9`를 고정한다. 루트 `overrides`, 일반 업데이트, 감사 자동 수정으로는 바뀌지 않았고, 루트 잠금만 수정해도 깨끗한 설치 시 5.0.9가 다시 설치되는 것을 확인했다. 확인한 Pi 1.0.0 배포에도 같은 잠금이 있었다.

따라서 공식 Pi 0.99.1 아카이브의 **잠금 항목 한 곳만** 수정한 개발 의존성을 사용한다. SDK 파일 1,227개를 대조했으며 소스·컴파일 결과·버전·라이선스는 동일하다. 아카이브와 변경 내역은 `vendor/`에 있으며, 이 아카이브도 검증 소스 해시에 포함된다. SDK API를 새 버전으로 바꾸지 않았다.

```sh
python3 scripts/vendor-pi-sdk.py
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm run build
npm run test:contracts
npm audit --json
```

생성기는 공식 원본 아카이브의 SHA-512 무결성을 확인한다. 생성 파일의 SHA-256·SHA-512와 수정한 잠금 항목은 [`vendor/pi-sdk-security.json`](https://github.com/buYoung/pi-codex-auto-review/blob/HEAD/vendor/pi-sdk-security.json)에 기록한다. Docker도 같은 아카이브와 잠금 파일로 설치한다.

## 확인한 결과

- 수정 전 정상 서명은 통과했으나 변형 서명이 `true`로 승인됐다. 중괄호 확장 입력은 5초 제한으로 중단됐다.
- 수정 후 정상 서명은 유지되고 변형 서명은 거부됐다. 같은 중괄호 입력도 제한 안에 완료됐다.
- 기존 계약·Pi 통합·네이티브 격리·패키지 실행을 합친 로컬 검증 58개가 통과했다. 플랫폼 전체 집계와 실모델 재검증은 후속 기능 변경을 합친 최종 소스에서 수행한다.

이 보정은 저장소의 잠금 파일로 설치한 환경에 적용된다. 별도로 설치된 Pi 호스트나 다른 프로젝트의 의존성을 자동으로 바꾸지는 않는다. 다른 환경에서는 실제로 해석되는 의존성과 해당 환경의 감사 결과를 별도로 확인해야 한다.

## npm 배포에서의 유지

설치된 의존성의 `overrides`는 소비자 프로젝트에 적용되지 않고 `package-lock.json`도 게시되지 않는다. 따라서 npm 배포 패키지는 `bundleDependencies`로 `@anthropic-ai/sandbox-runtime`과 그 하위 의존성을 함께 포함한다. 잠금 파일로 설치한 보정된 `node-forge`도 묶음에 들어가며, 게시 전 검사는 고정된 소스 URL·설치 버전과 압축 패키지의 포함 여부를 확인한다.

Pi 호스트는 `peerDependencies`로 유지하고 묶지 않는다. 개발용 `vendor/pi-coding-agent-0.99.1-security.1.tgz`도 배포하지 않으므로 별도로 설치된 Pi의 `brace-expansion` 보정은 이 패키지의 보장 범위에 포함되지 않는다.

플랫폼 실행 파일을 준비한 뒤 저장소 루트에서 `npm pack`을 실행하면 게시 전 검사가 적용된다. 소비자 설치에는 Rust 컴파일이나 보안 보정을 위한 설치 스크립트를 요구하지 않는다. 두 플랫폼의 실행 파일 취합은 [배포 안내](../publishing.md)를 따른다.
