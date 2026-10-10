# @buyong/pi-codex-fast-mode

[English](README.md) | **한국어**

대화 모델·엔드포인트를 유지하고 Pi에서 OpenAI 서비스 등급을 요청합니다. Standard·Fast·Ultrafast를 선택할 수 있으며 로컬 호환 조건을 통과할 때만 해당 `service_tier`를 추가합니다. 저장한 선택이나 시작 옵션이 없으면 Standard는 요청을 바꾸지 않습니다.

**선택한 등급은 요청이며 실제 처리 속도·과금의 확인이 아닙니다.** 유료 등급을 사용하기 전에 서버 응답과 적용 요금을 확인하세요. OpenAI의 [Fast](https://developers.openai.com/api/docs/guides/fast-mode)·[Ultrafast](https://developers.openai.com/api/docs/guides/ultrafast-mode) 안내를 참고하세요.

## 요구 사항

Node.js 22.19 이상, Pi 0.99.1 이상과 설정된 모델 접근이 필요합니다. Fast는 [로컬 허용 목록](#지원-모델과-요청-값)의 사용 가능한 모델을 선택합니다. Ultrafast에는 API·인증·엔드포인트 조건도 있습니다. 목록이 계정 접근이나 백엔드 지원을 제공하는 것은 아닙니다.

## 빠른 시작

게시된 릴리스를 설치합니다.

```sh
pi install npm:@buyong/pi-codex-fast-mode
pi list
pi
```

`@buyong/pi-codex`를 통해 같은 확장을 함께 활성화하지 마세요. Pi에서 다음 순서로 진행합니다.

1. [로컬 Fast 허용 목록](#지원-모델과-요청-값)의 모델을 선택합니다.
2. `/codex-fast`에서 Fast를 켭니다.
3. `/codex-fast status`로 선택한 등급이 현재 모델에서 적용되는지 확인합니다.
4. 짧은 프롬프트로 모델 요청을 만듭니다. 예를 들어 다음과 같이 요청합니다.

```text
Reply with READY only. Do not use tools.
```

`/codex-fast status`를 다시 확인합니다. 활성 선택은 하단에 `gpt-6.1-sol fast`처럼 표시하고 일치하는 요청은 마지막 주입에 `priority`를 기록합니다. **활성은 확장의 로컬 조건을 통과했다는 뜻입니다.** 기록은 훅이 준비한 요청 필드이며 공급자가 받거나 해당 등급을 사용했다는 근거가 아닙니다. 가속을 끄려면 `/codex-fast off`를 실행하세요.

## 등급 선택

`/codex-fast`는 **Fast**·**Ultrafast** 항목을 엽니다. **↑/↓**로 선택하고 **Tab/Enter**로 바꿉니다. 저장을 끄지 않았다면 변경은 즉시 적용·저장합니다. 화면은 유지하고 Esc로 닫습니다. 하나를 켜면 다른 모드는 꺼지고, 둘 다 끄면 Standard입니다.

| 명령 | 동작 |
| --- | --- |
| `/codex-fast on` | Fast 선택 |
| `/codex-fast off` | Standard 선택. 두 가속 모드를 모두 끕니다. |
| `/codex-fast fast on` / `/codex-fast fast off` | Fast 변경. 이미 꺼진 모드를 끄면 다른 모드를 유지합니다. |
| `/codex-fast ultrafast on` / `/codex-fast ultrafast off` | Ultrafast 변경. 지원 조건이 없으면 기존 선택을 유지합니다. |
| `/codex-fast status` | 선택한 등급, 적용 상태, 모델, 설정 경로, 저장 여부와 마지막 주입을 표시합니다. 선택은 바꾸지 않습니다. |

명시적 인자는 UI 없이도 사용할 수 있습니다. RPC는 같은 Fast·Ultrafast 반복 선택창을 사용합니다. 모드 변경은 현재 에이전트 작업이 멈출 때까지 기다립니다. `status`는 설정을 저장하거나 모델을 호출하지 않습니다. Pi 시작 명령에 `--fast`를 추가하면 초기화할 때 저장된 등급보다 Fast를 우선합니다.

미지원 모델에서도 Fast 선택을 유지하지만 등급을 추가하지 않습니다. 지원 모델로 돌아가면 활성화합니다. 기존 Ultrafast 선택도 미지원 모델에서 유지하며 다른 등급을 대신 주입하지 않습니다. 명령으로 Ultrafast를 고를 때는 현재 모델·인증 조건을 먼저 통과해야 합니다.

## 이전 명령에서 전환

이 체크아웃은 `/codex-fast`만 등록합니다. `/openai-tier`·`/openai-settings`는 별칭을 남기지 않고 제거했습니다. 진단에는 `/codex-fast status`, Fast·Ultrafast에는 위의 모드별 명령, Standard에는 `/codex-fast off`를 사용하세요. 기존 `/codex-fast on`·`off` 축약형은 계속 지원합니다.

이전 명령을 호출하는 스크립트는 갱신해야 합니다. 기존 불리언을 포함한 설정 키·우선순위·저장 경로는 바뀌지 않습니다. 게시된 릴리스는 체크아웃과 다를 수 있으므로 이 변경이 포함된 릴리스나 아래 소스 빌드를 사용하세요.

## 설정과 저장

| 위치 | 경로 |
| --- | --- |
| 전역 | `<agentDir>/codex-fast-mode/settings.json` |
| 프로젝트 | `<cwd>/.pi/codex-fast-mode/settings.json` |

`agentDir`은 `PI_CODING_AGENT_DIR`을 따르며 보통 `~/.pi/agent`입니다. 프로젝트 설정이 전역보다 우선합니다. 프로젝트 파일이 있으면 명령은 거기에 저장하고, 없으면 전역 파일에 저장합니다.

```json
{
  "serviceTier": "standard",
  "persistState": true,
  "notifyOnModelSwitch": true
}
```

| 설정 | 기본값 | 동작 |
| --- | --- | --- |
| `serviceTier` | `"standard"` | `standard`·`fast`·`ultrafast`. Standard를 명시적으로 저장하면 선택이 없는 상태와 다릅니다. 요청 값 표를 참고하세요. |
| `persistState` | `true` | `false`는 명령 변경을 세션 안에서만 유지합니다. |
| `notifyOnModelSwitch` | `true` | 모델 변경으로 적용 여부가 바뀌면 알립니다. |
| `supportedModels` | 아래 기본 목록 | 정확한 `provider/id` 문자열로 Fast 허용 목록을 대체합니다. `[]`은 Fast 지원을 끄지만 Ultrafast 조건은 바꾸지 않습니다. |
| `desiredActive`, `active`, `fast.enabled` | 없음 | 이전 불리언 설정. 같은 계층에서는 `serviceTier` → `desiredActive` → `active` → `fast.enabled` 순서로 우선합니다. |

계층별로 해석한 뒤 병합하므로 프로젝트의 이전 불리언도 전역 `serviceTier`를 덮어쓸 수 있습니다. 저장은 `serviceTier`·`desiredActive`·`active`를 갱신하며 다른 필드는 보존합니다. 모델 변경은 원하는 등급을 유지하고 적용 여부를 다시 계산합니다.

직접 편집한 뒤 `/reload`를 실행합니다. 잘못됐거나 읽을 수 없는 설정은 오류를 알리고 기본값을 사용하며 변경은 세션에만 적용합니다. 명령 저장에 실패하면 이전 등급으로 되돌립니다.

## 지원 모델과 요청 값

확장의 **기본 로컬 Fast 허용 목록**입니다. 공급자·계정이 모든 모델이나 서비스 등급을 제공한다는 약속은 아닙니다.

| 공급자 | 모델 ID |
| --- | --- |
| `openai` | `gpt-5.4`, `gpt-5.5`, `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna` |
| `openai-codex` | 위 모델들과 `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` |

Ultrafast에는 다음 조건이 모두 필요합니다.

- `openai-responses` API를 사용하는 `openai/gpt-6-astra` 또는 `openai/gpt-6.1-sol`
- OAuth가 아닌 설정된 인증
- `api.openai.com` 또는 `us.api.openai.com`의 HTTPS `/v1`·`/v1/` 엔드포인트. `gpt-6.1-sol`은 `eu.api.openai.com`도 지원합니다. 기본 HTTPS 포트나 443을 사용하고 URL 자격 증명·쿼리·프래그먼트가 없어야 합니다.

Ultrafast는 이 확장에서 OpenAI API 키 인증으로 사용합니다. `openai-codex`와 OAuth로 사용하는 `openai`는 Ultrafast 지원 대상에 포함하지 않습니다.

| 선택 | 주입하는 `service_tier` |
| --- | --- |
| 명시적 선택이 없는 초기 Standard | 필드를 추가하지 않음 |
| 위 설정 예시를 포함해 직접 고르거나 저장한 Standard | Fast 지원 모델에 `"default"` |
| Fast | Fast 지원 모델에 `"priority"` |
| Ultrafast | 조건을 통과하면 `"ultrafast"` |
| 미지원 모델의 가속 선택 | 필드를 추가하지 않고 선택만 유지 |

훅은 요청이 객체이며 `payload.model`이 현재 모델 ID와 일치할 때만 복사본을 반환합니다. 다른 모델의 보조 요청은 바꾸지 않습니다. 미지원 요청은 유지하며 엔드포인트·모델을 바꾸거나 백엔드의 실제 등급을 검증하지 않습니다.

## 선택한 등급이 적용되지 않을 때

| 증상 | 확인할 내용 |
| --- | --- |
| 선택은 유지하지만 비활성 | 현재 `provider/id`와 `supportedModels` 재정의를 확인합니다. 저장 선택이 호환 여부는 아닙니다. |
| Ultrafast 선택 거부 | 위 조건을 모두 확인합니다. 이전 등급을 유지하며 Fast로 대신 선택하지 않습니다. |
| 프롬프트 후에도 주입 없음 | 현재 모델과 공급자 요청의 일치하는 `model` 필드를 확인합니다. 다른 모델 요청·호환되지 않는 요청은 유지합니다. |
| 설정 로드·저장 오류 | 표시된 설정 경로를 확인합니다. 로드 오류는 기본값과 세션 변경만 사용하고, 명령 저장 실패는 이전 등급으로 되돌립니다. |

## 소스 빌드와 로드

저장소 루트에서 실행합니다.

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex-fast-mode
node_modules/.bin/pi -ne -e ./packages/pi-codex-fast-mode/dist/index.js
```

영구 패키지 등록 없이 이번 실행에 확장을 로드합니다. 소스를 바꾼 뒤 다시 빌드하세요. 릴리스 준비는 [저장소 배포 안내](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/publishing.ko.md)를 참고하세요.

## 라이선스

[Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE). npm 압축 파일에는 `LICENSE`를 포함합니다.
