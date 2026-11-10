# src/AGENTS.md

## Module Context

Vite로 번들되는 React 19 프론트엔드. 프롬프트를 `/api/generate`로 보내고, 받은 코드를 react-live로 미리보기/코드 탭에 보여준다. AI API는 브라우저에서 직접 호출하지 않고 항상 서버 프록시를 거친다 (`hooks/useComponentGenerator.ts:23`).

## Tech Stack & Constraints

- `verbatimModuleSyntax`와 `erasableSyntaxOnly`가 켜져 있다 (`tsconfig.app.json`). 타입은 `import type`으로 가져오고 (`App.tsx:5`), `enum`, `namespace`, 생성자 파라미터 프로퍼티를 쓰지 않는다.
- `noUnusedLocals`, `noUnusedParameters`가 켜져 있어 미사용 변수는 빌드 실패다.
- 컴포넌트 파일은 컴포넌트만 export한다. `react-refresh/only-export-components` 규칙이 적용된다 (`eslint.config.js:18`). 상수·헬퍼를 같은 파일에서 export하지 않는다.
- 스타일은 `App.css`의 전역 클래스(`window`, `win-bar`, `win-title` 등)를 쓴다 (`App.tsx:74-77`, `ComponentCard.tsx:24-27`). 새 패널은 이 구조를 재사용한다.
- 사용자에게 보이는 문구와 aria-label은 한국어다.

## Implementation Patterns

- 컴포넌트는 `components/`에 `export function Name`(named export)으로 둔다. `App`만 default export다 (`App.tsx:203`).
- 서버 통신과 생성 결과 상태는 `hooks/useComponentGenerator.ts`에 모은다. 컴포넌트에서 `fetch('/api/generate')`를 직접 호출하지 않는다.
- 공용 타입은 `types/index.ts`에 둔다 (`Provider`, `GeneratedComponent`).
- 테스트는 대상 파일 옆에 `<Name>.test.tsx`로 둔다. 역할(role)과 접근 가능한 이름으로 요소를 찾는다 (`PromptInput.test.tsx:9`).

## Testing Strategy

- 실행: `bunx vitest run src` 또는 `bun run test`. 환경은 jsdom, 설정은 `test/setup.ts`.
- `test/setup.ts`가 테스트마다 `cleanup()`을 호출한다. 직접 호출을 추가하지 않는다.
- 사용자 동작은 `@testing-library/user-event`의 `userEvent.setup()`으로 재현한다.

## Local Golden Rules

- API 키·Provider·프롬프트 히스토리·생성 컴포넌트는 `useLocalStorageState`로 `localStorage`(`rcg:*` 키, `utils/storage.ts`)에 유지한다. 사용자 요청에 따라 API 키 저장을 허용한 것이므로, 키를 URL에 넣거나 `sessionStorage`/쿠키 등 다른 곳에 중복 저장하지 않는다. 프로바이더를 바꾸면 키를 비우는 동작도 유지한다 (`App.tsx` `handleProviderChange`). 키는 `/api/generate` 요청 본문으로만 전송한다 (`hooks/useComponentGenerator.ts:26`).
- `LiveProvider`에 `scope`를 넘기지 않는다 (`components/LivePreview.tsx:11`). AI가 생성한 코드가 앱 페이지 안에서 실행되므로, `apiKey` 등 앱 상태를 scope에 노출하면 생성 코드가 접근할 수 있다.
- 미리보기 새로고침은 `key={previewKey}`로 `LivePreview`를 리마운트해서 구현한다 (`ComponentCard.tsx:33,74`). 애니메이션 컴포넌트를 처음 상태로 되돌리는 방식이므로 다른 방식으로 바꾸지 않는다.
- 재생성도 `handleGenerate`를 거친다 (`App.tsx:193`). 키 확인이 재생성에도 적용되므로 `generate`를 직접 연결하지 않는다.
- 버튼 라벨(`컴포넌트 생성`, `생성 중...`)은 테스트가 이름으로 찾는다 (`PromptInput.test.tsx:9,18,27`). 문구를 바꾸면 테스트도 같이 수정한다.
- 테스트가 없는 영역: `App.tsx`, `useComponentGenerator`, `LivePreview`, `CodeView`, `ComponentCard`. 동작을 바꿀 때 `bun run build`와 `bun run dev`로 직접 확인하고, 가능하면 테스트를 함께 추가한다.
