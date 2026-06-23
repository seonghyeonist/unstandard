# Supabase Setup — Unstandard (Foundation Only)

> **이 문서는 스키마/RLS 초안과 환경변수 가이드입니다.**  
> 앱은 아직 Supabase에 연결되지 않았습니다. mock/sessionStorage가 기본입니다.

## 1. Required environment variables

### Local (`.env.local` — Next.js, gitignore됨)

```bash
# Public — browser bundle에 포함됨
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>

# Standalone mock mode (현재 기본)
NEXT_PUBLIC_API_BASE_URL=
```

### Server-only (Vercel **Encrypted**, 로컬 `.env.local` — `NEXT_PUBLIC_` 금지)

```bash
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

**절대 규칙:** `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 컴포넌트, `NEXT_PUBLIC_*`, 또는 브라우저 번들에 넣지 말 것.  
서버 Route Handler / Server Actions / Edge Functions에서만 사용.

## 2. Vercel vs local separation

| Variable | Local | Vercel Preview | Vercel Production |
|----------|-------|----------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | dev project or empty | preview project | prod project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | dev anon | preview anon | prod anon |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` only | Preview encrypted | Production encrypted |
| `NEXT_PUBLIC_API_BASE_URL` | empty (mock) | empty unless BFF ready | BFF URL only |

- Preview와 Production은 **별도 Supabase project** 또는 최소 별도 branch 권장.
- PR Preview 빌드에 Production service role 주입 금지.
- CI (`.github/workflows/ci.yml`)는 secrets 없이 `npm ci` + lint + build만 실행 — 의도된 설계.

## 3. Migration workflow (when ready)

```bash
# Supabase CLI 설치 후 (별도 승인 필요)
supabase db push
# 또는
psql "$DATABASE_URL" -f supabase/migrations/0001_initial_schema.sql
psql "$DATABASE_URL" -f supabase/migrations/0002_rls_policies.sql
```

마이그레이션 파일:

- `supabase/migrations/0001_initial_schema.sql` — 테이블 초안
- `supabase/migrations/0002_rls_policies.sql` — RLS 정책 초안

## 4. Client utilities (not wired yet)

Supabase JS SDK는 **아직 dependency에 없음**. 연동 시:

- `lib/supabase/client.ts` — browser, anon key only
- `lib/supabase/server.ts` — Server Components / Route Handlers, cookie session

도입 전 `npm install @supabase/supabase-js` 승인 필요.

## 5. Security warnings

1. mock auth (`lib/api/auth.ts`)를 Supabase 전환 시 **제거** — 병행 금지.
2. RLS 없이 테이블 생성 금지.
3. `depth_evaluations` — 일반 사용자는 자신의 평가만 SELECT.
4. `reports` — INSERT only for self; SELECT own reports only; UPDATE/DELETE admin.
5. `app_config` — 일반 사용자 read-only (safe subset); write는 service role.

자세한 게이트: [`docs/SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md)
