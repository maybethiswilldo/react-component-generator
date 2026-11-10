# AGENTS.md

## Operational Commands

- 패키지 매니저는 `bun` 고정 (`bun.lock`). npm/yarn/pnpm 사용 금지.
- 설치: `bun install`
- 개발 (API 서버 + Vite 동시): `bun run dev`
- API 서버만: `bun run server` (포트 3002)
- 테스트: `bun run test` (vitest run). 감시 모드는 `bun run test:watch`.
- 린트: `bun run lint`
- 빌드/타입 검사: `bun run build` (`tsc -b && vite build`)
- 변경 후 완료 보고 전에 `bun run test`, `bun run lint`, `bun run build`를 실행한다.

## Golden Rules

### Immutable

- API 키 값을 클라이언트로 내려보내지 않는다. `/api/config`는 키 존재 여부(boolean)만 반환한다. 근거: `server/index.ts:147-157`.
- API 키를 코드에 하드코딩하거나 로그로 출력하지 않는다. 서버 키는 `process.env`에서만 읽는다 (`server/index.ts:59-62`). `.env`는 커밋하지 않는다 (`.gitignore`).
- Google 호출 URL에 키가 쿼리스트링으로 포함된다 (`server/index.ts:99`). 이 URL을 에러 메시지·로그·응답에 넣지 않는다. 현재 에러는 상태 코드만 노출한다 (`server/index.ts:112`).

### Hard Constraints

- 미리보기는 react-live `noInline` 모드다 (`src/components/LivePreview.tsx:11`). 생성 코드에는 `render(<Component />)` 호출이 반드시 있어야 하고, import 문과 TypeScript 문법은 쓸 수 없다. 이 제약은 `SYSTEM_PROMPT`에 명시돼 있다 (`server/index.ts:11,12,20`). 프롬프트를 수정할 때 이 규칙을 지운다면 미리보기가 깨진다.
- 서버 포트 3002는 `server/index.ts:139`와 `vite.config.ts:11`(프록시)에 각각 적혀 있다. 한쪽만 바꾸지 않는다.

### Double Defense (한쪽만 제거 금지)

- `render()` 호출 보장은 두 곳에서 한다: 프롬프트 지시(`server/index.ts:12`)와 서버 후처리 `ensureRenderCall`(`server/generator.ts:16`, 호출부 `server/index.ts:188`). 모델이 지시를 어겨도 미리보기가 동작하도록 둘 다 유지한다.
- API 키 확인은 클라이언트(`src/App.tsx:34`)와 서버(`server/index.ts:169`) 양쪽에 있다.

### Asymmetry

- 모델 폴백(`withModelFallback`)과 `MAX_TOKENS` 잘림 감지는 Google 경로에만 있다 (`server/index.ts:123,134-136`). Anthropic 경로(`callAnthropic`)에는 없다. 새 프로바이더나 모델을 추가할 때 두 처리를 의도적으로 포함할지 결정한다.
- 503/429 응답 매핑은 에러 메시지 문자열에 상태 코드가 포함되는 것에 의존한다 (`server/index.ts:194,201`). 새 호출 함수의 에러 메시지는 `... API error: <status>` 형식을 유지한다.

### Test Boundary

- 테스트가 있는 곳: `server/generator.ts`, `server/fallback.ts`, `src/components/PromptInput.tsx`. 테스트가 없는 곳: `server/index.ts`, `src/App.tsx`, `src/hooks/useComponentGenerator.ts`, `LivePreview`, `CodeView`, `ComponentCard`.
- 테스트 가능한 로직은 `server/index.ts`가 아니라 부수효과 없는 순수 모듈에 둔다 (`server/generator.ts:1-2`). `server/index.ts`는 import 시 `Bun.serve`가 실행된다 (`server/index.ts:138`).

## Project Context

- AI로 React 컴포넌트를 생성하고 실시간 미리보기와 코드를 보여주는 도구.
- Stack: React 19, TypeScript, Vite, react-live, Bun, vitest, Testing Library.

## Context Map

- **[프론트엔드 수정 (React/react-live)](./src/AGENTS.md)** — 컴포넌트, 훅, 미리보기, 클라이언트 테스트 작업 시.
- **[API 서버 수정 (Bun)](./server/AGENTS.md)** — 프로바이더 호출, 프롬프트, 응답 정규화, 서버 테스트 작업 시.

## Standards & References

- 프로젝트 소개·실행 방법은 [README.md](./README.md)를 따른다. 여기에 반복하지 않는다.
- 커밋 메시지: 한국어, `<type>: <요약>` 형식. type은 `feat`, `fix`, `refactor`, `chore`. 요약은 명사형, 마침표 없음. 상세는 `.claude/skills/commit/SKILL.md`.
- PR 템플릿 언어: `ko`. `create-pr` 스킬은 `.claude/skills/create-pr/references/pr-template.ko.md`를 사용한다.
- `git push`는 요청받았을 때만 수행한다.
- Maintenance Policy: 이 파일의 규칙과 코드가 어긋나면(줄 번호 이동, 포트 변경, 새 프로바이더 추가 등) 작업 중 발견 즉시 AGENTS.md 업데이트를 제안한다.
