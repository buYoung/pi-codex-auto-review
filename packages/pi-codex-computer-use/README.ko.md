# @buyong/pi-codex-computer-use

[English](README.md) | **한국어**

Codex Desktop에 설치된 Computer Use·Browser Use 런타임을 Pi에서 사용합니다. 독립 TypeScript 확장이 통합 `cua_repl` MCP 서버를 실행하고 텍스트·이미지를 전달하며, 런타임 승인 요청을 Pi에서 보여 줍니다. **두 기능은 기본으로 켜져 있고** 각각 끌 수 있습니다.

호스트 연결을 제공하는 패키지이며 자동화 엔진이나 OS 샌드박스가 아닙니다. OpenAI 비공개 런타임을 포함·다운로드·복사·재배포하지 않습니다.

## 요구 사항

| 항목 | 필요한 조건 |
| --- | --- |
| Node.js | 22.19 이상 |
| Pi | 0.99.1 이상. 기록된 실검증은 0.99.1에서 수행했고, 1.0.2에는 상태 확인 기록만 있습니다. 매니페스트의 더 넓은 peer 범위에 속한 이전 버전은 미검증입니다. |
| Codex Desktop | Computer Use 런타임이 설치되어 있고 Codex 접근이 가능한 계정으로 로그인한 상태. 패키지는 구독 이용 가능 여부나 로그인을 확인하지 못합니다. |
| Computer Use | Desktop의 네이티브 서비스. macOS에서는 `Codex Computer Use.app`에 손쉬운 사용·화면 기록 권한을 허용합니다. |
| Browser Use | 실행 중인 Google Chrome, 활성화한 ChatGPT Chrome 확장, 네이티브 메시징 호스트가 등록된 Desktop의 Chrome/Browser 플러그인 |

기록된 실검증은 macOS `ChatGPT.app`(번들 ID `com.openai.codex`) `26.930.31730`을 사용했습니다. Windows 탐색·점검은 구현했지만 **Windows 실기기에서 검증하지 않았습니다.** Linux와 다른 플랫폼은 지원하지 않습니다. Desktop을 실행해 두세요. 앱 종료 상태는 미검증입니다.

**활성 브라우저 백엔드는 Chrome뿐입니다.** Desktop 런타임 문서의 `iab`·`mcpapps`·Edge 예시는 Pi에서 해당 백엔드를 사용할 수 있다는 뜻이 아닙니다.

## 설치와 첫 점검

게시된 릴리스를 설치합니다.

```sh
pi install npm:@buyong/pi-codex-computer-use
pi list
pi
```

릴리스로 고정하려면 `@<version>`을 붙입니다. 현재 체크아웃이나 미게시 패키지는 아래 소스 안내를 사용하세요. 이 개별 확장과 `@buyong/pi-codex`를 함께 활성화하지 마세요.

Pi에서 다음 순서로 진행합니다.

1. `/computer-use-check`를 실행하고 누락된 요구 사항을 해결합니다. `user-owned`는 직접 확인할 항목이며 `unverified`는 통과가 아닙니다.
2. `/computer-use`에서 필요한 기능만 켭니다.
3. 앱·브라우저를 조작하지 않고 목록만 확인하도록 요청합니다.

```text
Use mcp__cua_repl__js to run await cua.getState(). Summarize the available apps and browsers without operating them.
```

런타임이 연결되면 활성 기능에 대해 `mcp__cua_repl__js`·`mcp__cua_repl__js_reset`을 제공합니다. 탐색·시작에 실패하면 하단에 오류를 표시하고 런타임 도구는 숨깁니다. 사전 점검이 실제 자동화 작업의 성공을 보장하지는 않습니다.

## 기능 변경과 상태 확인

`/computer-use`는 TUI의 설정 목록 하나를 엽니다. **↑/↓**로 Computer Use·Browser Use를 선택하고 **Enter/Space**로 바꿉니다. 변경은 즉시 저장하고 런타임을 재시작합니다. 선택한 항목과 화면을 유지하며, Esc는 저장한 변경을 되돌리지 않고 닫습니다.

| 명령 | 용도 |
| --- | --- |
| `/computer-use-check` | 요구 사항 보고서와 첫 사용 가이드 |
| `/computer-use status` | 현재 기능, 설정 경로, 런타임 출처와 서버 상태 |
| `/computer-use computer on` / `off` | Computer Use 변경 |
| `/computer-use browser on` / `off` | Browser Use 변경 |
| `/computer-use check` | `/computer-use-check`의 호환용 별칭 |

RPC는 기능 두 개와 Close 항목이 있는 반복 선택창을 사용합니다. UI가 없으면 인자 없는 명령은 상태를 출력하며 명시적인 인자도 사용할 수 있습니다. print·JSON 모드의 상태·점검 문구는 stderr로 출력합니다.

설정 파일은 `<agentDir>/codex-computer-use/settings.json`입니다. `agentDir`은 `PI_CODING_AGENT_DIR`을 따르며 보통 `~/.pi/agent`입니다.

```json
{
  "computerUse": true,
  "browserUse": true
}
```

파일이 없으면 생성하지 않고 기본값을 사용합니다. 기존 파일에는 이 불리언 키 두 개가 정확히 있어야 합니다. 잘못됐거나 읽을 수 없으면 두 기능을 끄며, 토글 명령은 잘못된 파일을 덮어쓰지 않습니다. 파일을 고치고 `/reload`하거나 Pi를 재시작하세요.

기능 변경은 에이전트가 멈출 때까지 기다립니다. 재시작하면 REPL 변수와 앱·탭 바인딩이 사라집니다. 둘 다 끄면 서버를 시작하지 않고 도구를 숨깁니다. 직접 설정 파일을 바꾼 뒤에는 다시 로드하거나 시작해야 합니다.

## 승인과 한계

- 기억된 권한은 런타임이 관리합니다. 제공하는 범위에 따라 **Allow**, **Allow for this session**, **Always allow**, **Cancel**을 보여 주며, 도구 외 요청에는 **Deny**도 있습니다. 앱·출처를 조작할 수 있는 권한이며 읽기 전용 권한이 아닙니다.
- `node_repl`의 일반적인 빈 폼 `js` 실행 승인은 Codex 사용자 검토자의 자동 승인 규칙을 따릅니다. 민감 요청이나 사용자 입력이 필요한 요청에는 적용하지 않습니다. 이 연결은 Guardian 자동 검토를 구현하지 않습니다.
- print·JSON 모드에서는 사용자 상호작용이 필요한 요청을 거부합니다. RPC 클라이언트는 Pi UI 요청에 응답해야 합니다. 지원하는 일반 폼은 Pi 입력·선택·확인 창을 사용하지만, 브라우저 로그인·QR, 이메일 OTP, URL 요청과 지원하지 않는 폼은 거부합니다.
- MCP 취소를 보내도 이미 실행 중인 JavaScript는 완료되거나 런타임 제한 시간에 이를 때까지 계속될 수 있습니다. OS 수준의 즉시 중단을 보장하지 않습니다.
- macOS 앱 번들 폴백의 최초 서비스 실행, Windows 실행, Desktop 종료 상태, 영구 승인, 다운로드·업로드·전체 CDP·WebMCP는 미검증입니다.
- Desktop 업데이트로 비공개 인터페이스가 바뀔 수 있습니다. Codex 밖의 런타임 사용 정보 전송 동작은 확인되지 않았습니다. 적용되는 OpenAI 약관을 확인하세요.

로그는 `<agentDir>/codex-computer-use/mcp.log`에 기록하고 5 MiB에서 순환합니다. 키 기반 가림이 모든 페이지·앱 내용을 제거하지는 않습니다. 공유 전에 확인하고 가리세요.

런타임 탐색, 작업 예시, 승인 동작, 문제 해결과 기록된 검증 범위는 [사용법](https://github.com/buYoung/pi-codex-auto-review/blob/master/docs/computer-use/usage.ko.md)을 참고하세요. npm 압축 파일에도 `docs/computer-use/usage.ko.md`로 포함합니다.

## 소스 빌드와 로드

저장소 루트에서 실행합니다.

```sh
npm ci --ignore-scripts
npm run build -- --filter=@buyong/pi-codex-computer-use
node_modules/.bin/pi -ne -e ./packages/pi-codex-computer-use/dist/index.js
```

`-ne`는 자동 확장 탐색을 끄고 `-e`는 이번 실행에만 확장을 로드합니다. Desktop 준비는 계속 필요합니다. 소스를 바꾼 뒤 다시 빌드하고 Pi를 다시 로드하거나 시작하세요.

## 라이선스

연결 코드는 [Apache-2.0](https://github.com/buYoung/pi-codex-auto-review/blob/master/LICENSE)이며 압축 파일에 `LICENSE`로 포함합니다. 출처 표시는 [NOTICE](NOTICE)에 있습니다. OpenAI 비공개 런타임은 포함하거나 재허가하지 않습니다. [구현·검증 기록](https://github.com/buYoung/pi-codex-auto-review/tree/master/docs/handoffs/computer-use)은 과거 점검을 설명하며 패키지를 설치한 새 결과가 아닙니다.
