# GIT RECOVERY LOG

레포 안전/복구 관련 의사결정과 기록. 파괴적 명령은 마지막 수단이며, 사용 시 반드시 사유와 손실 범위를 여기에 남깁니다.

## 안전 원칙

- 파괴적 명령(`git reset --hard`, `git clean -fd`, `git push --force`, 브랜치 삭제, 히스토리 재작성)은 **명시적 승인 없이는 금지**.
- 되돌리기는 비파괴 우선: `git revert <sha>` (새 커밋으로 변경 취소).
- `main` 직접 커밋 금지. 작업은 기능 브랜치에서.
- 1 브랜치 = 1 에이전트. 여러 브랜치가 같은 파일을 동시에 수정하면 머지 충돌/작업 유실 위험.

## 기록

### 2026-06-22 — 잘못된 GitHub Actions 스타터 워크플로 제거

- 문제: `main`에 `webpack.yml`(`npx webpack`), `deno.yml`(`deno lint/test`) — Next.js/npm 프로젝트에 맞지 않아 CI 실패.
- 조치: PR #2 (`cursor/setup-dev-environment-baa4`)에서 `webpack.yml` → `ci.yml`로 교체, `deno.yml` 삭제. **비파괴**(브랜치의 일반 커밋). `main`은 PR #2 머지 시 정상화됨.
- 손실: 없음(스타터 템플릿 파일은 이 프로젝트에서 사용되지 않음).

### 2026-06-22 — 동시 진행 브랜치 충돌 주의 (미해결, 사람 결정 필요)

다음 원격 브랜치들이 같은 파일을 건드려 머지 순서를 사람이 정해야 함:

- `cursor/docs-agents-guide-and-readme-fix-cd9a` → `AGENTS.md`, `README.md`
- `cursor/initial-nextjs-scaffold-a5d4` → `package-lock.json`, 신규 페이지
- `cursor/setup-dev-environment-baa4` (PR #2, 본 작업) → `AGENTS.md`, `README.md`, `package-lock.json`, CI

권장 순서: PR #2를 먼저 머지해 `main` CI를 복구한 뒤, 나머지 브랜치는 `AGENTS.md`/`package-lock.json` 충돌을 수동 조율. (자동 머지/force 금지.)

### 2026-06-22 — PR #2 머지 + 중복/stale 브랜치 정리

- PR #2 (`cursor/setup-dev-environment-baa4`) **머지 완료** → `main` 워크플로 = `ci.yml`만. 깨진 `webpack.yml`/`deno.yml` 제거됨.
- `dev` → `main`으로 **fast-forward**(작업 손실 0). `dev`도 `ci.yml`만.
- PR #3 (`feat/initial-nextjs-web`) = 중복 앱(`unstandard-web/`)이라 **닫음**(머지 안 함).
- 삭제한 원격 브랜치(복구용 SHA):
  | 브랜치 | 사유 | 삭제 전 SHA |
  |---|---|---|
  | `cursor/setup-dev-environment-baa4` | PR #2 머지됨 | `b559c8447ccf230fc9479a2abc058323623125bb` |
  | `feat/initial-nextjs-web` | PR #3 닫힘(중복 앱) | `d780f667d5861b240888f06e2325ec3cc5d4c5ba` |
  | `codex/implement-frontend-vertical-slice-for-unstandard` | PR #1 머지됨 | `ba9a9dd286b8ebcffab4919c1509e875ce76e93e` |
  | `feat/initial-nextjs-web-app` | 옛 main과 동일(고유 작업 0) | `9505e5e2e70f9ab32ea0f6e0199b8ca16d54acda` |
- 복구: `git push origin <SHA>:refs/heads/<원래이름>`.

### 2026-06-22 — AGENTS 문서 회수 + 잔여 브랜치 정리 (chore/harvest-agent-docs-and-prune-stale-branches)

- `cursor/docs-agents-guide-and-readme-fix-cd9a`의 AGENTS.md에서 **AI 에이전트 운영/작업 규칙 + Git 안전(롤백)만 선별**해 `AGENTS.md`에 반영. README/워크플로/`deno.yml`/`webpack.yml`/app_config 상수/제품 가드레일은 **가져오지 않음**(범위 밖 또는 main이 최신).
- 회수 후 삭제한 원격 브랜치(복구용 SHA, 본 PR 검증 통과 후 삭제):
  | 브랜치 | 사유 | 삭제 전 SHA |
  |---|---|---|
  | `cursor/initial-nextjs-scaffold-a5d4` | 버려진 평행 스캐폴드(구조 충돌) | `2e492879cf40916369b9d97cb3dc015b3e7ee1b0` |
  | `cursor/docs-agents-guide-and-readme-fix-cd9a` | AGENTS 내용 회수 완료 | `2f842d80a252761fd25fea3bc275b40573fcb9ae` |
- 복구: `git push origin <SHA>:refs/heads/<원래이름>`.

## 복구 치트시트 (비파괴)

```bash
# 직전 커밋 취소하되 변경은 유지
git reset --soft HEAD~1

# 특정 커밋을 새 커밋으로 되돌리기 (권장)
git revert <sha>

# 원격 상태 확인
git fetch origin
git log --oneline --graph -20
```
