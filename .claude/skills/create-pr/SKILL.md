---
name: create-pr
description: |
  현재 브랜치의 커밋과 diff를 분석해 템플릿에 맞는 한국어 PR 본문을 작성하고 GitHub Pull Request를 생성한다.
  "PR 만들어줘", "PR 생성", "풀 리퀘스트 올려줘", "create pr", "open a pull request", "/create-pr" 같은 요청에 활성화한다.
  커밋은 이미 끝났고 브랜치를 리뷰에 올리려는 상황이면 사용자가 "PR"이라는 단어를 쓰지 않아도 사용한다.
context: fork
allowed-tools: Read Glob Grep Bash
---

# create-pr: 현재 브랜치로 Pull Request 생성

현재 브랜치가 기본 브랜치 대비 무엇을 바꿨는지 분석하고, `references/pr-template.md` 형식의 본문으로 PR을 만든다. 이 스킬은 분리된 컨텍스트(fork)에서 실행되므로 사용자에게 되물을 수 없다. 판단이 필요한 지점에서 멈춰야 하면 이유와 필요한 조치를 최종 보고에 적고 끝낸다. 추측으로 진행하지 않는다.

## 워크플로우

### Step 1: 사전 확인

```bash
git rev-parse --is-inside-work-tree
gh auth status
git branch --show-current
git status --short
```

- git 저장소가 아니거나 `gh` 인증이 안 되어 있으면 중단하고 원인을 보고한다.
- 저장소 루트의 `AGENTS.md`(없으면 `CLAUDE.md`)에 PR·브랜치 관련 지침이 있으면 읽고 이 스킬보다 우선한다.
- 현재 브랜치가 기본 브랜치(`main`/`master`)면 중단한다. 사용자의 브랜치를 대신 만들지 않는다. "기능 브랜치를 만든 뒤 다시 실행해 달라"고 보고한다.
- 커밋되지 않은 변경이 있으면 PR에 포함되지 않는다. 중단하지 말고 최종 보고에 "미커밋 변경 N개는 PR에 포함되지 않음"을 적는다.

### Step 2: 기준 브랜치와 변경 범위 파악

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
git fetch origin <base> 2>&1
git log --oneline origin/<base>..HEAD
git diff --stat origin/<base>...HEAD
```

- `<base>`는 위 명령으로 얻은 기본 브랜치다. 사용자가 다른 base를 지정했으면 그것을 쓴다.
- `origin/<base>..HEAD`에 커밋이 없으면 PR을 만들 수 없다. 중단하고 보고한다.
- 이미 열린 PR이 있는지 확인한다: `gh pr list --head <현재 브랜치> --state open --json url`. 있으면 새로 만들지 말고 그 URL을 보고한다.
- 커밋 메시지만 보고 판단하지 않는다. diff가 크면 파일별로 나눠 읽고 실제 변경 의도를 파악한다.
- `.env`, 키·토큰이 diff에 보이면 PR을 만들지 않고 중단해 보고한다. 공개 저장소일 수 있어 한번 올라가면 되돌리기 어렵다.

### Step 3: 제목과 본문 작성

1. 템플릿 언어를 정한다. `AGENTS.md`(없으면 `CLAUDE.md`)에 PR 템플릿 언어 지정이 있으면 그것을 따르고, 없으면 `ko`를 쓴다. 이 프로젝트는 `ko`다. 언어별 파일은 다음과 같다.
   - `ko`: `references/pr-template.ko.md`
   - `en`: `references/pr-template.en.md`
2. 고른 템플릿을 읽고, 섹션 구조와 순서를 그대로 따른다. PR 제목과 본문 전체를 그 템플릿의 언어로 쓴다. 섹션 제목만 바꾸고 내용은 다른 언어로 쓰지 않는다.
3. 템플릿의 각 섹션을 diff에서 확인한 사실로 채운다. 확인할 수 없는 내용은 지어내지 않고 "해당 없음"(en: "N/A")이라고 쓴다.
4. 테스트·린트·빌드 항목은 직접 실행해서 확인한 결과만 체크한다. 실행하지 않았으면 체크하지 않고 "미실행"(en: "Not run")으로 적는다. 명령은 `AGENTS.md`의 Operational Commands를 따른다.
5. 제목은 한 줄, 70자 이내, 마침표 없음. 커밋과 같은 `<type>: <요약>` 형식을 쓰고 요약은 선택한 언어로 쓴다(ko는 명사형). 커밋이 1개면 그 메시지를 기반으로 하고, 여러 개면 전체를 아우르는 목적을 쓴다.
6. 본문 마지막에 시스템 지침이 지정한 PR attribution 줄이 있으면 그대로 붙이고, 지정이 없으면 붙이지 않는다.

### Step 4: 푸시와 PR 생성

사용자가 PR 생성을 요청했으므로 현재 브랜치 푸시까지는 이 요청의 범위다.

```bash
git push -u origin HEAD
gh pr create --base <base> --title "<제목>" --body-file <본문 파일>
```

- 본문은 임시 파일에 써서 `--body-file`로 넘긴다. 줄바꿈과 백틱이 셸에서 깨지는 것을 막는다. 임시 파일은 저장소 밖(예: `$TMPDIR`)에 만들고 끝나면 지운다.
- 푸시가 거부되면(`--force`가 필요한 경우 포함) 강제로 밀지 않는다. 원인을 보고하고 끝낸다.
- 사용자가 지정하지 않았다면 draft, 리뷰어, 라벨은 설정하지 않는다.

### Step 5: 최종 보고

메인 대화로 돌아가는 유일한 출력이다. 다음을 간결하게 한국어로 쓴다.

- PR URL
- 제목과 base 브랜치, 포함된 커밋 수
- 본문에서 "미실행"·"해당 없음"으로 남긴 항목
- 중단했거나 건너뛴 단계가 있으면 그 이유와 사용자가 해야 할 일

## 하지 않는 것

- `main`/`master`에서 PR 생성, 브랜치 임의 생성
- `--force` 푸시, 기존 커밋 수정(`--amend`, rebase)
- PR 머지, 닫기, 기존 PR 본문 덮어쓰기
- 실행하지 않은 검증을 통과했다고 쓰는 것
