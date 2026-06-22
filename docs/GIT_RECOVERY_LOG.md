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
