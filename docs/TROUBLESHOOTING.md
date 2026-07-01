# TROUBLESHOOTING

프로젝트 셋업/CI에서 반복적으로 부딪히는 문제와 해결법 모음.

## 1. `npx webpack` 또는 webpack-cli 설치 프롬프트로 CI가 멈춤/실패

증상 (GitHub Actions 로그):

```
CLI for webpack must be installed.
  webpack-cli (https://github.com/webpack/webpack-cli)
Do you want to install 'webpack-cli' (yes/no):
Error: Process completed with exit code 1.
```

원인: 이 프로젝트는 **Next.js**라서 raw webpack을 직접 쓰지 않습니다. 과거 GitHub 스타터 워크플로(`webpack.yml`)가 `npx webpack`을 실행했고, webpack v5가 `webpack-cli`를 대화형으로 설치하려다 CI(비-TTY)에서 멈춰 exit 1로 실패했습니다.

해결: `webpack.yml`/`deno.yml` 스타터 워크플로를 제거하고, Next.js/npm 기준 `ci.yml`만 사용합니다.

```yaml
# .github/workflows/ci.yml (핵심)
- run: npm ci
- run: npm run lint
- run: npm run typecheck
- run: npm run build
```

확인: `gh pr checks <PR번호>` 가 `build (20.x) pass`, `build (22.x) pass` 인지 본다. 워크플로 폴더에 `webpack.yml`/`deno.yml`이 다시 생기지 않았는지 `ls .github/workflows/`로 점검.

## 2. 답변 잠금해제가 항상 `ERROR`로 표시됨 (NEXT_PUBLIC_API_BASE_URL)

원인: `.env.local`의 `NEXT_PUBLIC_API_BASE_URL`이 값이 채워져 있는데 depth-service 백엔드가 떠 있지 않으면, `lib/api/answers.ts`의 fetch가 실패해 verdict가 `ERROR`가 됩니다.

해결:
- **standalone 개발/데모**: `NEXT_PUBLIC_API_BASE_URL=` (빈값) → 로컬 `mockVerdict` 사용.
- **실제 백엔드 사용**: `docker compose up`으로 Postgres + TEI + depth-service를 먼저 띄운 뒤 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` 설정.

## 3. `npm ci` 실패 (lockfile 불일치)

원인: `package.json`과 `package-lock.json` 불일치. `npm ci`는 불일치 시 설치하지 않고 에러를 냅니다(의도된 엄격 동작).

해결: 로컬에서 `npm install`로 lockfile을 갱신하고, 변경된 `package-lock.json`을 커밋합니다. 새 dependency를 임의로 추가하지 말 것.

## 4. `next-env.d.ts`가 자꾸 생성되거나 lint에 걸림

원인: `next build`가 재생성하는 산출물입니다. `.gitignore`에 포함되어야 하며, Git이 추적하면 빌드 후 작업 트리가 더러워질 수 있습니다.

해결: 커밋하지 말 것. Git 추적 대상에서 제거된 경우 로컬에만 존재합니다. 빌드 후 의도치 않게 변경된 경우 `git restore next-env.d.ts`로 되돌립니다. ESLint는 이 생성 파일을 검사하지 않도록 `eslint.config.mjs`에서 `next-env.d.ts`를 ignore합니다.

주의: `npm run check`(= `lint && typecheck && test && build`)가 빌드 직후 재실행에서 `next-env.d.ts` triple-slash reference로 실패하면, `eslint.config.mjs`의 ignore 목록에 `next-env.d.ts`가 있는지 먼저 확인하세요.

## 5. depth-service 테스트/실행

- 단위 테스트(DB/임베딩 불필요): `services/depth-service/.venv/bin/python -m pytest` (디렉터리: `services/depth-service`).
- `GET /health`는 DB 없이 동작하지만, `POST /internal/depth/evaluate`는 TEI 임베딩 서버가 없으면 503.
- 전체 스택(Postgres pgvector + TEI bge-m3)은 `docker-compose.yml` 필요. 모델 다운로드가 큼 — 프론트 MVP 데모에는 불필요.

## 6. 보안 / mock 모드 주의

실사용자 알파 전에 [`docs/SECURITY_CHECKLIST.md`](./SECURITY_CHECKLIST.md) 확인.

- **Production fail-closed:** `NODE_ENV=production`에서 Supabase env 없으면 `/app`, `/onboarding` middleware redirect. mock auth 불가.
- **AUTH_COOKIE_SECRET:** production에서 필수. 없으면 unlock cookie 서명이 throw → unlock 실패 (의도된 fail-closed).
- Mock auth는 dev-only HttpOnly cookie. `sessionStorage` 인증 제거됨 (PR #11+).
- 신고는 서버 in-memory buffer — **알파 불가**. Supabase persistence 필요.
- `NEXT_PUBLIC_API_BASE_URL` 설정 시 depth-service internal API 직접 호출 — BFF 필요.
- 차단(block) 미구현.

### middleware Edge runtime 경고

`npm run build` 시 다음 경고가 나올 수 있음:

```
A Node.js API is used (process.version) ... @supabase/supabase-js ... Edge Runtime
```

- 원인: `middleware.ts`가 `@supabase/ssr`을 import하고, 번들러가 `@supabase/supabase-js` browser 경로까지 포함.
- **무해하다고 단정하지 말 것.** Vercel Edge preview 배포에서 middleware runtime 오류 여부를 반드시 확인.
- runtime 오류 시: Supabase 공식 Next.js middleware 패턴 재검토 또는 Node runtime route로 세션 검증 이전 검토.

Supabase/RLS 초안: [`docs/SUPABASE_SETUP.md`](./SUPABASE_SETUP.md), `supabase/migrations/`.
