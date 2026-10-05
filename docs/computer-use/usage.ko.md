# pi에서 Codex Computer Use·Browser Use 사용하기

[English](usage.md) | **한국어**

설치된 Codex 데스크톱 런타임으로 pi 모델이 앱·브라우저 작업을 수행하게 만드는 안내입니다. 두 기능은 기본으로 켜지지만 앱·출처 접근에는 런타임 승인이 적용됩니다. 패키지는 MCP 호스트 연결만 제공하며 자동화 엔진이나 OS 샌드박스를 포함하지 않습니다.

## 시작하기 전에

- Node.js `>=22.19.0`, pi `0.99.1` 이상을 사용하세요. 실제 세션은 pi `0.99.1`에서 검증했습니다.
- Codex 데스크톱을 설치하고 Codex가 포함된 ChatGPT 구독 계정으로 로그인하세요. Computer Use를 한 번 활성화하면 데스크톱이 플러그인 실행 설정을 설치합니다. 패키지는 `auth.json`을 읽지 않고 구독·로그인을 확인할 수 없습니다.
- macOS에서는 `Codex Computer Use.app`에 손쉬운 사용·화면 기록 권한을 허용하세요. 다른 프로세스에 무분별하게 허용하지 마세요.
- Browser Use에는 Google Chrome 실행, ChatGPT Chrome 확장 활성화, 네이티브 메시징 호스트를 설치하는 Codex 데스크톱의 Chrome/Browser 플러그인이 필요합니다.
- 처음 사용할 때는 Codex 데스크톱을 실행해 두세요. 앱 종료 상태의 동작은 미검증입니다. macOS는 검증했고 Windows는 구현했지만 미검증이며 Linux는 지원하지 않습니다.

## 1. 패키지 로드

첫 npm 게시 후 `0.1.0`을 설치합니다.

```sh
pi install npm:@buyong/pi-codex-computer-use@0.1.0
pi list
pi
```

게시 전에는 저장소 루트에서 소스 빌드를 사용합니다.

```sh
npm install
npm run build -- --filter=@buyong/pi-codex-computer-use
node_modules/.bin/pi -ne -e packages/pi-codex-computer-use/dist/index.js
```

정상 로드되면 `/computer-use`를 사용할 수 있습니다. 하나 이상의 기능이 켜져 있고 런타임 연결에 성공하면 `mcp__cua_repl__js`·`mcp__cua_repl__js_reset`이 노출됩니다. 하단 상태에 기능·서버 상태를 표시합니다.

## 2. 사전 요구사항 점검

간단한 기능 설정 목록과 별도로 다음 명령을 실행해 점검합니다.

```text
/computer-use-check
/computer-use status
```

`/computer-use-check`는 런타임·Chrome 요구사항을 점검하고 설치 가이드를 출력합니다. 누락·미검증·사용자 확인 개수를 요약하며, 점검 결과가 실제 자동화 작업의 성공을 보장하지는 않습니다. 기존 `/computer-use check`도 같은 점검으로 연결됩니다. `status`는 전체 진단 없이 현재 설정, 런타임 출처, 서버 PID·기능을 보여 줍니다. `ok`는 점검 통과, `missing`은 사용자가 할 일, `user-owned`는 로그인·구독·OS 권한처럼 사용자가 충족할 항목입니다. `unverified`는 통과가 아닙니다.

탐색은 `CODEX_HOME/plugins/cache/openai-bundled/unified-computer-use/<version>/.mcp.json`의 최신 활성 Codex 데스크톱 설정을 우선합니다. `CODEX_HOME` 기본값은 `~/.codex`입니다. macOS에서는 캐시가 없으면 설치된 앱의 `cua_node/manifest.json`으로 실행 계획을 구성할 수 있습니다. Windows에는 데스크톱이 작성한 캐시 설정이 필요합니다. Codex 설정을 다시 쓰지 않습니다. 앱 번들 폴백 설정과 서비스 위치는 최초 서비스 실행이 검증되지 않아 미검증으로 표시합니다.

가이드는 Codex 데스크톱 설치(CLI만으로는 부족), Codex 이용 가능 계정 로그인, Computer Use를 사용할 경우 최초 활성화와 서비스 권한 허용, Browser Use를 사용할 경우 Chrome·ChatGPT 확장·Browser 플러그인 설정, `/computer-use-check` 재점검, pi에서 원하는 기능 켜기 순서로 안내합니다. 초기 사용 중에는 데스크톱을 실행해 두세요. 명령은 설치·복사·등록 복구·권한 허용·설정 변경·자격 증명 읽기·탭 실행·앱 조작을 수행하지 않습니다. 지원하지 않는 플랫폼에는 잘못된 로컬 설치 경로 대신 지원 플랫폼 사용을 안내합니다.

## 3. 기능 선택

```text
/computer-use
```

목록 하나에 **Computer Use**와 **Browser Use**를 표시합니다. `↑` / `↓`로 기능을 선택하고 `Enter` / `Space`로 `on`·`off`를 바꿉니다. 변경은 즉시 저장하며 진행 상태·오류를 같은 화면에 표시합니다. 화면과 선택한 항목을 유지해 한 번 들어가 두 기능을 모두 바꿀 수 있습니다. `Esc`는 화면을 닫으며 저장한 변경을 되돌리지 않습니다.

Browser Use만 사용하려면 Computer Use는 `off`, Browser Use는 `on`으로 설정합니다. 인자 명령도 유지합니다.

```text
/computer-use computer off
/computer-use browser on
```

RPC에서는 같은 두 기능과 Close가 있는 반복 선택 메뉴를 사용합니다. print/JSON 모드는 상태를 출력하고 명시적 인자를 받으며 커스텀 화면을 렌더링하지 않습니다.

| 설정 | 런타임 기능 | 모델 도구 |
| --- | --- | --- |
| 둘 다 켜짐 | `browser,computer` | `js`, `js_reset` |
| Computer Use만 | `computer` | `js`, `js_reset` |
| Browser Use만 | `browser` | `js`, `js_reset` |
| 둘 다 꺼짐 | 서버 없음 | 숨김 |

설정은 `<agentDir>/codex-computer-use/settings.json`에 저장합니다. `agentDir`는 `PI_CODING_AGENT_DIR` 또는 `~/.pi/agent`입니다. 파일이 없으면 둘 다 true이며 두 불리언 키만 허용합니다. 잘못된 파일은 두 기능을 끄는 쪽으로 처리하며 토글 명령으로 덮어쓰지 않습니다. 파일을 고친 뒤 세션을 다시 로드하거나 시작하세요. 설정 변경은 에이전트가 멈출 때까지 기다린 뒤 서버를 재시작해 이전 REPL 상태를 없앱니다.

## 4. 작업 실행과 승인

먼저 조작 없이 목록만 확인하려면 다음처럼 요청하세요.

```text
Use mcp__cua_repl__js to run await cua.getState(). Summarize the available apps and browsers without operating them.
```

공개 브라우저 페이지에서는 다음처럼 요청할 수 있습니다.

```text
Use Browser Use to open https://example.com in Chrome, read its accessibility state, and close the tab. Do not submit forms or download anything.
```

런타임은 첫 `js` 호출에서 `cua.getState()`, `cua.getApp()`, `cua.createBrowserTab()` 같은 진입 API를 정확히 하나만 호출하도록 안내합니다. 결과를 변수에 할당하는 것은 허용하지만, 다음 호출 전에 반환된 문서·상태를 읽어야 합니다. `cua`는 이미 초기화됩니다. 통합 런타임은 구형 초기화 스킬을 숨기므로 `@oai/sky`나 browser-client를 수동으로 초기화하는 흐름을 사용하지 않습니다.

런타임의 데스크톱 예시에는 `iab`·`mcpapps`가 남아 있지만 pi는 Chrome만 활성화합니다. 패키지는 현재 호스트 제한을 모델용 도구 선언과 pi 시스템 지침에 추가하며, 등록된 런타임 원문 설명과 사용자의 시스템 프롬프트는 유지합니다. 사용자가 백엔드를 지정하지 않은 새 페이지는 Chrome을 안내하고, 지원하지 않는 백엔드를 명시하면 설명 없이 대체하지 않습니다.

진입 API와 기본 `getAXState()`는 이미 문서·상태를 출력하므로 다시 감싸 출력하지 않습니다. 단순 JavaScript 식의 값은 출력하지 않으며 추가 값에는 `nodeRepl.write()`, 추가 이미지에는 await와 함께 `nodeRepl.emitImage()`를 사용합니다. 지속되는 바인딩을 재사용하되 REPL 초기화·설정 재시작 후에는 다시 얻고, 문맥 압축 후에는 `cua.rewriteDocumentation()`으로 문서를 복원합니다.

확인 대화상자는 Codex의 선택지 이름을 유지합니다.

- `Allow`: 이번 요청 한 번만 허용합니다.
- `Allow for this session`: 런타임이 세션 기억을 제공할 때만 표시합니다. 같은 세션의 후속 Finder 요청이 생략됨을 확인했습니다.
- `Always allow`: 영구 기억을 제공할 때만 표시합니다. OpenAI 런타임에 기억되는 권한을 바꿀 수 있어 검증에서는 사용하지 않았습니다.
- `Cancel`: 도구 승인을 취소합니다. 도구 승인 외 요청에는 `Deny`도 표시합니다.

출처 접근에는 `Allow`, `Always allow`, `Cancel`만 표시할 수 있습니다. `example.com`에서 확인한 방식이며 패키지가 별도 권한 저장소를 관리하지 않습니다.

클라이언트가 30초 제한을 두지 않아 사용자의 지연 응답을 받을 수 있습니다. 기본 `js` 제한 시간을 사용한 Finder 승인에서 60초 기다린 뒤에도 성공했습니다. Esc는 보류 중인 MCP 호출을 취소하고 대화상자를 닫습니다. 이미 실행 중인 JavaScript는 나중에 끝날 수 있으며 OS 수준의 즉시 종료는 아닙니다.

## 5. 종료 확인

테스트로 만든 브라우저 탭은 모델에 명시적으로 닫도록 요청하고, 기능을 바꾼 뒤 `/computer-use status`를 확인하세요. 에이전트 실행이 완전히 끝나면 `turn_ended`를 한 번 전달합니다. 정상은 `Stop`, 중단은 `Interrupt`입니다. pi 종료·다시 로드는 패키지 서버의 프로세스 트리를 종료하지만 Codex 데스크톱 자체 프로세스를 종료하지 않습니다.

긴 텍스트는 약 25,000토큰(100,000바이트) 이후 중간을 잘라 전달합니다. 전체 출력은 사용자만 읽을 수 있는 권한으로 시스템 임시 디렉터리에 저장하고, 결과에 그 경로를 표시합니다. 이미지 블록은 그대로 모델에 전달합니다.

## 문제 해결

| 증상 | 조치 |
| --- | --- |
| 런타임을 찾지 못함 | Codex 데스크톱을 설치·업데이트하고 Computer Use를 한 번 활성화하세요. `status`의 런타임 출처를 확인합니다. macOS 비표준 앱 경로는 `PI_CODEX_COMPUTER_USE_APP_PATH`로 지정합니다. |
| `platform-unsupported` | macOS 또는 Windows를 사용하세요. Windows에는 실기기 검증이 더 필요합니다. |
| 잘못된 설정 | 표시된 설정 파일의 두 불리언 키를 고친 뒤 다시 로드·시작합니다. 알 수 없는 키를 조용히 지우지 않습니다. |
| Codex `setup.sh`가 `bin/npm` 부재를 알림 | 검증한 데스크톱 빌드는 검증 스크립트와 달리 npm/npx를 포함하지 않습니다. 스크립트는 미검증으로 보고하고 Node 버전·`@oai/sky` import·`node_repl --help`를 별도로 검증합니다. |
| Chrome 요구사항 부족 | `check` 안내대로 Chrome을 설치·실행하고 ChatGPT 확장을 켜거나 Codex 데스크톱의 Chrome/Browser 플러그인을 활성화·재설치하세요. 패키지는 네이티브 호스트를 복구하지 않습니다. |
| `Browser is not available: iab` / `mcpapps` | Chrome을 사용하세요. Codex 데스크톱 실행 중에도 pi에서는 해당 백엔드가 실패했습니다. |
| print/JSON 모드의 승인 UI 부재 | 대화형 pi 또는 대화상자를 지원하는 RPC 클라이언트를 사용하세요. 무한 대기하지 않고 거절하며 도구 오류에 이유를 추가합니다. |
| 로그인·OTP·URL 승인 거절 | 이 패키지에는 해당 확인 요청을 처리하는 pi UI가 없습니다. |
| 취소 후 후속 호출 지연 | 런타임은 호출을 순서대로 실행합니다. 취소한 JavaScript가 완료·제한 시간까지 계속 실행되고 `turn_ended`가 뒤에서 기다릴 수 있습니다. |

로그는 `<agentDir>/codex-computer-use/mcp.log`에 기록하고 5 MiB에서 순환 저장합니다. 키 기반 가림이 페이지·앱 내용까지 제거하는 것은 아니므로 공유 전에 확인하세요. 비공개 런타임은 사용 정보를 전송할 수 있으며 Codex 밖에서의 동작은 미확인입니다.

## 검증 범위와 남은 한계

2026-10-05 macOS `ChatGPT.app` `26.930.31730`, pi `0.99.1`에서 앱·브라우저 목록, Finder 일회·세션·취소·지연 승인, RPC 중단, Chrome `example.com`의 출처 승인·접근성·닫기, 네 가지 기능 조합, 메타데이터, 이미지 출력, 잘림을 검증했습니다. 승인 흐름은 RPC로 확인했습니다. `/computer-use` 설정 화면은 일반 모드·어두운 테마 및 좁은 전체화면·밝은 테마의 실제 pi TUI에서 단일 목록의 선택, 저장, 다시 열기, 닫기를 확인했습니다. 후속 `example.com` 검증에서 모델이 호스트 안내를 따라 Chrome을 선택하고 탭 생성·읽기·닫기에 성공했습니다. 한 번의 실행 결과이며 실패율 감소를 측정한 것은 아닙니다.

Windows 실행, 앱 번들 폴백으로 네이티브 서비스가 처음 실행되는 경우, 데스크톱 앱 종료 상태, 영구 `Always allow`, 다운로드·업로드·전체 CDP·WebMCP는 미검증입니다. Guardian이 필요한 자동 사전 검사는 실패할 수 있습니다. OpenAI 런타임을 배포하거나 재허가하지 않습니다. 계정 이용 가능 여부와 적용되는 OpenAI 약관은 사용자가 확인합니다.

구현 근거는 저장소의 `docs/handoffs/computer-use/02-feasibility.json`부터 `07-publish-prep.json`까지 기록하며 이전 설정 UI 개선은 `08-settings-ui.json`에 기록하며 단일 목록·호스트 안내로 바꾼 최신 결과는 `09-guidance-and-settings.json`에 기록합니다. 첫 게시는 별도 승인을 받아 수동으로 수행하며, 공유 CI 패키징 워크플로는 workspace를 지원합니다.
