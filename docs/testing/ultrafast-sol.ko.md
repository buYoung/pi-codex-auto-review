# 6.1 Sol Ultrafast PoC

Pi의 `openai` 또는 `openai-codex` 공급자에서 `gpt-6.1-sol`만 검증합니다. 확장이 넣은 `service_tier: "ultrafast"`가 실제 전송 본문에 남는지 확인하고, `--live` 실행은 서버가 반환한 등급까지 검사합니다.

`--provider`로 Pi 공급자를 선택합니다. 실제 실행은 Pi SDK가 기존 공급자 설정과 저장된 인증을 읽고, 선택한 공급자의 모델 목록을 갱신한 뒤 요청 인증을 처리합니다.

| Pi 공급자 | 전송 API | 기본 요청 주소 | Pi 인증 |
| --- | --- | --- | --- |
| `openai` | `openai-responses` | `https://api.openai.com/v1/responses` | Pi에 설정된 API 키 또는 ChatGPT OAuth |
| `openai-codex` | `openai-codex-responses` | `https://chatgpt.com/backend-api/codex/responses` | Pi에 저장된 Codex OAuth |

공개 API의 Ultrafast 사용 조건은 [OpenAI 공식 안내](https://developers.openai.com/api/docs/guides/ultrafast-mode)를 참고하세요. 공급자에 로그인했다는 사실만으로 해당 계정의 Ultrafast 지원을 확정하지 않으며, 실제 응답 등급으로 확인합니다.

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
| 2 | `/codex-fast ultrafast on`과 설정 저장 | `"ultrafast"` |
| 3 | `/codex-fast ultrafast off`와 설정 저장 | `"default"` |

검증이 통과하면 종료 코드는 `0`이고 JSON 결과의 `success`는 `true`입니다. `isSimulated: true`, `serverTierVerified: false`는 로컬 검증 결과라는 뜻입니다. `returnedTier`와 `usage`도 모의 데이터입니다.

PoC 세션과 Fast Mode 설정은 임시 디렉터리에 두고 종료할 때 삭제합니다. 도구 호출·모델 요청의 자동 재시도·자동 압축·캐시 예열은 끕니다.

## 실제 서버 확인

먼저 Pi의 `/login`에서 사용할 공급자에 로그인하거나 API 키를 설정합니다. `--live`는 기존 Pi 설정 디렉터리의 `auth.json`과 `models.json`을 사용합니다. API 키 환경 변수나 키 조회 명령도 Pi 공급자의 기존 설정을 따릅니다.

Codex backend를 검증하려면 다음과 같이 실행합니다. 계정 사용량이 발생하며, `gpt-6.1-sol`에 짧은 요청 **한 번**을 보냅니다.

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

실제 실행은 Pi의 `ModelRuntime.refresh()`로 선택한 공급자만 네트워크 갱신하고, 완료된 모델 목록에서 `gpt-6.1-sol`을 조회합니다. 모델 목록 캐시가 최신이어도 갱신을 요청하며, Pi의 기본 카탈로그 주소인 `pi.dev`에 접속합니다. 갱신 결과는 임시 모델 저장소에 두므로 기존 모델 캐시를 변경하지 않습니다. 공급자 갱신의 제한 시간은 `30000ms`이며, 실패하거나 취소되면 모델 요청을 보내지 않습니다. 모델 생성 한 번 외에 카탈로그 조회·인증 갱신 요청이 발생할 수 있고, 카탈로그 조회의 재시도는 Pi SDK가 처리합니다. 로컬 모의 실행에서는 네트워크 갱신을 끕니다.

OAuth 갱신이 필요하면 Pi SDK가 처리하고 갱신된 인증을 기존 `auth.json`에 저장할 수 있습니다. 자격 증명은 출력하지 않습니다. Fast Mode 설정과 대화 세션은 임시 디렉터리에서만 변경합니다.

요청 제한 시간은 두 경로 모두 `30000ms`입니다. PoC는 Pi에 최대 출력 `512`토큰을 전달하고, 최종 HTTP 본문에 `max_output_tokens`가 있으면 그 값을 검사합니다. Pi 1.1.0은 기본 공개 API 주소에서 ChatGPT OAuth를 사용할 때 이 필드를 생략하며, Codex backend에서도 전달하지 않습니다. 모델 설정의 `compat.supportsMaxOutputTokens: false`도 생략을 허용합니다. 이 경우 출력 토큰 제한을 보장하지 않으며, 결과의 `maxOutputTokens: null`은 해당 필드가 없다는 뜻입니다. 공개 API의 API 키 인증으로 해당 필드를 지원하는 모델에서는 추론 토큰을 포함해 `512`토큰으로 제한합니다. backend 전송은 HTTP 스트림을 관찰할 수 있도록 `sse`로 고정합니다.

프롬프트는 `Reply with READY only. Do not use tools.`입니다. Ultrafast를 켜고 요청을 보낸 다음, 임시 설정에서 다시 끕니다. 켜기·끄기 명령은 모델을 호출하지 않습니다.

성공 결과에서 다음을 확인합니다.

- `success: true`, `isSimulated: false`, `serverTierVerified: true`
- `provider: "openai"` 또는 `"openai-codex"`
- `piAgentDir`로 읽은 Pi 설정 위치, `authentication`으로 API 키·OAuth 여부
- `model: "gpt-6.1-sol"`
- `results[0].sentTier: "ultrafast"`와 `returnedTier: "ultrafast"`
- `httpStatus`, `requestId`, `responseId`, 실제 응답 모델과 토큰 사용량
- `text: "READY"`와 종료 코드 `0`

응답 등급은 요청 등급과 다를 수 있으므로 요청 본문에 `ultrafast`가 있다는 사실만으로 성공 판정을 내리지 않습니다. `response.completed`에서 모델·완료 상태·등급을 확인합니다. 서버가 `default` 등 다른 등급을 반환하면 실패합니다. 오류에는 요청·응답 등급과 함께 공급자·인증 방식·관찰한 요청 수·HTTP 상태·요청 ID·응답 ID를 표시합니다. `sentTier: "ultrafast"`, `returnedTier: "default"`이면 해당 요청의 Ultrafast 처리는 확인되지 않은 것입니다. 그 결과만으로 계정의 지원 여부나 등급이 달라진 이유까지 단정하지 않습니다.

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
| 응답 등급 불일치 | 요청은 전송됐어도 Ultrafast 처리 확인은 실패한 것입니다. |
| 모델 요청이 완료되지 않음 | 오류에 표시된 Pi 공급자 오류를 먼저 확인합니다. `observedRequests: 0`이면 인증·본문 검사 등 전송 전 단계에서 실패했을 수 있습니다. |
| 제한 시간·출력 제한·응답 불일치 | 요청은 완료되었을 수도 있습니다. 오류를 확인한 뒤 다시 실행하며, 실행할 때마다 새 요청이 발생합니다. |

`elapsedMs`는 한 요청의 관측 시간입니다. 이 PoC는 Standard 대비 속도 차이나 실제 청구 금액을 검증하지 않습니다. 모의 실행으로는 계정별 서버 지원 여부를 확인할 수 없습니다. 실제 실행은 지정한 엔드포인트의 HTTP 전송만 검증합니다.
