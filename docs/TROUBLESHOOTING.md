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

## 4. `next-env.d.ts`가 자꾸 변경됨

원인: `next build`가 재생성하는 산출물입니다. `.gitignore`에 있으나 과거에 커밋되어 추적 중입니다.

해결: 커밋하지 말 것. 빌드 후 `git checkout -- next-env.d.ts`로 되돌립니다.

주의: `npm run check`(= `lint && typecheck && build`)는 마지막 `build`가 `next-env.d.ts`를 재생성하므로, **연속 2회** 실행하면 두 번째 `lint`가 재생성된 파일의 triple-slash 참조를 잡아 실패할 수 있습니다. CI는 매번 fresh checkout이라 영향 없음. 로컬에서 재실행 전 `git checkout -- next-env.d.ts`로 정리하세요.

## 5. depth-service 테스트/실행

- 단위 테스트(DB/임베딩 불필요): `services/depth-service/.venv/bin/python -m pytest` (디렉터리: `services/depth-service`).
- `GET /health`는 DB 없이 동작하지만, `POST /internal/depth/evaluate`는 TEI 임베딩 서버가 없으면 503.
- 전체 스택(Postgres pgvector + TEI bge-m3)은 `docker-compose.yml` 필요. 모델 다운로드가 큼 — 프론트 MVP 데모에는 불필요.
