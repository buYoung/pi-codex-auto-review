# 6.1 Sol 속도 등급 PoC

Pi의 `openai` 또는 `openai-codex` 공급자에서 `gpt-6.1-sol`만 검증합니다. 확장이 넣은 `service_tier`가 실제 전송 본문에 남고 모델 요청이 정상 완료되는지 확인합니다. `--live` 실행은 서버 응답 등급과 TPS도 기록합니다. **응답 등급이 요청과 달라도 그 차이만으로 실패하지 않습니다.**

`--provider`로 Pi 공급자를, `--speed`로 속도 등급을 선택합니다. 속도 등급의 기본값은 기존과 같은 `ultrafast`입니다. 실제 실행은 Pi SDK가 기존 공급자 설정과 저장된 인증을 읽고, 선택한 공급자의 모델 목록을 갱신한 뒤 요청 인증을 처리합니다.

| `--speed` | 최종 HTTP 본문의 `service_tier` | 응답 등급 일치로 기록하는 값 |
| --- | --- | --- |
| `standard` | `"default"` | `"default"` |
| `fast` | `"priority"` | `"priority"` 또는 `"fast"` |
| `ultrafast` | `"ultrafast"` | `"ultrafast"` |

Fast의 `priority`·`fast`는 같은 속도 등급으로 비교합니다. 요청 값의 동등성은 [OpenAI Fast Mode 안내](https://developers.openai.com/api/docs/guides/fast-mode)를 참고하세요. Codex backend에서는 Fast·Ultrafast 요청의 응답에도 `default`가 관측됐습니다. 응답을 요청 등급으로 바꾸지 않고 원문과 일치 여부를 별도로 남깁니다. 이 관측만으로 실제 처리 등급이나 단순 표시 문제인지 확정하지 않습니다.

예를 들어 Fast를 선택하려면 `node scripts/poc-ultrafast-sol.mjs --provider openai-codex --speed fast --live`를 실행합니다. Standard를 검증하려면 `--speed standard`를 사용합니다.

| Pi 공급자 | 전송 API | 기본 요청 주소 | Pi 인증 |
| --- | --- | --- | --- |
| `openai` | `openai-responses` | `https://api.openai.com/v1/responses` | Pi에 설정된 API 키 또는 ChatGPT OAuth |
| `openai-codex` | `openai-codex-responses` | `https://chatgpt.com/backend-api/codex/responses` | Pi에 저장된 Codex OAuth |

공개 API의 Ultrafast 사용 조건은 [OpenAI 공식 안내](https://developers.openai.com/api/docs/guides/ultrafast-mode)를 참고하세요. [공개 Responses API 명세](https://developers.openai.com/api/reference/python/resources/responses/methods/create)는 응답의 `service_tier`를 실제 처리 모드로 설명하며 요청과 다를 수 있다고 명시합니다. 이 설명을 Codex backend의 응답에 그대로 적용하지 않습니다. Pi 로그인·모델 목록 갱신·요청 성공만으로 계정의 등급 지원이나 실제 과금을 확정하지 않습니다.

## 준비와 로컬 확인

Node.js 22.19 이상과 이 저장소의 Pi 1.1.0 의존성이 필요합니다. 저장소 루트에서 의존성을 설치한 뒤 Fast Mode 패키지를 빌드합니다. 이미 설치했다면 설치 단계는 생략합니다.

```sh
npm ci --ignore-scripts
npm run build --workspace=@buyong/pi-codex-fast-mode
node scripts/poc-ultrafast-sol.mjs --provider openai
node scripts/poc-ultrafast-sol.mjs --provider openai-codex
```

기본 공급자는 `openai`입니다. `--live`가 없는 실행은 합성 자격 증명을 담은 메모리 저장소와 모의 응답을 사용하며, 기존 Pi 인증·설정을 읽거나 네트워크 요청을 하지 않습니다. 실제 Pi SDK에 빌드한 확장을 로드하고, 선택한 Pi 공급자가 만든 HTTP 본문을 검사합니다. Codex 경로에서는 OAuth·계정 헤더도 확인하며, 전송 본문이 Zstd로 압축됐다면 해제해 `service_tier`를 검사합니다.

| 순서 | 확인하는 동작 | 최종 HTTP 본문의 `service_tier` |
| --- | --- | --- |
| 1 | 명시적 선택이 없는 초기 Standard | 필드 없음 |
| 2 | 선택한 속도 등급의 명령 실행과 설정 저장 | 위 속도 등급 표의 값 |
| 3 | `/codex-fast off`와 설정 저장 | `"default"` |

검증이 통과하면 종료 코드는 `0`이고 JSON 결과의 `success`와 `requestTierVerified`는 `true`입니다. `isSimulated: true`, `serverTierVerified: false`는 로컬 검증 결과라는 뜻입니다. `returnedTier`와 `usage`도 모의 데이터입니다. Codex 모의 응답은 실제 관측처럼 모든 요청에 `default`를 반환하므로, Fast·Ultrafast의 `isMatchingTier`가 `false`여도 정상 통과합니다.

PoC 세션과 Fast Mode 설정은 임시 디렉터리에 두고 종료할 때 삭제합니다. 기존 모델별 `modelServiceTiers` 설정은 읽지 않으므로 `--speed`로 선택한 전체 속도가 Sol 요청에 적용됩니다. 도구 호출·모델 요청의 자동 재시도·자동 압축·캐시 예열은 끕니다.

## 실제 서버 확인

먼저 Pi의 `/login`에서 사용할 공급자에 로그인하거나 API 키를 설정합니다. `--live`는 기존 Pi 설정 디렉터리의 `auth.json`과 `models.json`을 사용합니다. API 키 환경 변수나 키 조회 명령도 Pi 공급자의 기존 설정을 따릅니다.

Codex backend를 검증하려면 다음과 같이 실행합니다. 계정 사용량이 발생하며, `gpt-6.1-sol`에 같은 문장 24줄을 생성하는 요청 **한 번**을 보냅니다.

```sh
node scripts/poc-ultrafast-sol.mjs --provider openai-codex --live
```

Pi의 `openai` 공급자를 검증하려면 다음과 같이 실행합니다.

```sh
node scripts/poc-ultrafast-sol.mjs --provider openai --live
```

설정 디렉터리는 `PI_CODING_AGENT_DIR` 또는 Pi의 기본 경로를 따릅니다. 다른 Pi 설정을 사용하려면 `--agent-dir`로 디렉터리를 지정합니다. 아래 `/path/to/pi-agent`는 검증할 Pi 설정 디렉터리의 실제 경로로 바꿉니다.

```sh
node scripts/poc-ultrafast-sol.mjs --provider openai-codex --live --agent-dir /path/to/pi-agent
```

PoC는 선택한 공급자를 다시 등록하거나 모델의 주소·인증을 덮어쓰지 않습니다. 이 PoC에서 허용하는 주소는 위 표의 공개 API와 Codex backend 경로입니다. Codex 모델 설정의 `/backend-api/codex`·`/backend-api/codex/responses` 주소도 허용합니다.

Codex backend 요청은 로컬 Codex 소스의 HTTP 전송 방식에 맞춰 `x-codex-routing-hint`가 없으면 추가합니다. 값은 최종 본문의 모델·등급을 사용한 `model=gpt-6.1-sol;tier=priority` 같은 형식이며, Standard는 모델만 포함합니다. Pi 설정에서 이미 지정한 헤더는 보존하고, 실제 값은 결과의 `routingHint`에 표시합니다. 이 차이를 보완한 것만으로 서버의 등급 적용이나 이전 `default` 응답의 원인을 확정하지 않습니다.

실제 실행은 Pi의 `ModelRuntime.refresh()`로 선택한 공급자만 네트워크 갱신하고, 완료된 모델 목록에서 `gpt-6.1-sol`을 조회합니다. 모델 목록 캐시가 최신이어도 갱신을 요청하며, Pi의 기본 카탈로그 주소인 `pi.dev`에 접속합니다. 갱신 결과는 임시 모델 저장소에 두므로 기존 모델 캐시를 변경하지 않습니다. 공급자 갱신의 제한 시간은 `30000ms`이며, 실패하거나 취소되면 모델 요청을 보내지 않습니다. 모델 생성 한 번 외에 카탈로그 조회·인증 갱신 요청이 발생할 수 있고, 카탈로그 조회의 재시도는 Pi SDK가 처리합니다. 로컬 모의 실행에서는 네트워크 갱신을 끕니다.

OAuth 갱신이 필요하면 Pi SDK가 처리하고 갱신된 인증을 기존 `auth.json`에 저장할 수 있습니다. 자격 증명은 출력하지 않습니다. Fast Mode 설정과 대화 세션은 임시 디렉터리에서만 변경합니다.

요청 제한 시간은 두 경로 모두 `30000ms`입니다. PoC는 Pi에 최대 출력 `512`토큰을 전달하고, 최종 HTTP 본문에 `max_output_tokens`가 있으면 그 값을 검사합니다. Pi 1.1.0은 기본 공개 API 주소에서 ChatGPT OAuth를 사용할 때 이 필드를 생략하며, Codex backend에서도 전달하지 않습니다. 모델 설정의 `compat.supportsMaxOutputTokens: false`도 생략을 허용합니다. 이 경우 출력 토큰 제한을 보장하지 않으며, 결과의 `maxOutputTokens: null`은 해당 필드가 없다는 뜻입니다. 공개 API의 API 키 인증으로 해당 필드를 지원하는 모델에서는 추론 토큰을 포함해 `512`토큰으로 제한합니다. backend 전송은 HTTP 스트림을 관찰할 수 있도록 `sse`로 고정합니다.

기본 프롬프트는 `The quick brown fox jumps over the lazy dog.`를 번호·설명 없이 24줄 출력하도록 요청합니다. 한 단어 응답보다 긴 스트리밍 구간을 확보해 생성 TPS를 관측하기 위한 문장입니다. 공개 API의 출력 제한은 기존처럼 추론 토큰을 포함해 `512`토큰이며, Codex backend에는 같은 토큰 제한을 보장하지 않습니다.

선택한 속도 등급을 적용하고 요청을 보낸 다음, 임시 설정을 Standard로 되돌립니다. Standard는 `/codex-fast off`, Fast와 Ultrafast는 각각 `/codex-fast fast on`과 `/codex-fast ultrafast on`으로 적용합니다. 이 명령들은 모델을 호출하지 않습니다.

성공 결과에서 다음을 확인합니다.

- `success: true`, `isSimulated: false`, `requestTierVerified: true`
- `provider: "openai"` 또는 `"openai-codex"`
- `speed`로 선택한 속도 등급
- `piAgentDir`로 읽은 Pi 설정 위치, `authentication`으로 API 키·OAuth 여부
- `model: "gpt-6.1-sol"`
- `results[0].sentTier`가 위 속도 등급 표의 요청 값과 일치하는지
- `returnedTier`에 서버가 반환한 원문 등급, `isMatchingTier`에 요청과의 일치 여부가 기록됐는지
- `serverTierVerified`의 의미와 공급자별 결과는 아래 표를 참고합니다.
- Codex backend의 `routingHint`
- `httpStatus`, `requestId`, `responseId`, 실제 응답 모델과 토큰 사용량
- `tps`, `tpsUnavailableReason`, `endToEndTps`, 출력 토큰 수와 시간 측정값
- `text`의 실제 출력과 종료 코드 `0`

성공은 선택한 등급이 최종 HTTP 본문까지 전달되고, 같은 모델의 `response.completed`와 비어 있지 않은 텍스트 응답을 받은 결과입니다. 인증·요청 본문·요청 횟수·모델·완료 상태·텍스트 출력 검사는 유지합니다. 응답 등급 불일치나 해당 필드 생략은 실패 조건에서 제외하며, TPS도 실제 스트림 표본으로 계산합니다.

| 결과 필드 | 의미 |
| --- | --- |
| `requestTierVerified` | 확장의 요청 등급이 최종 HTTP 본문에 전달됐다는 뜻입니다. 모의 실행에서도 확인합니다. |
| `returnedTier` | 서버 응답의 원문 `service_tier`. 필드가 없으면 `null`이며 요청 값으로 대체하지 않습니다. |
| `isMatchingTier` | 응답 등급과 요청 등급의 일치 여부. Fast의 `priority`·`fast`는 동등하게 비교하고, 초기 Standard의 생략된 요청 등급은 `default`와 비교합니다. 응답 등급이 없으면 `null`입니다. |
| `serverTierVerified` | 공개 API의 실제 응답 등급이 요청과 일치할 때만 `true`입니다. Codex backend와 모의 실행에서는 항상 `false`입니다. 속도나 청구 금액의 검증은 아닙니다. |

예를 들어 Codex backend의 Ultrafast 요청이 정상 완료되고 응답 등급이 `default`라면 `success: true`, `requestTierVerified: true`, `sentTier: "ultrafast"`, `returnedTier: "default"`, `isMatchingTier: false`, `serverTierVerified: false`입니다. 성공 여부와 실제 서버 처리 등급의 확인 여부를 구분합니다. 공개 API에서도 등급이 다르면 정상 완료한 요청은 성공으로 기록하되 `serverTierVerified`는 `false`입니다.

요청 실패 진단에는 선택한 속도 등급·요청·응답 등급·일치 여부와 함께 공급자·인증 방식·관찰한 요청 수·HTTP 상태·요청 ID·응답 ID·성능 측정값을 표시합니다. `default` 응답만으로 계정의 지원 여부나 등급이 달라진 이유까지 단정하지 않습니다.

실제 실행을 반복하면 매번 요청 한 번의 사용량이 발생합니다.

## 실패와 결과의 한계

| 증상 | 확인할 내용 |
| --- | --- |
| `dist/index.js`를 찾지 못함 | 저장소 루트에서 패키지 빌드를 실행합니다. |
| 선택한 공급자에 인증이 없음 | 같은 Pi 설정에서 `/login`을 실행합니다. 다른 설정을 사용한다면 `--agent-dir`를 확인합니다. |
| 공급자 갱신 실패·제한 시간 초과 | `pi.dev` 연결과 해당 공급자의 로그인 상태·설정을 확인합니다. 필요하면 Pi에서 다시 로그인합니다. |
| 모델 초기화 실패·모델 없음 | 저장소의 잠금 정보대로 Pi 1.1.0 의존성이 설치되어 있는지 확인합니다. |
| HTTP 401·403 | 선택한 경로의 자격 증명과 모델·계정 접근을 확인합니다. |
| HTTP 429 | 해당 계정의 Ultrafast 사용량·요청 제한을 확인합니다. 자동 재시도는 하지 않습니다. |
| 응답 등급 불일치·등급 필드 없음 | 그 차이만으로 실패하지 않습니다. `sentTier`·`returnedTier`·`isMatchingTier`를 확인하고, 실제 처리 등급 확인과 요청 성공을 구분합니다. |
| 모델 요청이 완료되지 않음 | 오류에 표시된 Pi 공급자 오류를 먼저 확인합니다. `observedRequests: 0`이면 인증·본문 검사 등 전송 전 단계에서 실패했을 수 있습니다. |
| 제한 시간·출력 제한·응답 불일치 | 요청은 완료되었을 수도 있습니다. 오류를 확인한 뒤 다시 실행하며, 실행할 때마다 새 요청이 발생합니다. |

성능 측정값의 기준은 다음과 같습니다.

| 필드 | 계산 기준 |
| --- | --- |
| `elapsedMs` | `session.prompt()` 호출부터 완료까지의 전체 요청 시간. 시작 전 공급자 갱신과 속도 선택 명령은 제외합니다. |
| `outputTokens` | 서버 완료 응답의 `usage.output_tokens`. 추론 토큰을 포함합니다. |
| `reasoningTokens` | 서버가 보고한 출력 토큰 중 추론 토큰 수. 보고되지 않으면 `null`입니다. |
| `textOutputTokens` | `outputTokens - reasoningTokens`. 두 사용량이 없거나 일관되지 않으면 `null`입니다. |
| `textDeltaCount` | 비어 있지 않은 텍스트 스트림 조각 수. 토큰 수로 사용하지 않습니다. |
| `tps` | 생성 TPS 추정값. `(textOutputTokens - 1) ÷ (streamingDurationMs / 1000)`. 첫 출력 토큰과 추론 토큰은 분자에서, 첫 출력 대기 시간은 분모에서 제외합니다. |
| `tpsUnavailableReason` | TPS를 계산하지 못한 사유. 충분한 표본이면 `null`입니다. |
| `endToEndTps` | 기존 전체 요청 처리율: `outputTokens ÷ (elapsedMs / 1000)`. 추론 토큰과 첫 출력 대기 시간을 포함합니다. 사용량이 없거나 시간이 0이면 `null`입니다. |
| `timeToFirstTokenMs` | 요청 시작부터 첫 비어 있지 않은 `response.output_text.delta` 도착까지의 시간. 텍스트 조각 기준이며 출력이 없으면 `null`입니다. |
| `streamingDurationMs` | 첫 텍스트 조각부터 마지막 텍스트 조각 도착까지의 시간. 양의 시간 구간을 관측할 수 없으면 `null`입니다. |

TPS는 반올림 전 시간으로 계산하고 소수 둘째 자리까지 표시합니다. 생성 TPS에는 최소 `64`개 텍스트 출력 토큰, 최소 두 개의 텍스트 조각, `100ms` 이상의 스트리밍 구간이 필요합니다. 첫 조각이 전체 출력 문자의 `10%`를 넘는 경우에도 계산하지 않습니다. 이미 많은 내용이 첫 조각에 들어 있으면 그 생성 시간을 알 수 없기 때문입니다. 조건을 만족하지 못하면 `tps: null`과 사유를 표시해, 짧은 응답이나 한 번에 전달된 응답에서 비정상적으로 큰 TPS가 계산되지 않게 합니다.

생성 TPS는 클라이언트의 텍스트 수신 시점을 사용한 추정값입니다. 첫 텍스트 조각에 여러 토큰이 포함될 수 있고, 네트워크 버퍼링도 측정에 영향을 줍니다. 서버 내부의 순수 디코딩 속도를 보장하지 않습니다. 실제 모델이 24줄보다 짧게 출력할 수도 있으므로, 생성 TPS 계산 가능 여부는 실제 토큰·스트림 표본으로 판정합니다. 모의 실행의 사용량과 처리율은 실제 모델 성능이 아니며, 즉시 전달되는 모의 스트림에서는 생성 TPS가 `null`일 수 있습니다.

이 PoC는 Standard 대비 속도 차이나 실제 청구 금액을 검증하지 않습니다. 모의 실행으로는 계정별 서버 지원 여부를 확인할 수 없습니다. 실제 실행은 지정한 엔드포인트의 HTTP 전송과 해당 요청의 클라이언트 관측 성능을 기록합니다.
