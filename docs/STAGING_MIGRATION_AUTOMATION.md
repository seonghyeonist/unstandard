# Staging Migration Automation — Unstandard-staging only

> **목적:** PR #30 (`cursor/supabase-cli-migration-workflow-4a8d`) 스테이징 마이그레이션을 SQL Editor 복사/붙여넣기에서 **founder가 직접 실행하는 Supabase CLI dry-run → apply → verify** 워크플로우로 전환한다.  
> **타깃:** `Unstandard-staging` Supabase project **단 하나** — Production은 절대 건드리지 않는다.  
> **현재 상태:** 마이그레이션 파일은 이미 repo에 있다(`supabase/migrations/0001~0003`). 이 문서는 실행 절차만 추가한다.

---

## 1. Target lock

| 항목 | 값 |
|------|-----|
| 대상 | `Unstandard-staging` Supabase project only |
| Production | ❌ untouchable — 어떤 명령도 Production project ref를 받지 않는다 |
| Adapter | ❌ `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha` 등 어떤 adapter도 비활성 상태로 둔다 |
| Service role | ❌ `SUPABASE_SERVICE_ROLE_KEY` 없이, publishable/anon key만으로 CLI 인증 |
| GitHub Actions | ❌ 아직 자동화하지 않음 — 본 워크플로우는 **local founder workstation**에서만 실행 |

---

## 2. 왜 SQL Editor 복사/붙여넣기보다 안전한가

| SQL Editor 수동 | Supabase CLI `db push --linked` |
|-----------------|----------------------------------|
| 마이그레션 실행 기록이 없어서 누가, 언제, 어떤 SQL을 실행했는지 추적 불가 | `supabase_migrations.schema_migrations` 테이블에 버전과 해시 기록 |
| 실수로 Production project에 붙여넣기 가능 | `--linked`는 사전에 `npx supabase link --project-ref <STAGING>`로 묶인 단일 project만 대상 |
| `CREATE`/`DROP` 전체가 즉시 실행 — 사전 확인 없음 | `npm run db:staging:dry-run`으로 실제 apply 전 실행 계획 확인 |
| 동시 편집, 해시/줄바꿈 차이로 결과 불일치 | repo의 `.sql` 파일을 그대로 실행하므로 Git SHA 기준 reproducible |
| 수동 SQL Editor로 이미 적용한 경우 마이그레션 히스토리가 꼬임 | `supabase migration repair` 등으로 히스토리 복구 가능, 단 실제 스키마 확인 후 |

---

## 3. Prerequisites

- Node.js 20.x / 22.x
- `npm ci`로 의존성 설치 완료 (`supabase` CLI는 `devDependencies`에 포함됨)
- 브라우저에서 Supabase dashboard에 로그인 가능한 계정
- `Unstandard-staging` project ref (`<project-ref>`)

> **오늘의 규칙:** 이 문서를 읽는 사람이 컨디션이 좋지 않거나, 대상이 `Unstandard-staging`이 아닌 것이 의심되면 **dry-run 이후 중단**한다. 본인 건강이 먼저다.

---

## 4. Setup (founder workstation, 한 번만)

```bash
# 1. Supabase CLI를 npm registry가 아닌 본인 Supabase 계정으로 인증
npx supabase login

# 2. 로컬 작업 디렉터리를 Unstandard-staging에만 연결
#    project-ref는 Supabase dashboard → Project Settings → General → Reference ID에서 확인
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

- 위 명령은 `supabase/config.toml`에 `project_id`를 기록하고, `.temp/`에 로컬 인증 토큰을 캐시한다.
- `.gitignore`에 `supabase/config.toml`과 `supabase/.temp/`가 이미 등록되어 있어 실수로 커밋되지 않는다.
- `.env`나 `SUPABASE_SERVICE_ROLE_KEY`는 입력하지 않는다. CLI 인증은 `npx supabase login`의 personal access token으로 한다.

---

## 5. Dry-run (오늘 여기까지 실행하고 멈춘다)

```bash
npm run db:staging:dry-run
```

실제로 실행하는 명령:

```bash
npx supabase db push --linked --dry-run
```

### 기대되는 출력 패턴

```text
Linked project: <STAGING_PROJECT_REF>
Connecting to remote database...
Local migrations: 0001_initial_schema, 0002_rls_policies, 0003_reports_dedup_index
Remote migrations: (none or already applied list)
Dry-run: would apply 0001_initial_schema.sql
Dry-run: would apply 0002_rls_policies.sql
Dry-run: would apply 0003_reports_dedup_index.sql

Would apply 3 migrations. No changes made.
```

> **실제 출력 형식은 CLI 버전에 따라 다르다.** 핵심은 `Dry-run` 또는 `No changes made` 문구, 그리고 **적용 대상이 `Unstandard-staging`인지** 확인하는 것이다.

### Dry-run에서 확인할 것

- [ ] 출력 상단의 linked project가 `Unstandard-staging` ref인지 다시 확인
- [ ] `0001_initial_schema`, `0002_rls_policies`, `0003_reports_dedup_index`만 포함되어 있는지 확인
- [ ] Production이나 다른 project 이름이 보이면 **즉시 Ctrl+C** 후 `npx supabase link`를 재검증
- [ ] `already applied` 메시지가 뜨면 [9. 마이그레이션 히스토리 불일치](#9-마이그레이션-히스토리-불일치)를 본다

---

## 6. Apply (dry-run 확인 후, 명시적 승인 시에만)

> **오늘은 apply 하지 않는다.** dry-run 결과를 PR 코멘트에 붙이고 멈춘다.  
> founder가 "건강하게 확인했고 대상이 Unstandard-staging"이라고 **서면/채널에서 명시적으로 승인**한 경우에만 다음 단계 진행.

```bash
npm run db:staging:push
```

실제 명령:

```bash
npx supabase db push --linked
```

Apply 중 주의:

- 터미널이 어떤 prompt를 띄우면 먼저 멈추고 메시지를 읽는다.
- `--yes`는 절대 사용하지 않는다. 기본 스크립트에도 포함되지 않는다.
- Apply가 실패하면 다음 단계로 넘어가지 않고 로그를 저장한다.

---

## 7. Post-apply verification SQL

Apply 직후 Supabase dashboard → SQL Editor에서 아래 쿼리를 실행하거나, `psql`/`supabase sql`로 실행한다. **조회만 하는 쿼리**이며 데이터를 변경하지 않는다.

```sql
-- 7-1. 대상 테이블과 RLS 활성화 여부
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
ORDER BY tablename;

-- 7-2. RLS 정책 목록
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7-3. 마이그레이션 히스토리 기록
SELECT version, name, statement_hash
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 7-4. reports dedup index (0003 마이그레이션)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'reports'
  AND indexname = 'idx_reports_open_dedup';
```

### 기대 결과

- `pg_tables`에서 모든 테이블이 존재하고, 민감 테이블의 `rowsecurity` = `t`.
- `pg_policies`에 `0002_rls_policies.sql`에 정의된 정책이 존재.
- `supabase_migrations.schema_migrations`에 `0001_initial_schema`, `0002_rls_policies`, `0003_reports_dedup_index` 버전이 기록.
- `idx_reports_open_dedup` 인덱스가 존재.

---

## 8. RLS smoke command

```bash
npm run smoke:rls
```

실제 명령:

```bash
npx tsx scripts/smoke/rls-adversarial.ts
```

> **주의:** `scripts/smoke/rls-adversarial.ts`는 **PR #35** (`cursor/rls-adversarial-smoke-2aa9`)에서 제공되며, 아직 본 브랜치에 머지되지 않았다.  
> PR #35가 머지되기 전에는 `npm run smoke:rls`가 `ENOENT`로 실패한다. **오늘은 이 명령을 실행하지 않는다.**  
> RLS smoke가 PASS할 때까지 `REPORTS_PERSISTENCE_ADAPTER`는 `disabled` 또는 unset으로 유지한다.

---

## 9. Stop conditions (멈추는 조건)

다음 중 하나라도 해당되면 **즉시 중단**하고 `#migrations` 채널/PR에 상황을 보고한다.

1. `npx supabase login` 또는 `npx supabase link`가 실패함
2. Dry-run 출력에서 project ref가 `Unstandard-staging`이 아님
3. Dry-run에 `0001~0003` 외의 마이그레이션이 포함됨
4. Dry-run에 이미 존재하는 객체 오류(`relation ... already exists`, `index ... already exists`)가 발생 — SQL Editor로 이미 수동 적용되었을 수 있음
5. Founder가 피곤하거나 몸이 안 좋음
6. 대상이 Production이라는 의심이 들음
7. `SUPABASE_SERVICE_ROLE_KEY`를 요구하는 상황이 발생함
8. 누군가 `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`를 켜자고 제안함
9. RLS smoke가 PASS하지 않았는데 adapter를 켜자고 제안함

---

## 10. Rollback / undo

| 상황 | 조치 |
|------|------|
| **Apply 직전 마음이 바뀜** | 그냥 터미널을 닫거나 `Ctrl+C`. dry-run은 아무것도 변경하지 않는다. |
| **Apply 후 RLS smoke 실패** | `REPORTS_PERSISTENCE_ADAPTER`를 `disabled`로 되돌리고, 스키마를 복구하기 전에 먼저 원인 분석. 본 문서의 SQL로 상태를 점검. |
| **Apply 후 잘못된 것을 발견** | 다음 마이그레이션으로 롤포워드하는 것이 권장. 긴급한 경우에만 reverse SQL을 수동으로 작성하고 동일한 dry-run/apply 절차로 실행. |
| **로컬 커밋 전 되돌리기** | `git restore .` |
| **이미 push된 커밋 되돌리기** | `git revert <sha>` (공유 브랜치에서 `--hard` 금지) |
| **SQL Editor로 이미 수동 적용한 후 히스토리 불일치** | [11. 마이그레이션 히스토리 불일치](#11-마이그레이션-히스토리-불일치) 절차 |

---

## 11. 마이그레이션 히스토리 불일치

과거 SQL Editor로 수동 실행한 경우, `supabase_migrations.schema_migrations` 테이블에 기록이 없어 `supabase db push`가 이미 존재하는 객체를 다시 만들려고 할 수 있다. 이 상태에서는 **apply를 자동으로 진행하지 않는다**.

### 절차

1. `supabase db push --linked --dry-run` 오류 메시지를 저장한다.
2. Supabase dashboard → SQL Editor에서 [7. Post-apply verification SQL](#7-post-apply-verification-sql)을 실행해 실제 스키마가 로컬 마이그레이션 파일과 일치하는지 수동으로 확인한다.
3. 스키마가 일치하면 마이그레이션 히스토리만 복구한다:

   ```bash
   # 예시 — 실제 버전은 dry-run/마이그레이션 파일명에서 확인
   npx supabase migration repair --linked --status applied 0001_initial_schema
   npx supabase migration repair --linked --status applied 0002_rls_policies
   npx supabase migration repair --linked --status applied 0003_reports_dedup_index
   ```

4. 복구 후 다시 `npm run db:staging:dry-run`으로 히스토리가 정렬되었는지 확인한다.
5. 스키마가 불일치하면 SQL Editor로 수동 조정한 것과 마이그레이션 파일의 차이를 문서화하고, **차이를 해소하는 새 마이그레이션 또는 수동 보정**을 한 뒤에 dry-run을 다시 실행한다.

> **원칙:** `repair`는 스키마가 이미 올바를 때만 히스토리를 맞추는 도구. 실제 스키마를 확인하지 않고 `repair`를 실행하면 더 큰 불일치를 만들 수 있다.

---

## 12. Manual SQL Editor fallback

Supabase CLI workflow가 불가능한 경우에만 SQL Editor를 fallback으로 사용한다. 단, 다음 규칙을 따른다.

1. 동일한 `.sql` 파일을 그대로 실행한다. — 편집하지 않는다.
2. 실행 전/후 SQL Editor에서 [7. Post-apply verification SQL](#7-post-apply-verification-sql)을 실행한다.
3. 실행 후 마이그레이션 히스토리를 복구해야 하므로 [11. 마이그레이션 히스토리 불일치](#11-마이그레이션-히스토리-불일치) 절차를 반드시 따른다.
4. SQL Editor는 **미래의 기본 방식이 아니다**. 긴급 fallback일 때만 사용.

---

## 13. Warnings

### 서비스 롤 사용 금지

- `SUPABASE_SERVICE_ROLE_KEY`를 요구하지 않는다. `npx supabase login`은 개인 access token이고, `db push`는 마이그레이션 실행에 필요한 DB 연결 정보를 CLI가 내부적으로 관리한다.
- 서비스 롤은 admin/report/adapter 코드에서만 사용하며, 그것도 별도 보안 승인 후.

### Adapter 활성화 금지

- 마이그레이션 + RLS smoke가 모두 PASS할 때까지 `REPORTS_PERSISTENCE_ADAPTER`는 `disabled` 또는 unset으로 유지한다.
- `REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`를 설정하면 fail-closed 상태가 풀리므로, 이 문서의 절차 완료 전에는 절대 켜지 않는다.

### Production 금지

- `npx supabase link`에 Production project ref를 넣지 않는다.
- `npm run db:staging:*` 스크립트 이름에 `staging`이 붙어 있음을 다시 확인.
- 실수로 Production에 link한 것 같으면 `supabase/config.toml`을 삭제하고 staging으로 다시 link한다.

---

## 14. Today’s rule

**오늘은 `npm run db:staging:dry-run`까지만 실행하고 멈춘다.**

Apply(`npm run db:staging:push`)는 다음 조건을 **모두** 충족했을 때만 다음 세션에서 진행한다.

1. founder가 건강하고 집중할 수 있는 상태
2. 대상이 확실히 `Unstandard-staging` project ref
3. dry-run 결과를 PR 또는 `#migrations` 채널에 공유하고 리뷰 완료
4. RLS smoke(PR #35)가 머지되어 smoke 명령이 실제로 실행 가능

오늘 밤은 더 이상 작업하지 않는다. 자러 가자.

---

## 15. Commands cheat sheet

| 단계 | 명령 |
|------|------|
| Setup — 인증 | `npx supabase login` |
| Setup — 연결 | `npx supabase link --project-ref <STAGING_PROJECT_REF>` |
| Dry-run | `npm run db:staging:dry-run` |
| Apply | `npm run db:staging:push` (dry-run 이후 명시적 승인 시) |
| RLS smoke | `npm run smoke:rls` (PR #35 머지 후) |
| 마이그레이션 히스토리 조회 | `npx supabase migration list --linked` |
| 히스토리 복구 | `npx supabase migration repair --linked --status applied <version>` |

---

## 16. Related docs

- [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) — env 이름과 초기 스키마/RLS 초안
- [`STAGING_LOGIN_SMOKE.md`](./STAGING_LOGIN_SMOKE.md) — P0-5 canonical staging 로그인 스모크
- [`ALPHA_READINESS_CHECKLIST.md`](./ALPHA_READINESS_CHECKLIST.md) — P0 alpha blocker 현황
