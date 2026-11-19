# UNSTANDARD B2C P0 기준선

조회일 2026-11-19 KST. 첨부한 마스터 명세 v4.0(2026-11-18) 10쪽을 확인했다.

| 대상 | 확인 결과 |
|---|---|
| GitHub `main` | `30d0c78ee19d652fed2bedcae7271931f8f04b31` |
| GitHub 공통 조상 | `main`과 동일. Production 쪽 114커밋 앞섬, 뒤처진 커밋 0개. GitHub 비교 API와 로컬 `git merge-base` 일치 |
| Vercel Production | `unstandard-m9qj`, 최신 Production 배포 `dpl_BvmGTnKqyuxQyZ6Aut6xwJPsk16p`, READY, `f5b3843494e6cfb6a87ef21339243e68d28151b9`. 배포 메타에 `unstandard.app` 별칭 표시 |
| Neon | `raspy-fog-00907976`, PostgreSQL 17. `main` / `br-bitter-wave-ajs8dy0u`, ready·default·protected |
| PR #92 | OPEN / DRAFT / 미병합. `main` 대상. head `da5f79e4e1a107177757138036f9af30e25d0f1e` |
| PR #96 | OPEN / DRAFT / 미병합. `release/production-baseline-20261103` 대상. head `f14e53a56d26237eba93d56b3a4433e612b8372e` |

Production SHA의 직접 부모는 #96의 현재 head다. #96의 코드 계보는 배포 SHA에 포함되어 있으며, GitHub PR 상태도 미병합으로 유지 중이다. 예전 release 브랜치는 Production보다 4커밋 뒤다. 두 PR을 별도로 병합하거나 체리픽하는 과정 없이 Production SHA에서 P0 작업 브랜치를 분기했다. Draft 비교 기준은 같은 SHA를 가리키는 기존 `feat/mobile-editorial-20261105`다. Draft에 기존 Production과 main 사이의 변경분이 함께 들어가는 일을 피한다.

- [GitHub main과 Production 비교](https://github.com/seonghyeonist/unstandard/compare/30d0c78ee19d652fed2bedcae7271931f8f04b31...f5b3843494e6cfb6a87ef21339243e68d28151b9)
- [Production 커밋](https://github.com/seonghyeonist/unstandard/commit/f5b3843494e6cfb6a87ef21339243e68d28151b9)
- [Vercel 배포](https://vercel.com/unstandard/unstandard-m9qj/BvmGTnKqyuxQyZ6Aut6xwJPsk16p)
- [Neon 프로젝트](https://console.neon.tech/app/projects/raspy-fog-00907976)
- [PR #92](https://github.com/seonghyeonist/unstandard/pull/92) · [PR #96](https://github.com/seonghyeonist/unstandard/pull/96)

## Alpha 의존성과 재사용

| 조사 대상 | P0 결정 |
|---|---|
| 루트 `package.json`, `app/layout.tsx` | Node 24.x, Next, Alpha 전역 레이아웃·QueryProvider·Inter. B2C는 Node 24 도구와 색상·소문자 워드마크·종이 카드 패턴을 계승하고 루트 레이아웃을 가져오지 않는다. |
| `proxy.ts`, `lib/auth/auth.ts` | Alpha는 `/app`·`/onboarding` 보호, Better Auth·Drizzle·쿠키·초대 등록과 결합. B2C P0의 별도 진입점에는 인증 초기화가 없다. |
| `lib/db/client.ts`, `lib/security/rate-limit.ts` | Neon Pool은 지연 초기화. 기존 제한 모듈은 `getDb()`와 인증 시크릿에 결합. P0에는 제한할 서버 쓰기가 없다. P1부터 정책 형태만 참고하고 저장소·키를 별도로 주입한다. |
| `lib/api/report-store.ts` | Alpha 신고용 타입과 레거시 sessionStorage 헬퍼. B2C 개인 카드에 맞는 저장소 계약은 P1에서 신설한다. |
| 루트 경로 인벤토리 | `/`, 로그인, 온보딩, Alpha API는 기존 Next 앱이 사용. 기준 SHA에는 `apps/b2c`, `app/[locale]`, `app/api/b2c`가 없다. |

## 아키텍처

단일 Next 앱에 `/[locale]/brief`를 두면 라우트 자체는 충돌하지 않으나 루트 레이아웃, 빌드, 배포 트리거와 운영 경계를 공유한다. `apps/b2c`는 별도 npm 매니페스트·잠금 파일·빌드 출력(`dist/`)을 갖는 정적 앱이다. 현재 범위는 정적 HTML, CSS 및 브라우저의 ES 모듈만으로 동작한다. 개발 도구만 npm 의존성에 포함했다. 루트 Vercel 설정에는 이 작업 브랜치의 Git 자동 배포를 끄는 단일 규칙을 추가했다. 기존 프로젝트·빌드 명령의 변경 없이 PR을 검토할 수 있도록 하기 위한 조치다. [Vercel Git configuration](https://vercel.com/docs/project-configuration/git-configuration)

## 범위

v4 1–3쪽과 6·9쪽에 해당하는 모바일 랜딩, 무료 계산·영수증, 구매 전 샘플, USD 시험가와 유료 상품 범위를 구현한다. v4 4–5·7–10쪽의 유료 계약, 주문, 저장, 초대, 합의, 보존, 가격 실험과 성장 기준은 후속 범위다. 이번 개발에는 실제 데이터나 시크릿이 필요 없다.
