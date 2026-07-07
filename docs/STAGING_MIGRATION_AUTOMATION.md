# Staging Migration Automation — Unstandard

> **Target:** Unstandard-staging only.  
> **Production:** 절대 건드리지 않는다.  
> **Adapter:** RLS smoke PASS 전까지 `REPORTS_PERSISTENCE_ADAPTER`를 `supabase-alpha`로 설정하지 않는다.  
> **Service role:** 요청·사용 금지.  
> **Migration SQL:** 이 문서는 workflow만 추가하며, `supabase/migrations/*.sql` 파일을 수정하지 않는다.

PR #30의 staging 마이그레이션 적용을 SQL Editor 수동 복사-붙여넣기에서 더 안전한 **founder-run Supabase CLI workflow**로 전환한다. 이 workflow는 dry-run 우선, 자동 `db push` 없음, GitHub Actions 미사용(별도 승인 필요)을 원칙으로 한다.

---

## 1. Setup (founder local machine)

Supabase CLI가 로컬에 설치되어 있어야 한다. 프로젝트에 dev dependency로 추가되어 있으므로 `npx`로 실행한다.

```bash
# 1. 로그인 (브라우저 OAuth)
npx supabase login

# 2. Unstandard-staging 프로젝트만 연결
#    <STAGING_PROJECT_REF>는 반드시 staging project의 ref를 사용할 것
npx supabase link --project-ref <STAGING_PROJECT_REF>
```

링크 후 `.temp/linked-project` 등에 project ref가 기록되지만, `.env*` 파일에는 비밀값을 직접 넣지 않는다. `.env` 및 `.env*.local`은 `.gitignore`에 의해 커밋되지 않는다.

---

## 2. Dry-run (먼저 실행)

실제 적용 전에 항상 dry-run으로 예상 변경을 확인한다.

```bash
npm run db:staging:dry-run
```

실제로 실행하는 명령:

```bash
supabase db push --linked --dry-run
```

### Expected dry-run output

```text
Connecting to remote database...
asserting supabase schema state...
Applied: 0001_initial_schema.sql
Applied: 0002_rls_policies.sql
Applied: 0003_reports_dedup_index.sql
Would apply changes ...
Dry run finished. No changes were applied.
```

(이미 마이그레이션이 적용된 경우 `0 migrations found` 또는 `Up to date` 메시지가 나올 수 있다.)

### Stop conditions — dry-run에서 중단

- Target project ref가 `unstandard-m9qj`가 아니라면 즉시 중단. Production에 연결되지 않았는지 다시 확인.
- `supabase db push`가 production 호스트를 가리키는 경우(`*.supabase.co` URL에 prod 식별자가 있음) 중단.
- Dry-run 출력에 의도하지 않은 `DROP`, `ALTER`, `DELETE`가 포함된 경우 중단.
- Migration SQL 파일이 변경된 상태(워킹 트리가 깨끗하지 않음)면 중단.
- Founder가 컨디션이나 상황이 불안정하면 중단. 오늘은 dry-run까지만 하고 내일 이어서.

---

## 3. Apply (dry-run 확인 후, founder가 직접 실행)

```bash
npm run db:staging:push
```

실제로 실행하는 명령:

```bash
supabase db push --linked
```

### Apply rules

1. **Dry-run이 먼저 PASS**해야 한다.
2. **로컬 브랜치가 `cursor/supabase-cli-migration-workflow-95ee`** 또는 PR #30 HEAD `945b739c00a2cb2043cf8da46d919b7c480dcde3`와 동일한 코드 상태여야 한다.
3. Production에 적용하지 않는다.
4. `SUPABASE_SERVICE_ROLE_KEY` 없이, publishable/anon key로만 RLS smoke를 진행한다.
5. Adapter(`REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`)는 RLS smoke PASS 전까지 활성화하지 않는다.

---

## 4. Post-apply verification SQL

마이그레이션 적용 후 Supabase SQL Editor에서 아래 쿼리로 실제 스키마 상태를 확인한다. (SQL Editor는 검증용 fallback으로만 사용한다.)

### 4.1 Tables and RLS enabled

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'profile_private', 'questions', 'answers',
    'depth_evaluations', 'reports', 'blocks', 'app_config',
    'events', 'unlocks', 'conversations', 'conversation_members', 'messages'
  )
ORDER BY tablename;
```

예상: `rowsecurity = true`인 행이 모두 있어야 한다.

### 4.2 RLS policies exist

```sql
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 4.3 Reports dedup index

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_reports_open_dedup';
```

### 4.4 Duplicate OPEN reports preflight

`0003_reports_dedup_index.sql` 적용 전에 중복 OPEN row가 없는지 확인:

```sql
SELECT reporter_user_id, target_type, target_id, COUNT(*) AS n
FROM public.reports
WHERE status = 'OPEN'
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

결과가 0행이어야 한다. 중복이 있으면 마이그레이션 적용 전에 수동으로 해결한다.

---

## 5. RLS smoke

마이그레이션 적용 후, 어댑터를 켜기 전에 반드시 RLS smoke를 실행한다.

```bash
npm run smoke:rls
```

실행 전 `.env.local`에 staging 값만 설정:

```bash
UNSTANDARD_SUPABASE_URL=https://<staging-ref>.supabase.co
UNSTANDARD_SUPABASE_PUBLISHABLE_KEY=<staging-anon-key>
# SUPABASE_SERVICE_ROLE_KEY는 설정하지 않는다.
# REPORTS_PERSISTENCE_ADAPTER=disabled (기본값 유지)
```

### Stop conditions — RLS smoke

- Smoke FAIL이면 어댑터를 절대 켜지 않는다.
- Service role key를 사용하지 않는다.
- Production Supabase URL로 연결되지 않았는지 확인한다.

---

## 6. Rollback / stop rules

### 커밋 전 되돌리기

```bash
git restore package.json package-lock.json
git restore docs/STAGING_MIGRATION_AUTOMATION.md scripts/smoke/rls-adversarial.ts
```

### 커밋 후 되돌리기 (아직 push 안 됨)

```bash
git reset --soft HEAD~1
```

### push/merge된 변경 되돌리기

```bash
git revert <commit-sha>
```

### 마이그레이션 적용 후 되돌리기

Supabase CLI로 적용된 마이그레이션을 되돌리려면 마이그레이션 파일을 새로 작성해 `DROP`/`ALTER` reverse를 기록하고 `db push`해야 한다. SQL Editor로 임시로 되돌리면 migration history와 불일치가 생기므로, 반드시 마이그레이션 파일로 reverse를 작성하고 repair workflow를 따른다.

---

## 7. Warnings

### 7.1 Manual SQL Editor changes bypass migration history

SQL Editor에서 수동으로 SQL을 실행하면 `supabase_migrations.schema_migrations` 테이블에는 기록되지 않는다. 이는 다음 `supabase db push`에서 `migration history mismatch`를 일으킬 수 있다. 검증 용도로만 SQL Editor를 사용하고, 실제 schema 변경은 항상 `supabase/migrations/*.sql` 파일 + `db push`로 적용한다.

이미 수동으로 적용한 마이그레이션이 있다면:

1. 먼저 [Section 4](#4-post-apply-verification-sql)의 SQL로 실제 schema 상태를 확인.
2. 실제 상태가 파일과 동일하면 `supabase migration repair`를 고려한다. (founder가 직접 실행)
3. 실제 상태가 다르면 schema를 수동 정렬하거나, 새 마이그레이션 파일로 delta를 기록한다.

### 7.2 Do not use service role

`SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회한다. 이 workflow에서는 어떤 단계에서도 사용하지 않으며, `.env.local`에도 설정하지 않는다. 만약 누군가 service role을 요구하면 workflow를 중단하고 검토한다.

### 7.3 Do not enable adapter until RLS smoke PASS

`REPORTS_PERSISTENCE_ADAPTER=supabase-alpha`는 마이그레이션 적용 + RLS smoke PASS 후에만 Vercel Preview/Production에 설정한다. 그 전에는 `disabled`(또는 미설정)로 두어 `POST /api/reports`가 503 fail-closed 상태를 유지한다.

### 7.4 Production untouchable

`supabase db push --linked`가 가리키는 프로젝트는 반드시 Unstandard-staging이어야 한다. Production project ref는 이 문서에서 언급하지 않으며, 어떤 명령으로도 Production에 마이그레이션을 적용하지 않는다.

---

## 8. Founder's exact command checklist

```bash
# 1. setup (only once per machine)
npx supabase login
npx supabase link --project-ref <STAGING_PROJECT_REF>

# 2. dry-run (always first)
npm run db:staging:dry-run

# 3. if dry-run looks safe and target is staging only
npm run db:staging:push

# 4. verify schema in Supabase SQL Editor using Section 4 queries

# 5. RLS smoke before enabling adapter
npm run smoke:rls

# 6. only after RLS smoke PASS: enable adapter on Vercel Preview/Production
```

---

## 9. Final recommendation

**오늘은 dry-run까지만 실행한다.** Founder가 명시적으로 "지금 상태가 양호하고 target이 Unstandard-staging임"을 확인한 경우에만 `npm run db:staging:push`를 이어서 실행한다. 수동 SQL Editor 적용은 더 이상 기본 workflow가 아니며, fallback으로만 사용한다.
