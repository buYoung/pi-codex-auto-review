# pi-codex-image-gen

[English](README.md) | **한국어**

Codex 호환 `image_gen` 도구와 번들 `imagegen` 스킬로 Pi에서 이미지를 생성하고 편집하는 확장입니다. 이미지 요청에는 Pi의 `openai-codex` ChatGPT 구독 로그인을 사용하며, 현재 대화 프로바이더와 모델은 유지합니다.

## 사전 요구사항

- Node.js 22.19 이상
- Pi 0.99.1 이상
- Pi의 `openai-codex`에 로그인한 ChatGPT Plus/Pro 계정. 실제 이미지 사용 가능 여부는 계정과 서버 응답에 따라 달라집니다.

## 설치와 로그인

```sh
pi install npm:@buyong/pi-codex-image-gen
pi list
pi
```

Pi 안에서 ChatGPT 계정으로 로그인합니다.

```text
/login openai-codex
```

로그인이 없으면 확장이 모델에게서 `image_gen` 도구와 번들 스킬을 숨깁니다. 확장이 숨긴 도구는 로그인 후 다음 사용자 요청 전에 다시 활성화합니다. 사용자가 직접 비활성화한 도구는 그대로 둡니다.

## 이미지 모델 선택

기본 이미지 모델은 `gpt-image-2.5`입니다. Pi에서 설정 선택 창을 엽니다.

```text
/codex-imagen
```

`gpt-image-2.5`와 `gpt-image-2` 중 하나를 선택합니다. 선택한 모델은 저장되어 이후 이미지 생성·편집 요청과 Pi 재시작 후에도 적용됩니다. 명령 인자로 바로 지정할 수도 있습니다.

```text
/codex-imagen gpt-image-2.5
/codex-imagen gpt-image-2
```

설정 파일은 `<agentDir>/codex-image-gen/settings.json`입니다. `agentDir`는 Pi의 에이전트 데이터 디렉터리이며 `PI_CODING_AGENT_DIR`를 따릅니다.

```json
{
    "model": "gpt-image-2.5"
}
```

설정 파일이나 `model` 값이 없으면 `gpt-image-2.5`를 사용합니다. 이미지 요청마다 설정 파일을 읽으므로 직접 편집한 값도 다음 요청에 적용됩니다. 설정이 잘못됐거나 읽을 수 없으면 다른 모델로 요청하지 않고 오류를 반환합니다. 모델명은 기존 ChatGPT 구독 백엔드에 그대로 전달하며, 실제 사용 가능 여부는 계정과 서버 응답에 따라 달라집니다.

## 이미지 생성과 편집

Pi에 원하는 이미지를 요청합니다.

```text
image_gen으로 비 오는 골목의 작은 카페를 수채화로 그려줘.
```

편집할 때는 대화에 이미지를 첨부하거나 로컬 이미지의 절대 경로를 알려 줍니다.

```text
image_gen으로 /absolute/path/to/product.png를 편집해줘. 제품은 그대로 두고 배경을 제거해서 투명하게 만들어줘.
```

참조 이미지는 최대 5개까지 사용할 수 있습니다. 번들 스킬은 모델이 요청 문구를 구성하고 참조 이미지를 선택하도록 안내합니다.

| 인자 | 동작 |
| --- | --- |
| `prompt` | 생성할 이미지나 변경 사항 설명. 필수 |
| `transparent_background` | 투명 배경 요청. 기본값 `false` |
| `referenced_image_paths` | 로컬 이미지 절대 경로 최대 5개. `~/` 경로 확장 지원 |
| `num_last_images_to_include` | 현재 모델이 볼 수 있는 대화에서 최근 이미지 1~5개 사용 |

참조 옵션 두 개 중 하나만 사용합니다. 새 이미지를 생성할 때는 둘 다 생략합니다.

생성한 이미지는 Pi에 이미지 콘텐츠로 반환합니다. 확장은 Pi의 에이전트 데이터 디렉터리인 `agentDir` 아래 `<agentDir>/generated_images/<sessionId>/<toolCallId>.png`에 PNG 저장도 시도합니다. 세션과 도구 호출 이름은 파일명에 맞게 정리합니다. 저장에 실패해도 이미지는 Pi에 반환합니다.

## 문제 해결

`image_gen`이 보이지 않거나 구독 인증 정보가 없다는 오류가 나오면 `/login openai-codex`로 다시 로그인합니다. OpenAI API 키만으로는 이 확장이 사용하는 ChatGPT 구독 인증 정보를 제공할 수 없습니다. 현재 대화 모델은 유지해도 됩니다.

참조 이미지를 읽을 수 없으면 절대 경로가 맞는지, Pi가 파일을 읽고 이미지로 해석할 수 있는지 확인합니다. 최근 이미지로 편집할 때는 필요한 이미지가 현재 대화 문맥에 남아 있어야 하며, 그렇지 않으면 로컬 경로로 전달합니다.

## 라이선스

[Apache-2.0](LICENSE). 수정한 OpenAI Codex 스킬의 [라이선스](skills/imagegen/LICENSE.txt)와 [출처 고지](skills/imagegen/NOTICE)도 포함합니다.
