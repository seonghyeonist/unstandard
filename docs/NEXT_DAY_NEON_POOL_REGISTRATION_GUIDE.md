# Next-day guide: Neon Pool / Preview invite registration (beginner)

> **목적:** Preview에서 초대 코드 기반 회원가입이 실패하는 문제를  
> Neon DB 연결(`Pool` / WebSocket) 관점에서 **천천히, 순서대로** 조사하고 고친다.  
> **Production 배포·env 변경 금지.** PR `#55` 브랜치만 다룬다.

---

## 0. 시작하기 전에 (5분)

### 0.1 이건 무슨 작업인가?

Preview(`unstandard-m9qj`의 Preview URL)에서:

1. 초대 코드로 회원가입을 시도하면
2. Better Auth가 user를 만들고
3. 앱이 `finalizeInviteRegistration()`으로 invite 소비 + profile bootstrap을 **한 트랜잭션**으로 끝낸다

이 과정에서 Neon `Pool`(WebSocket) 연결이 Vercel serverless에서 끊기거나,
에러 처리 중에 `b.mask is not a function` 같은 **2차 오류**가 보일 수 있다.

오늘은 “증상만 보고 막 고치기”가 아니라, **아래 8단계를 위에서부터 순서대로** 한다.

### 0.2 작업 브랜치 / 타깃 (외우기)

| 항목 | 값 |
|------|-----|
| Git branch | `cursor/neon-drizzle-better-auth-rebuild-909d` |
| PR | `#55` |
| Vercel project (유일한 canonical) | `unstandard-m9qj` |
| Production host (건드리지 말 것) | `https://unstandard-m9qj.vercel.app` |
| Node | **24.x** |

```bash
cd /workspace   # 또는 로컬 클론 루트
git fetch origin
git checkout cursor/neon-drizzle-better-auth-rebuild-909d
git pull origin cursor/neon-drizzle-better-auth-rebuild-909d
git rev-parse HEAD   # 시작 SHA 기록
```

### 0.3 절대 하지 말 것

- Production 배포 / Production env 수정
- Vercel env **값을 채팅·커밋·artifact에 출력**
- `DATABASE_URL` 전체, password, invite code, token 출력
- A/B smoke password·profile id **임의 생성**
- `main`에 직접 커밋
- “일단 되는 것처럼” hand-authored PASS JSON 작성

### 0.4 secret을 다룰 때 (hostname만)

URL이 필요할 때는 **절대 전체 문자열을 로그하지 말고**:

```bash
# 예시: hostname / 형태만 (값은 출력하지 않음)
python3 - <<'PY'
import os
from urllib.parse import urlparse
u = os.environ.get("DATABASE_URL", "").strip()
if not u:
    print("DATABASE_URL: MISSING")
else:
    p = urlparse(u)
    host = p.hostname or ""
    print("scheme:", p.scheme)
    print("hostname:", host)
    print("has_user:", bool(p.username))
    print("path_db:", (p.path or "/").lstrip("/")[:40])
    # pooled Neon URL은 보통 hostname에 '-pooler' 가 들어감
    print("looks_pooled_hostname:", "-pooler" in host)
    print("looks_neon:", host.endswith(".neon.tech") or "neon" in host)
PY
```

### 0.5 전날(이 세션)에서 이미 확인된 사실

- Preview alias / branch / SHA 메타는 **일치**했음  
  (`d4ad740…`, branch `cursor/neon-drizzle-better-auth-rebuild-909d`)
- 외부 smoke는 `SMOKE_VERCEL_PROTECTION_BYPASS` + A/B credential 부재로 **`BLOCKED_EXTERNAL`**
- A/B는 **Preview에서 invite claim → `/register` 가입**으로 만들어야 함  
  (CLI `alpha:invite:create`는 **초대만** 만들고 계정을 만들지 않음)
- password / profile id는 **가입 후 실제 값**이지, 임의 생성이 아님

---

## 1. `lib/db/client.ts` + Neon driver 버전 점검

### 1.1 파일을 연다

대상:

- `lib/db/client.ts` — runtime Pool + Drizzle
- `lib/db/run-migrations.ts` — migrator는 **neon-http** (트랜잭션 없음; 정상 분리)
- `package.json` — `@neondatabase/serverless`, `drizzle-orm`, `ws`

현재(작성 시점) 대략:

```ts
// lib/db/client.ts (개념)
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: requireDatabaseUrl() });
const db = drizzle(pool, { schema });
```

### 1.2 점검 체크리스트 (초보자용)

복사해서 답만 YES/NO:

1. [ ] runtime DB는 `drizzle-orm/neon-serverless` + `Pool` 인가?  
2. [ ] migrator만 `neon-http` 인가? (섞여 있어도 **migrator만**이면 OK)  
3. [ ] `neonConfig.webSocketConstructor = ws` 가 있는가?  
4. [ ] `Pool` / `db` 인스턴스를 **모듈 스코프에서 재사용**(lazy singleton)하는가?  
5. [ ] `package.json`의 `@neondatabase/serverless` 버전이 최신 major와 크게 어긋나지 않는가?  
   ```bash
   npm ls @neondatabase/serverless drizzle-orm ws
   # 필요 시 (값을 바꾸기 전에 changelog 확인)
   npm view @neondatabase/serverless version
   ```

### 1.3 판정

- **drivers가 심하게 오래됐거나**, Pool 설정이 docs와 다르면 → Step 2에서 설정 수정 후보
- “버전만 올리고 끝내기”는 금지. **원인 가설 → 최소 수정 → 테스트** 순서

---

## 2. Vercel serverless에서 Pool이 끊기지 않게 — `poolQueryViaFetch` 우선 검증

### 2.1 배경 (한 줄)

Vercel serverless에서는 **장수 WebSocket**이 불안정할 수 있다.  
Neon은 `neonConfig.poolQueryViaFetch = true` 로 **일반 `Pool.query`를 HTTP(fetch)로** 보내는 옵션을 제공한다.

### 2.2 중요: 트랜잭션은 여전히 WebSocket일 수 있음

초대 최종화는 `db.transaction(...)` 을 쓴다 (`lib/auth/invite-finalization.ts`).  
공식 문서상 **transaction / reserved connections는 WebSocket 경로를 계속 쓸 수 있다.**

따라서:

- `poolQueryViaFetch = true` = “모든 WS 문제를 무조건 고친다”가 **아님**
- 그래도 **우선 적용 가능성을 검증**하는 것이 이번 작업의 지시사항

### 2.3 적용 후보 (아직 커밋하지 말고 로컬에서 실험)

`lib/db/client.ts`에 **기존 `webSocketConstructor` 아래에** 추가하는 형태를 검토:

```ts
neonConfig.webSocketConstructor = ws;
neonConfig.poolQueryViaFetch = true; // candidate — verify before keeping
```

### 2.4 검증 방법 (초보자 순서)

1. **로컬 unit/integration이 깨지지 않는지**  
   ```bash
   npm ci
   npm run test
   # 가능하면:
   export TEST_DATABASE_URL=<disposable>
   export DATABASE_ENV=test
   export UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes
   npm run test:integration
   ```
2. **타입/린트**  
   ```bash
   npm run lint
   npm run typecheck
   ```
3. 공식 Neon serverless docs에서 현재 major(`@neondatabase/serverless@^1`)에  
   `poolQueryViaFetch` 가 **아직 유효한지** 확인 (deprecated면 대안 찾기)
4. Preview에 올린 뒤(Step 7) **회원가입 한 번**으로 확인 (Step 8)

### 2.5 대안 (poolQueryViaFetch로 부족할 때 — 아직 구현하지 말고 메모만)

문서/이슈에서 흔히 나오는 후보 (우선순위는 조사 후 결정):

- pooled connection string 사용 여부 (Step 3)
- `maxUses` / idle timeout 등 Pool 옵션
- 요청 단위 connect/release 패턴 (큰 리팩터 → **별도 승인**)
- HTTP driver로 단순 쿼리 / Pool은 트랜잭션만 (경계 커짐 → **승인 필요**)

**큰 재작성 금지.** 최소 패치 우선.

---

## 3. `DATABASE_URL`이 앱용 **pooled** Neon URL인지 (hostname만)

### 3.1 어디서 확인하나?

canonical Vercel project: **`unstandard-m9qj`**

- Preview env의 `DATABASE_URL`
- (참고) Neon console의 connection string 종류  
  - **pooled** — 앱/serverless용 (hostname에 보통 `-pooler`)  
  - **direct** — migrate/admin용인 경우가 많음

### 3.2 초보자 절차

1. Vercel Dashboard → project `unstandard-m9qj` → Settings → Environment Variables  
2. **Preview** 환경의 `DATABASE_URL`만 본다  
3. URL 전체를 복사해 채팅에 붙이지 말 것  
4. hostname만 눈으로 확인:
   - `….neon.tech` 인가?
   - `-pooler` 가 hostname에 있는가? → pooled 후보
   - `-pooler` 없으면 → **direct일 가능성** → serverless Pool에 부적합할 수 있음

CLI를 쓴다면 (로그인된 머신에서), **값을 파일로 pull한 뒤 hostname 스크립트만** 돌리고  
`.env*.local` 은 커밋하지 않는다. **Vercel env를 수정하지 말 것** (지시: 수정 금지;  
만약 pooled로 **바꿔야** 한다면 founder 승인 후 Preview만, Production 건드리지 말 것).

### 3.3 기록 형식 (티켓/노트용 — secret 없음)

```
DATABASE_URL_SHAPE:
  env: Preview
  project: unstandard-m9qj
  hostname_has_pooler: yes|no
  hostname_suffix: .neon.tech | other
  action: keep | need_founder_to_swap_to_pooled
```

---

## 4. Better Auth 조회 / 회원가입 / 초대 최종화가 **같은 DB 설정**인지

### 4.1 추적할 코드 경로 (읽기만 해도 됨)

| 단계 | 파일 | 기대 |
|------|------|------|
| URL 선택 | `lib/db/config.ts` → `requireDatabaseUrl()` | `DATABASE_ENV=test`면 `TEST_DATABASE_URL`, 아니면 `DATABASE_URL` |
| Pool/db | `lib/db/client.ts` → `getDb()` | 단일 Pool singleton |
| Better Auth adapter | `lib/auth/auth.ts` → `drizzleAdapter(getDb(), …)` | **같은** `getDb()` |
| 회원가입 after hook | `lib/auth/auth.ts` `databaseHooks.user.create.after` | `finalizeInviteRegistration(...)` |
| 최종화 트랜잭션 | `lib/auth/invite-finalization.ts` | `const db = getDb(); await db.transaction(...)` |
| invite reserve/consume | `lib/auth/invite-gate.ts` | 가능하면 같은 `DbExecutor` / tx |

### 4.2 초보자가 확인할 “냄새”

- 다른 파일에서 `new Pool({...})` / `neon(...)` 을 **runtime auth 경로**에 또 만드는가?
- Better Auth만 HTTP drizzle이고 finalization만 WS Pool인가? (의도치 않은 이중 드라이버)
- `DATABASE_ENV` / `TEST_DATABASE_URL` 혼선으로 Preview가 test URL을 보는가? (Preview에서는 보통 `DATABASE_URL`)

### 4.3 통과 기준

- 회원가입 성공 경로에서 **user insert(adapter)** 와 **finalize transaction** 이 동일 `getDb()` 그래프
- migrator(`neon-http`)는 runtime과 달라도 OK (이미 문서화됨: `docs/INVITE_FINALIZATION_LIMITATION.md`)

---

## 5. `b.mask is not a function` — 1차 vs 2차 오류 분리

### 5.1 心态

이 메시지는 종종 **진짜 원인(WebSocket/Pool 실패)** 을 처리하는 과정에서  
에러 객체를 포맷하려다 나는 **2차(secondary) TypeError** 다.

### 5.2 조사 순서

1. Vercel → `unstandard-m9qj` → 해당 **Preview deployment** → Runtime Logs  
2. 회원가입 요청 시각 전후로 로그를 시간순 정렬  
3. 첫 번째 의미 있는 오류를 찾는다. 예:
   - `ErrorEvent` / WebSocket / `connect ECONN` / `Connection terminated`
   - invite finalize code (`FINALIZE_TRANSACTION_FAILED` 등 — sanitized)
4. 그 **이후**에 `b.mask is not a function` 이 찍히면 → **2차로 분류**
5. `b.mask`만 고치려 하지 말 것. **1차 연결/트랜잭션**을 먼저 고친다

### 5.3 기록 템플릿

```
ERROR_SPLIT:
  primary: <첫 스택/메시지 요약, secret 없이>
  secondary: b.mask is not a function | none
  request: POST /api/auth/sign-up/email (or actual path)
  deployment_sha: <preview SHA>
```

---

## 6. 기존 통합 테스트 + `check` 실행

코드/설정을 바꿨든 안 바꿨든, **푸시 전에** 로컬에서:

```bash
npm ci
npm run check
# check = lint + typecheck + test + build (package.json 기준)

# 가능하면 real PostgreSQL integration도:
export TEST_DATABASE_URL=<disposable-not-production>
export DATABASE_ENV=test
export UNSTANDARD_CONFIRM_DESTRUCTIVE_TEST=yes
export UNSTANDARD_INTEGRATION_EVIDENCE_OUT=./tmp/integration-proof.json
npm run test:integration
```

`TEST_DATABASE_URL`이 없으면 integration은 `BLOCKED_EXTERNAL`일 수 있다.  
그 경우 **거짓 PASS를 만들지 말고**, unit `check`라도 통과시킨 뒤 Preview 검증으로 넘어간다.

가드:

```bash
npm run guard:boundaries
npm run guard:no-legacy-backend
```

---

## 7. 수정이 필요하면 PR 브랜치에 커밋·push → Preview 재배포

### 7.1 커밋 규칙

```bash
git status
git diff --stat
git diff   # 시크릿 없는지 육안 확인

git add <의도한 파일만>
git commit -m "fix(db): stabilize Neon Pool for Vercel preview registration"
git push -u origin cursor/neon-drizzle-better-auth-rebuild-909d
```

- 커밋 컨벤션: `feat|fix|docs|chore|refactor|test:`
- `next-env.d.ts` 빌드 산출물 커밋 금지
- **Production promote 하지 말 것**

### 7.2 Preview 재배포 확인 (canonical만)

필수 보고 5항목:

1. Vercel project name = `unstandard-m9qj`
2. URL/host = 새 Preview hostname
3. Preview (not Production)
4. Git commit SHA = 방금 push한 SHA
5. (해당 시) Supabase redirect는 이 스택에서 쓰는지 — Better Auth면 `BETTER_AUTH_URL` / app URL이 Preview를 가리키는지 **이름만** 확인

하나라도 불확실하면: `target not confirmed` 하고 smoke/가입 성공 주장 중단.

---

## 8. 새 Preview에서 초대 회원가입 재검증 → 그 다음에만 smoke

### 8.1 계정 만들기 (UI)

1. (DB 접근 가능한 환경에서) 초대 생성:
   ```bash
   npm run alpha:invite:create -- --email <A용>
   npm run alpha:invite:create -- --email <B용>
   ```
   출력되는 **invite code는 채팅/커밋에 남기지 말 것.**
2. Preview 보호가 켜져 있으면 bypass / 로그인으로 진입
3. Preview `/login` → “Have an invite? Create your account” (`/register`)
4. invite claim + email/password 회원가입 (password ≥ 10)
5. 성공 시: session / onboarding으로 이어지는지 확인
6. Neon에서 **실제 profile UUID** 조회 → smoke용으로 보관 (출력 최소화)

실패하면: Step 5의 primary 오류부터 다시. **smoke를 먼저 돌리지 말 것.**

### 8.2 smoke에 넣을 변수 (임의 생성 금지)

```bash
export SMOKE_BASE_URL=https://<exact-preview-hostname>.vercel.app
export SMOKE_VERCEL_PROTECTION_BYPASS='<automation bypass secret>'
export SMOKE_USER_A_EMAIL='...'
export SMOKE_USER_A_PASSWORD='...'   # 가입 때 쓴 그 값
export SMOKE_USER_A_PROFILE_ID='...' # DB의 그 UUID
export SMOKE_USER_B_EMAIL='...'
export SMOKE_USER_B_PASSWORD='...'
export SMOKE_USER_B_PROFILE_ID='...'
export UNSTANDARD_SMOKE_EVIDENCE_OUT=./tmp/smoke-proof.json
```

### 8.3 smoke → evidence → alpha (성공한 가입 검증 후에만)

```bash
# runner checkout SHA == Preview deployment SHA 인지 먼저 확인
git rev-parse HEAD

npm run smoke:authorization

# smoke artifact가 현재 SHA에 묶였는지 확인 (artifact 열고 gitSha 필드)
# 그 다음:
export UNSTANDARD_SMOKE_EVIDENCE_PATH=./tmp/smoke-proof.json
export UNSTANDARD_INTEGRATION_EVIDENCE_PATH=./tmp/integration-proof.json
export UNSTANDARD_READINESS_EVIDENCE_OUT=./tmp/readiness-proof.json
export UNSTANDARD_EXPECTED_PREVIEW_HOSTNAME=<exact-preview-hostname>.vercel.app
npm run readiness:evidence:build

export UNSTANDARD_READINESS_EVIDENCE_PATH=./tmp/readiness-proof.json
npm run readiness:alpha
```

상세 계약: `docs/AUTHORIZATION_ADVERSARIAL_SMOKE.md`, `docs/NEON_BOOTSTRAP_RUNBOOK.md`.

---

## 9. 하루 종료 시 보고 포맷 (복붙)

```
## Neon Pool / registration day report

### deployment
- project:
- preview_host:
- sha:
- matches_git_head: yes|no

### step1 client/driver
- notes:

### step2 poolQueryViaFetch
- applied: yes|no|reverted
- evidence:

### step3 DATABASE_URL shape
- hostname_has_pooler: yes|no
- (no secrets)

### step4 same DB graph
- better_auth_adapter_uses_getDb: yes|no
- finalize_uses_getDb_transaction: yes|no

### step5 error split
- primary:
- secondary_mask: yes|no

### step6 tests
- npm run check: PASS|FAIL
- test:integration: PASS|FAIL|BLOCKED_EXTERNAL

### step7 push/preview
- commit:
- production_touched: no

### step8 registration + smoke
- invite_signup_preview: PASS|FAIL
- smoke:authorization: PASS|FAIL|BLOCKED_EXTERNAL|SKIPPED
- readiness: PASS|FAIL|SKIPPED
- missing_env_names (if blocked):
```

---

## 10. 막혔을 때 빠른 분기

| 증상 | 먼저 볼 곳 |
|------|------------|
| Preview 403 | `SMOKE_VERCEL_PROTECTION_BYPASS` / Vercel protection |
| 회원가입 500 + WS/ErrorEvent | Step 2–3 (Pool / pooled URL) |
| `b.mask is not a function`만 눈에 띔 | Step 5 — secondary로 분류, primary 찾기 |
| login OK인데 smoke FAIL | password/profile id mismatch, hostname, SHA mismatch |
| `BLOCKED_EXTERNAL` | 누락 env **이름만** 보고, 값 추측 금지 |
| Production URL로 테스트함 | 즉시 중단 — canonical Preview만 |

---

## 11. 관련 문서

- `docs/INVITE_FINALIZATION_LIMITATION.md` — invite finalize 한계
- `docs/NEON_BOOTSTRAP_RUNBOOK.md` — migrate/seed/invite/smoke
- `docs/AUTHORIZATION_ADVERSARIAL_SMOKE.md` — smoke 계약
- `docs/HANDOFF_SESSION.md` — 브랜치/Node/명령 요약
- `AGENTS.md` — canonical Vercel lock, 안전 규칙

---

*이 가이드는 “다음 작업일” 실행용이다. 가이드 작성만으로 버그가 고쳐진 것은 아니다.*
