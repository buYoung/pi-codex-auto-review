# @buyong/redact

[English](README.md) | **한국어**

텍스트와 JSON이 로그나 언어 모델에 들어가기 전에 인증정보, 개인 키, 선택한 개인정보(PII)를 가립니다. 엔진은 특정 호스트에 묶이지 않습니다. 런타임 의존성과 전역 상태가 없고, 호출하는 쪽이 검증된 옵션으로 변경 불가능한 마스킹 인스턴스(redactor)를 만든 뒤 언제 호출할지 직접 정합니다.

이 엔진은 codemap-search의 가림 모듈(리비전 `86a772b`)을 TypeScript로 옮긴 것입니다. 원본의 규칙 id, 가림 계약, 설정 규칙을 그대로 따르며, 달라진 점은 [Rust 원본과 다른 점](#rust-원본과-다른-점)에 정리했습니다.

## 설치

```sh
npm install @buyong/redact
```

Node.js 22.19 이상이 필요하며 ESM 전용입니다.

## 빠른 시작

```js
import { createRedactor } from "@buyong/redact";

const redactor = createRedactor({
    sensitiveFields: ["internalCredential"],
    rules: [{ id: "custom.acme", pattern: "ACME_[A-Z0-9]+" }],
    exceptions: [{ ruleId: "custom.acme", value: "ACME_EXAMPLE" }],
});

redactor.redactText('password = "hunter2-value"');
// 'password = "[REDACTED]"'

const { value, maskedLocations } = redactor.redactJson({
    command: "curl -H 'Authorization: Bearer abcdefgh12345678' https://example.com",
});
// value.command는 토큰만 가리고 나머지를 유지합니다
// maskedLocations: [{ path: ["command"], ruleId: "credential.authorization" }, ...]
```

## 가림 계약

- 가려진 구간은 `[REDACTED]`가 됩니다. 표식보다 짧은 구간은 같은 길이의 `*`로 바뀌므로 출력이 길어지지 않습니다. 길이는 UTF-16 코드 단위(`String.prototype.length`)로 셉니다.
- 구간은 줄마다 따로 가리므로 CR/LF 문자와 줄 번호가 그대로 남습니다.
- 겹치거나 맞닿은 구간은 합친 뒤 가립니다.
- 이미 가린 출력을 다시 가려도 바뀌지 않습니다.
- 탐지 결과와 가린 위치에는 범위나 JSON 경로, 규칙 id, 종류만 담깁니다. 원래 값은 메타데이터, 오류, 설정 문제 보고 어디에도 남지 않습니다.

## API

| 내보내는 항목 | 용도 |
| --- | --- |
| `createRedactor(config?, host?)` | 설정을 검증하고 변경 불가능한 `Redactor`를 돌려줍니다. 문제가 하나라도 있으면 `RedactionConfigError`를 던집니다. |
| `redactor.scan(text, { mode?, filePath? })` | 전체 텍스트에서 민감한 구간을 찾아 `TextScan`을 돌려줍니다. |
| `scan.render(text)` / `scan.renderRange(text, start, end)` | 한 번의 전체 스캔으로 텍스트 전체나 원하는 범위를 렌더링합니다. |
| `redactor.redactText(text, options?)` | `scan`과 `render`를 함께 실행합니다. |
| `redactor.scanNamedValue(name, value)` / `redactor.redactNamedValue(name, value)` | 값을 가립니다. `name`이 민감한 필드면 값 전체를 가립니다. |
| `redactor.redactJson(value, options?)` | 객체 키, 숫자, 불리언, `null`을 유지한 채 JSON 호환 값을 가립니다. `{ value, maskedLocations }`를 돌려줍니다. |
| `redactor.isSensitiveField(name)` | 필드 이름이 민감한지 판단합니다. |
| `normalizeRedactionConfig(input)` | 예외를 던지지 않고 사용자 설정을 검증합니다. 잘못된 키는 `[]`로 대체되고 `issues`에 나타납니다. |
| `RedactionConfigError`, `formatIssue(issue)` | 오류 타입과 값을 포함하지 않는 문제 설명 문자열입니다. |
| `hideValue(value)`, `maskRanges(text, ranges)`, `REDACTION_MARKER` | 저수준 가림 도구입니다. |
| `isSupportedPiiEntity(name)`, `listSupportedPiiEntities()`, `piiRuleId(entity)` | PII 엔티티 조회입니다. |
| `BUILT_IN_RULE_IDS`, `PRIVATE_KEY_RULE_ID`, `SENSITIVE_FIELD_RULE_ID`, `normalizeFieldName(name)` | 규칙 id와 필드 이름 정규화입니다. |

### 스캔 모드

- `full`(기본값): 모든 규칙, 라벨을 보는 PII, 대입문 대체 탐지를 실행합니다.
- `context-free`: 주변 텍스트에 기대지 않는 규칙만 실행합니다. 이미 스캔한 원문에서 렌더링한 내용에 씁니다.

`filePath`는 힌트입니다. `.env`, `.env.*`, 그리고 확장자가 `.env`, `.ini`, `.properties`, `.cfg`인 파일에서는 대입문 대체 탐지가 공백과 구두점을 포함한 줄 값 전체를 가립니다.

### JSON 옵션

| 옵션 | 기본값 | 효과 |
| --- | --- | --- |
| `stringScope` | `"whole"` | `whole`은 문자열을 한 번에 스캔하므로 여러 줄에 걸친 PEM 블록과 YAML 블록 스칼라를 찾습니다. `line`은 줄마다 따로 스캔합니다. |
| `textContent` | `"full"` | `context-free`이면 `type`이 `"text"`인 객체의 `text`에 문맥 없는 규칙만 다시 적용합니다. |
| `shouldPreserve(path)` | 없음 | `true`를 돌려준 경로의 값은 하위 구조까지 그대로 복사합니다. 구조 식별자에 씁니다. |

민감한 키 아래의 문자열은 전체를 가립니다. 민감한 키 아래의 배열과 객체는 그 민감성을 물려받지 않습니다. `toJSON`이 있는 객체는 `JSON.stringify`처럼 먼저 직렬화합니다.

## 규칙

| 규칙 id | 종류 | 탐지 대상 |
| --- | --- | --- |
| `token.aws-access-key` | token | `AKIA`/`ASIA` 액세스 키 id |
| `token.github` | token | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_` 토큰 |
| `token.openai` | token | 16자 이상인 `sk-` 키 |
| `token.google` | token | `AIza` API 키 |
| `token.slack` | token | `xoxb-`, `xoxa-`, `xoxp-`, `xoxr-`, `xoxs-` 토큰 |
| `token.jwt` | token | `eyJ`로 시작하는 JSON Web Token |
| `token.stripe` | token | `sk_live_`, `sk_test_`, `rk_live_`, `rk_test_` 키 |
| `token.gitlab` | token | `glpat-` 토큰 |
| `token.npm` | token | `npm_` 토큰 |
| `token.sendgrid` | token | `SG.` API 키 |
| `credential.authorization` | credential | `Authorization`/`Proxy-Authorization`의 Basic, Bearer 값 |
| `credential.bearer` | credential | 8자 이상인 `Bearer` 값 |
| `credential.url-password` | credential | `scheme://user:password@` URL의 비밀번호 |
| `credential.webhook-url` | credential | HTTP 웹훅 URL에서 `/hooks/` 뒤의 경로 |
| `private-key.pem` | private-key | PEM 개인 키 블록. 끝 표식이 없으면 텍스트 끝까지 가립니다 |
| `field.sensitive` | sensitive-field | 민감한 필드와 대입문의 값 |
| `custom.*` | custom | 설정에서 온 사용자 규칙 |
| `host.*` | host | 호스트가 코드로 등록한 규칙 |
| `pii.*` | pii | 선택해서 켜는 PII 엔티티 |

`secret` 그룹이 있는 규칙은 그 그룹만 가립니다. 예를 들어 `credential.url-password`는 사용자 이름과 호스트를 보이게 둡니다.

### 민감한 필드

필드 이름은 글자와 숫자만 남기고 소문자로 바꿔 정규화합니다(`Api-Key` → `apikey`). 정규화한 이름이 `apikey`, `token`, `password`, `passwd`, `pwd`, `secret`, `secretkey`, `privatekey`, `accesskey`, `accesskeyid`로 끝나거나, 같은 방식으로 정규화한 `sensitiveFields` 항목과 같으면 민감한 필드입니다.

### 대입문 대체 탐지

`full` 모드에서 민감한 키에 대한 `key = value`, `key: value` 대입문은 다음을 가립니다.

- 따옴표 본문(`"…"`, `'…'`, 백틱, 삼중 따옴표, `r`/`b`/`f`/`u`/`@` 접두사, Rust raw 문자열, 따옴표 두 번 쓰기 이스케이프)
- 들여쓰기로 범위를 정하는 YAML 블록 스칼라(`|`, `>` 헤더)
- `filePath`가 알려 줄 때의 ENV/INI 줄 값
- 따옴표 없는 값. 단, 그 줄에서 키 앞의 텍스트가 비어 있거나 `export`이거나 따옴표, `{`, `,`로 끝날 때만 가립니다. `null`, `None`, `nil`, `true`, `false`, `$`·`[`·`{`로 시작하는 값, `(`가 들어간 값은 건너뜁니다.

## 설정

```ts
interface RedactionConfig {
    sensitiveFields?: string[]; // 정규화 후 정확히 일치하는 이름
    rules?: { id: string; pattern: string; flags?: string }[];
    exceptions?: { ruleId: string; value: string }[];
    piiEntities?: string[];
}
```

- `rules[].id`는 `custom.` 뒤에 글자, 숫자, `.`, `_`, `-`가 오는 형식이며 중복될 수 없습니다.
- `rules[].pattern`은 Rust 문법이 아니라 JavaScript `RegExp` 문법입니다. `(?<secret>…)` 그룹을 쓰면 그 그룹만 가립니다. `flags`에는 `i`, `m`, `s`, `u`를 한 번씩만 쓸 수 있고, 엔진이 `d`와 `g`를 붙입니다. `(?i:…)` 같은 인라인 수정자 그룹은 Node.js 22에서 쓸 수 없습니다. `\b`, `\w`, `\d`는 `u` 플래그와 유니코드 속성 이스케이프를 쓰지 않으면 ASCII만 다룹니다.
- 빈 문자열과 일치하는 패턴은 거부합니다.
- 패턴은 신뢰할 수 없는 텍스트에서 실행됩니다. 역추적이 폭발할 수 있는 중첩 반복은 피하세요.
- `exceptions[]`는 규칙 id가 같고 원래 일치한 값 전체가 같을 때만 그 탐지를 뺍니다. 따옴표 값은 바깥 따옴표를 빼고, 이스케이프를 풀지 않은 채 비교합니다. 한 규칙의 예외가 겹치는 다른 규칙의 탐지를 빼 주지는 않습니다.
- 문제 보고에는 키와 색인만 담습니다. 패턴, 예외 값, `RegExp` 파서 메시지는 절대 다시 보여 주지 않습니다. 알 수 없는 최상위 키는 그 이름으로 보고합니다.

### 호스트 추가 규칙

```js
createRedactor(userConfig, {
    rules: [{ id: "host.legacy-marker", pattern: "SYNTHETIC_[A-Z0-9_]+", flags: "i" }],
    sensitiveFields: ["authorization"],
});
```

호스트 규칙은 `host.` 이름공간을 써서 사용자 `custom.` 규칙과 겹치지 않으며, 같은 기준으로 검증합니다. 호스트 필드는 사용자 `sensitiveFields`처럼 정확히 일치하는 이름입니다.

## PII

PII 탐지는 기본으로 꺼져 있습니다. 켤 엔티티를 `piiEntities`에 나열합니다.

```js
const redactor = createRedactor({ piiEntities: ["EMAIL_ADDRESS", "IBAN_CODE", "KR_RRN"] });
```

- 엔티티 이름은 대소문자까지 정확히 일치해야 합니다. `listSupportedPiiEntities()`는 90개 이름 전체를 카탈로그 순서로 돌려주며, 알 수 없는 이름은 그 색인의 문제로 보고합니다.
- 각 엔티티의 규칙 id는 `pii.` 뒤에 이름을 소문자로 바꾸고 `_`를 `-`로 바꾼 형식입니다(`EMAIL_ADDRESS` → `pii.email-address`). 특정 값을 보이게 두려면 이 id로 `exceptions`에 적습니다.
- 목록이 비어 있으면 카탈로그를 해석하지도, 컴파일하지도 않습니다.
- 카탈로그는 Presidio의 패턴 인식기입니다. 정규식에 체크섬·형식 검증기(Luhn, IBAN, Verhoeff, 국가별 신분번호 체크섬, base58check, bech32 등)를 더한 방식이며 언어 모델은 쓰지 않습니다. 그래서 이름, 도로명 주소, 자유 서술 문장은 탐지하지 않습니다.
- 약한 패턴은 같은 필드나 문장 안에서 값 앞 160 UTF-8 바이트 이내에 `passport`, `ssn` 같은 엔티티 라벨이 있을 때만 값을 받아들입니다. 라벨 뒤에는 `id`, `number`, `code`, `no`가 붙어도 됩니다(`memberId`, `passportNumber`). 이런 패턴은 `full` 모드에서만 실행되고, `context-free` 모드는 라벨이 필요 없는 패턴만 적용합니다.
- PII 가림은 로컬에서 결정적으로 동작합니다. 식별자처럼 보이기만 하는 값을 가릴 수 있고, 카탈로그에 없는 형식의 값은 가리지 않습니다.

## Rust 원본과 다른 점

- 텍스트 대체 탐지만 옮겼습니다. tree-sitter 구문 판단(`node_text`, 리터럴 대응, 구문으로 판단해 참조를 보이게 두는 처리, PII 식별자 보호)은 옮기지 않았습니다. 그래서 줄 맨 앞의 `password: str = external_value`는 `external_value`를 가리고, 템플릿 리터럴과 문자열 연결은 적힌 그대로 가리며, JSON 키의 이스케이프는 풀지 않습니다.
- 켜고 끄는 스위치와 요청 단위 활성화가 없습니다. 호출하는 쪽이 redactor를 부를지 정합니다.
- 탐지 캐시가 없습니다.
- 범위와 표식 길이 비교에 UTF-8 바이트 대신 UTF-16 코드 단위를 씁니다. 그래서 `한글-비밀번호`처럼 짧은 비ASCII 값은 원본의 `[REDACTED]` 대신 `*******`가 됩니다.
- `\b`, `\w`, `\d`, `\s`는 명시한 유니코드 속성 클래스로 원래의 유니코드 의미를 유지합니다. 속성 데이터는 JavaScript 런타임의 것을 쓰고, 원본의 `regex` 1.13은 유니코드 16.0을 씁니다. 그래서 Node.js 24 이상(유니코드 17.0)에서는 17.0에 새로 추가된 문자를 글자나 숫자로 봅니다. 그런 문자 바로 옆에 붙은 값은 원본과 다르게 일치할 수 있고, 대개 원본이 가리는 값을 가리지 않는 쪽입니다(`AKIAIOSFODNN7EXAMPLE` 바로 뒤에 U+16EAA가 붙은 경우). 유니코드 16.0까지 있던 문자는 지원하는 모든 Node.js 버전에서 같게 동작합니다.
- `token.jwt`, `credential.url-password`, `credential.webhook-url`, 대입문 대체 탐지, PEM 끝 표식 검색은 원본 패턴과 같은 결과를 내는 선형 시간 스캐너를 씁니다. JavaScript로 그대로 옮기면 역추적이 2차 시간으로 늘어나기 때문입니다.
- 같은 이유로 `EMAIL_ADDRESS` 후보 검색은 카탈로그 패턴과 같은 결과를 내는 선형 시간 스캐너를 씁니다.
- `cases.jsonl`의 PII 범위는 UTF-8 바이트 위치이고, 엔진은 같은 구간을 UTF-16 색인으로 보고합니다.
- tree-sitter 식별자 보호가 없어서 식별자에 걸린 PII도 가립니다. `const member = sha256;`은 `const member = ******;`가 됩니다.
- `normalizeRedactionConfig`는 `sensitiveFields` 항목을 적힌 그대로 두고, 일치를 볼 때 정규화합니다.
- 저장소 설정과 전역 설정을 겹쳐 쓰는 계층 처리는 라이브러리에 포함하지 않습니다.

## 라이선스

Apache-2.0
