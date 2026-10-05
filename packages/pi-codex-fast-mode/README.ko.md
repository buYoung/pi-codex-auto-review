# pi-codex-fast-mode

[English](README.md) | **한국어**

Pi에서 OpenAI의 Standard, Fast, Ultrafast 티어를 선택하는 확장입니다. 기본값은 Standard이며 요청 본문을 변경하지 않습니다. Fast를 켜면 지원 모델의 요청에 `service_tier: "priority"`를 넣습니다. 모델이나 엔드포인트는 바꾸지 않습니다. 이 요청 방식은 [OpenAI 공식 문서](https://developers.openai.com/api/docs/guides/fast-mode)에 설명되어 있습니다.

## 실행

Node.js 22.19 이상과 Pi 0.99.1 이상의 호스트가 필요합니다. 저장소 루트에서 빌드하고 확장을 로드합니다.

```sh
npm ci --ignore-scripts
npm run build --workspace @buyong/pi-codex-fast-mode
pi -e ./packages/pi-codex-fast-mode/dist/index.js
```

`/codex-fast`를 실행하면 **Fast on/off**, **Ultrafast on/off** 두 항목이 표시됩니다. **↑/↓로 항목을 이동**하고 **Tab 또는 Enter로 on/off를 전환**합니다. 전환 즉시 적용·저장하고 화면을 유지합니다. Esc로 화면을 닫습니다. 하나를 켜면 다른 모드는 꺼지고, 둘 다 off면 Standard를 사용합니다. Ultrafast 지원 조건을 충족하지 않으면 기존 선택을 유지하며 이유를 알립니다. 명령 인자도 자동완성할 수 있습니다.

```text
/codex-fast on
/codex-fast off
/codex-fast fast on
/codex-fast fast off
/codex-fast ultrafast on
/codex-fast ultrafast off
/openai-tier
/openai-tier ultrafast
```

Fast가 지원되는 모델에서 on을 적용하면 푸터에 `gpt-6.1-sol fast`처럼 모델 ID와 티어가 표시됩니다. `/openai-tier`는 원하는 티어, 현재 적용 여부, 설정 경로와 마지막 요청 주입 기록을 보여 줍니다. off를 적용하면 Standard로 돌아가고 푸터 표시가 사라집니다.

처음부터 Fast로 시작하려면 실행 명령에 `--fast`를 추가합니다. 이 플래그는 시작 시 저장된 티어보다 우선합니다. UI가 없는 모드에서도 위 명령으로 지정할 수 있습니다. `/codex-fast fast off`와 `/codex-fast ultrafast off`는 지정한 모드만 끄며, 다른 모드가 켜져 있으면 그대로 유지합니다. 기존 `/codex-fast on`은 Fast를 선택하고 `/codex-fast off`는 모든 가속 모드를 끕니다. RPC에서는 Fast와 Ultrafast 항목을 선택해 전환하는 대화상자를 사용합니다.

`/openai-settings`에서는 `fast.enabled`와 `serviceTier`를 선택할 수 있습니다. 인자로도 지정할 수 있습니다.

```text
/openai-settings fast.enabled on
/openai-settings serviceTier standard
```

## 설정 저장

전역 설정은 `<agentDir>/codex-fast-mode/settings.json`, 프로젝트 설정은 `<cwd>/.pi/codex-fast-mode/settings.json`입니다. `agentDir`는 Pi의 `PI_CODING_AGENT_DIR` 설정을 따릅니다. 프로젝트 설정이 전역 설정보다 우선하며, 프로젝트 파일이 있으면 선택을 그 파일에 저장하고 없으면 전역 파일에 저장합니다.

```json
{
    "serviceTier": "standard",
    "persistState": true,
    "notifyOnModelSwitch": true
}
```

| 설정 | 동작 |
| --- | --- |
| `serviceTier` | `standard`, `fast`, `ultrafast` 중 선택 |
| `persistState` | 기본 `true`. `false`이면 티어 변경을 세션 안에서만 유지 |
| `notifyOnModelSwitch` | 기본 `true`. 모델 변경으로 적용 여부가 바뀌면 알림 |
| `supportedModels` | 기본 Fast 허용 목록을 대체하는 `provider/id` 배열. 빈 배열은 Fast 지원을 모두 해제 |
| `desiredActive`, `active`, `fast.enabled` | 예전 불리언 설정도 인식. 같은 계층에서는 `serviceTier`, `desiredActive`, `active`, `fast.enabled` 순서로 우선 |

저장할 때 `serviceTier`, `desiredActive`, `active`를 갱신하고 알 수 없는 필드는 보존합니다. 모델을 바꾸면 적용 상태를 다시 계산합니다. 미지원 모델에서 Fast를 선택해도 원하는 티어는 유지되므로 지원 모델로 돌아가면 자동으로 적용됩니다.

설정을 변경한 뒤 `/reload`로 다시 읽습니다. 파일이 잘못됐거나 읽을 수 없으면 오류를 알리고 기본값으로 시작하며, 변경은 해당 세션에만 적용합니다. 저장 실패 시 명령으로 변경한 티어를 이전 상태로 되돌립니다.

## 지원 모델과 요청 값

Fast 기본 허용 목록은 다음과 같습니다. `supportedModels`를 지정하면 작성한 목록을 그대로 사용합니다.

| 프로바이더 | 모델 ID |
| --- | --- |
| `openai` | `gpt-5.4`, `gpt-5.5`, `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-sol`, `gpt-6-luna` |
| `openai-codex` | 위 모델들과 `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` |

Ultrafast는 허용 목록과 별개로 `openai/gpt-6-astra`, `openai-responses`, OAuth가 아닌 설정된 API 키 인증, HTTPS `api.openai.com` 또는 `us.api.openai.com`의 `/v1` 주소에서만 선택할 수 있습니다. 미지원 모델로 전환하면 Ultrafast 선택은 유지하지만 티어를 주입하지 않으며, Fast나 Standard를 대신 주입하지 않습니다. 공식 API의 Ultrafast 동작은 [OpenAI 안내](https://developers.openai.com/api/docs/guides/ultrafast-mode)를 참고하세요.

| 선택 | `service_tier` |
| --- | --- |
| 기본 Standard | 필드를 추가하지 않음 |
| 사용자가 직접 고른 Standard 또는 off | Fast 지원 모델에 `"default"` |
| Fast | Fast 지원 모델에 `"priority"` |
| Ultrafast | Ultrafast 지원 조건에서 `"ultrafast"` |

요청 본문이 객체이며 `payload.model`이 현재 모델 ID와 일치할 때만 복사본을 반환합니다. 다른 모델의 보조 요청은 변경하지 않습니다. 마지막 기록과 푸터는 요청에 사용할 티어를 나타내며 서버의 실제 처리 티어나 과금을 확인하지 않습니다. 실제 티어는 서버 응답으로 확인해야 하며, API의 Fast 요금은 Standard와 다릅니다. [공식 안내](https://developers.openai.com/api/docs/guides/fast-mode)

## 라이선스

[Apache-2.0](LICENSE).
