# @buyong/pi-codex-computer-use

[English](README.md) | **한국어**

Codex 데스크톱에 이미 설치된 비공개 런타임으로 pi에서 Computer Use와 Browser Use를 사용하는 독립 TypeScript 확장입니다. Codex의 통합 `cua_repl` MCP 서버를 실행해 텍스트·이미지를 전달하고, 확인 요청을 Codex와 같은 선택지로 보여 줍니다. 두 기능은 **기본으로 켜지며** 각각 끌 수 있습니다.

OpenAI 런타임 파일을 포함·다운로드·복사·재배포하지 않습니다. OS 샌드박스가 아니며, 자동화 엔진을 별도로 재구현하지 않습니다.

## 사전 요구사항

| 항목 | 필요한 조건 |
| --- | --- |
| Node.js | `>=22.19.0` |
| pi | `0.99.1` 이상을 사용하세요. 실제 검증은 `0.99.1`에서 수행했고 `1.0.2`는 상태 확인만 검증했습니다. manifest의 peer 범위에 포함되는 더 오래된 버전은 미검증입니다. |
| Codex 계정 | Codex가 포함된 ChatGPT 구독과 Codex 데스크톱 로그인. 패키지는 자격 증명을 읽거나 계정의 이용 가능 여부를 확인하지 않습니다. |
| Codex 데스크톱 | Computer Use 런타임을 포함한 앱 설치. macOS의 `ChatGPT.app`(번들 ID `com.openai.codex`) `26.930.31730`에서 검증했습니다. |
| Computer Use | Codex 데스크톱이 설치한 네이티브 서비스. macOS에서는 `Codex Computer Use.app`에 손쉬운 사용·화면 기록 권한을 허용합니다. |
| Browser Use | Google Chrome 실행, ChatGPT Chrome 확장 활성화, Codex 데스크톱의 Chrome 플러그인·네이티브 메시징 호스트 설치. |

macOS는 검증했습니다. Windows 탐색·점검은 구현했지만 **Windows 실기기에서 검증하지 않았습니다**. Linux 및 다른 플랫폼은 지원하지 않습니다. 브라우저 백엔드는 Chrome만 활성화하며 `iab`, `mcpapps`, Edge는 이 패키지에서 지원하지 않습니다. 데스크톱 앱 종료 상태는 미검증이므로 Codex 데스크톱을 실행해 두세요.

## 설치

`0.1.0`은 첫 게시를 준비한 버전입니다. 다음 명령은 **npm 게시 후** 사용할 수 있습니다.

```sh
pi install npm:@buyong/pi-codex-computer-use@0.1.0
pi list
pi
```

소스 체크아웃에서는 저장소 루트에서 다음 명령으로 영구 설치 없이 실행할 수 있습니다.

```sh
npm install
npm run build -- --filter=@buyong/pi-codex-computer-use
node_modules/.bin/pi -ne -e packages/pi-codex-computer-use/dist/index.js
```

pi에서 `/computer-use-check`로 요구사항 점검과 첫 사용 가이드를 확인한 뒤 `/computer-use`로 기능을 선택하세요. 누락·미검증·사용자 확인 항목을 구분하고 데스크톱 설치·로그인, 네이티브 서비스 권한, Chrome 확장·네이티브 호스트 등록을 안내합니다. 패키지는 설치된 런타임을 검증하고 서비스 위치를 찾지만, Codex 설정·플러그인 캐시·네이티브 호스트 등록을 복구하지 않습니다.

## 사용 방법

```text
/computer-use
```

pi 기본 설정 목록 하나에 **Computer Use**와 **Browser Use**만 표시합니다. `↑` / `↓`로 기능을 선택하고 `Enter` / `Space`로 `on`·`off`를 바꿉니다. 변경은 즉시 저장되고 런타임이 다시 연결되며, 화면과 선택 위치는 그대로 유지됩니다. `Esc`는 화면을 닫으며 저장한 변경을 되돌리지 않습니다. 이 화면에는 탭이나 진단 패널이 없습니다.

RPC에서는 커스텀 터미널 화면을 지원하지 않아 반복 선택 메뉴를 제공합니다. UI 없는 모드에서는 인자 없는 명령이 상태를 출력합니다. 스크립트용 인자도 유지합니다.

```text
/computer-use-check
/computer-use status
/computer-use computer off
/computer-use browser off
/computer-use computer on
/computer-use browser on
```

기존 `/computer-use check`도 같은 점검·가이드로 연결됩니다. 점검 명령은 설치, 호스트 등록 복구, 기능 설정 변경, Codex 자격 증명 읽기, 앱·브라우저 작업을 수행하지 않습니다. macOS 앱 번들 폴백과 네이티브 서비스 최초 실행은 준비 완료가 아니라 미검증으로 표시합니다.

설정 파일은 `<agentDir>/codex-computer-use/settings.json`에 저장합니다. `agentDir`는 `PI_CODING_AGENT_DIR`를 따르며, 보통 `~/.pi/agent`입니다.

```json
{
  "computerUse": true,
  "browserUse": true
}
```

파일이 없으면 쓰기 없이 위 기본값을 사용합니다. 파일이 잘못되면 그 세션에서 두 기능을 끄고 오류를 알립니다. 토글 명령은 에이전트가 멈출 때까지 기다린 뒤 설정을 저장하고 런타임을 재시작합니다. 재시작하면 REPL 변수와 앱·탭 연결이 사라집니다. 두 기능을 모두 끄면 MCP 프로세스를 실행하지 않고 도구를 숨깁니다.

모델에 `mcp__cua_repl__js`를 사용하도록 요청할 수 있습니다.

```text
Use mcp__cua_repl__js to run await cua.getState(). Summarize the available apps and browsers without operating them.
```

서버의 원문 설명문은 유지합니다. pi는 모델용 도구 선언과 기본 시스템 지침에 Chrome 전용 Browser Use, 활성 기능, 시작·초기화 후 진입 API 하나만 호출하기, 구형 수동 초기화 금지, 출력·바인딩 사용법을 추가합니다. 사용자 정의 시스템 프롬프트에서도 데스크톱 전용 `iab`·`mcpapps` 예시를 pi에서 가능한 백엔드로 오해하지 않도록 안내합니다. 별도 스킬이나 자동 재시도·초기화는 추가하지 않습니다. `js`·`js_reset`을 노출하며 `turn_ended`·모듈 디렉터리 변경은 내부 용도로만 사용합니다. 실제 pi 세션에서 브라우저 탭 생성, 접근성 읽기, 텍스트·이미지 출력, 중단, 턴 종료 알림을 확인했습니다. 검증 범위와 문제 해결은 [사용 안내](docs/computer-use/usage.ko.md)를 참고하세요.

## 승인과 한계

- 런타임이 제공하는 기억 범위에 따라 `Allow`, `Allow for this session`, `Always allow`, `Cancel`을 보여 줍니다. 도구 승인 외 요청은 `Deny`도 보여 줍니다. 기억된 권한은 pi가 아니라 런타임이 관리합니다. 해당 앱·출처를 조작할 수 있는 권한이며, 읽기만 허용하는 권한이 아닙니다.
- print/JSON 모드에서는 사용자 입력이 필요한 요청을 거절하고, 도구 결과에 승인 UI가 없다는 이유를 추가합니다. RPC 클라이언트는 pi UI 요청에 답해야 합니다. UI가 없는 모드의 상태·진단 문구는 stderr로 출력합니다.
- 일반적인 빈 스키마의 `js`/`node_repl` 실행 승인에는 Codex 사용자 승인자의 자동 승인 규칙을 적용합니다. 민감한 요청은 이 규칙에 포함되지 않습니다. Guardian 연결은 구현하지 않아 일부 자동 안전 사전 검사는 동작하지 않을 수 있습니다.
- 브라우저 로그인·QR, 이메일 OTP, URL 방식 확인 요청, 지원하지 않는 폼은 거절합니다. 다운로드·업로드·전체 CDP·WebMCP는 종단 간 검증하지 않았습니다.
- 중단 시 MCP 취소를 전달하지만, 실행 중인 JavaScript는 런타임 안에서 완료되거나 자체 제한 시간에 도달할 때까지 계속될 수 있습니다. 따라서 `turn_ended`도 늦어질 수 있으며 OS 수준의 즉시 중단을 보장하지 않습니다.
- 앱 번들 폴백으로 서비스가 처음 실행되는 경우, Windows 실행, 데스크톱 앱 종료 상태는 미검증입니다. 설정 이동·저장은 실제 pi TUI(일반 모드·어두운 테마, 좁은 전체화면·밝은 테마)에서 확인했고, 승인 흐름은 pi RPC로 확인했습니다.
- Codex 비공개 인터페이스는 데스크톱 업데이트로 바뀔 수 있습니다. 런타임이 사용 정보를 전송할 수 있으나 Codex 밖에서의 동작은 확인하지 못했습니다. 이 연결을 사용하기 전에 적용되는 OpenAI 이용약관을 확인하세요.

로그는 `<agentDir>/codex-computer-use/mcp.log`에 기록하며 순환 저장과 키 기반 비밀값 가림을 적용합니다. 페이지·앱 내용은 남을 수 있으므로 공유 전에 확인하고 가리세요.

## 라이선스

연결 코드에는 Apache-2.0을 적용합니다. [LICENSE](LICENSE)·[NOTICE](NOTICE)를 참고하세요. OpenAI의 비공개 런타임은 패키지에 포함되지 않으며 이 라이선스로 재허가하지 않습니다. [소스·구현 근거](https://github.com/buYoung/pi-codex-auto-review/tree/master/docs/handoffs/computer-use).
