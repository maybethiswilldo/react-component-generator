# server/AGENTS.md

## Module Context

Bun 런타임에서 동작하는 AI API 프록시 서버. 프론트엔드의 `/api/generate`, `/api/config` 요청을 받아 Anthropic 또는 Google API를 호출하고 정규화된 코드를 반환한다.

## Tech Stack & Constraints

- 외부 HTTP 호출은 SDK 없이 전역 `fetch`를 쓴다 (`index.ts:69,101`). 의존성을 추가하지 않는다.
- 런타임은 Bun(`Bun.serve`, `process.env`). `.env`는 Bun이 자동 로드한다.
- vitest는 Node 환경에서 `server/**/*.test.ts`를 실행한다 (`vite.config.ts:17`). 테스트 대상 모듈에서 `Bun` 전역을 쓰지 않는다.

## Implementation Patterns

- 순수 로직(문자열 정규화, 폴백 제어)은 `generator.ts`, `fallback.ts`에 두고 같은 이름의 `*.test.ts`를 옆에 만든다.
- 프로바이더별 호출 함수는 `call<Provider>(prompt, apiKey): Promise<string>` 시그니처로 통일하고, 결과 문자열을 `stripCodeFences` → `ensureRenderCall` 순으로 처리한다 (`index.ts:183-188`).
- 모든 응답은 `CORS_HEADERS`를 함께 반환한다 (`index.ts:51`). 새 응답 분기에서 빠뜨리지 않는다.
- Google 모델 우선순위는 `GOOGLE_MODELS` 배열 순서다 (`index.ts:5`).

## Testing Strategy

- 실행: `bun run test` (전체) 또는 `bunx vitest run server`.
- 패턴: 입력 문자열 → 출력 문자열 단언 (`generator.test.ts`), 실패/성공 시퀀스를 모킹한 폴백 검증 (`fallback.test.ts`).

## Local Golden Rules

- `index.ts`를 테스트에서 import하지 않는다. import만으로 포트 3002에 서버가 뜬다 (`index.ts:138`). 검증할 로직이 생기면 순수 모듈로 분리한다.
- `/api/config` 응답에 `ENV_KEYS` 값을 그대로 넣지 않는다. `!!` 변환된 boolean만 허용 (`index.ts:150-153`).
- 클라이언트가 보낸 키가 서버 환경 키보다 우선한다 (`resolveApiKey`, `index.ts:65`). 이 우선순위를 바꾸지 않는다.
- 에러 메시지에 요청 URL 전체를 포함하지 않는다. Google URL에 키가 들어 있다 (`index.ts:99`).
- 상태 코드 기반 분기(`index.ts:194,201`)는 `message.includes`에 의존한다. 새 에러 문구에 `503`, `429` 숫자가 우연히 들어가지 않게 한다.
