# UNSTANDARD B2C P1 인수인계

**로컬 구현·검증 완료.** 격리 PostgreSQL 17.11에서 schema·세션·소유권을 확인했다. P1은 독립 실행 가능한 데이터 기반이며 Paddle 연동은 P2에서 시작한다.

| 기준 | 확인값 |
|---|---|
| 제품 | 첨부 v4.0, 2026-11-18 |
| Git 시작점 | [P0 `f92df39ca08b200806c0b9b50787eddea4fc7850`](https://github.com/seonghyeonist/unstandard/commit/f92df39ca08b200806c0b9b50787eddea4fc7850). [PR #98](https://github.com/seonghyeonist/unstandard/pull/98) OPEN / DRAFT / 미병합 |
| P1 구현 SHA | [`d93d19e91ba8dc08ebc42d24b1f01a563f339fb0`](https://github.com/seonghyeonist/unstandard/commit/d93d19e91ba8dc08ebc42d24b1f01a563f339fb0) |
| P1 최종 브랜치 | `pivot/b2c-v4-p1-data-session`. 인수인계까지 포함한 정확한 최종 head는 [Draft PR #99](https://github.com/seonghyeonist/unstandard/pull/99/commits)에 표시된다. |
| 기존 Vercel | `unstandard-m9qj`, READY Production `dpl_BvmGTnKqyuxQyZ6Aut6xwJPsk16p` / `f5b3843`. P1 브랜치의 Git 자동 배포를 커밋 설정에서 차단했다. |
| 기존 Neon | `raspy-fog-00907976`, 기본 브랜치 `br-bitter-wave-ajs8dy0u` protected. 자원 조회 결과 Alpha·감사 관련 프로젝트만 식별했다. 원격 schema 적용은 하지 않았다. |

## 제품·구현 경계

갈등 후 재연락을 주제로 EN/KO 무료 6축 영수증, 로컬 계산, 구매 전 대화 카드 샘플을 유지한다. 예정가 USD $8.99 단건, 구매자 한 명과 상대 한 명 무료, 구매 후 14일을 제품 계약으로 이어받는다. 상대 미참여 시에도 개인 카드 가치가 남아야 한다. 결제·카드 생성·초대·개인정보 보존 작업은 P2 이후다.

- `apps/b2c`의 P0 정적 빌드를 유지하고 별도 루프백 Node HTTP 진입점을 추가했다. 기존 Next 레이아웃, Alpha 인증, Didit, Depth Score, 운영 DB 의존성을 들여오지 않았다. 상용 호스팅 진입점은 P2 승인 범위에서 결정한다.
- 전용 DB `unstandard_b2c`, schema `b2c`, migration journal `b2c_migration.__drizzle_migrations`를 사용한다. v4의 10개 테이블에 digest 기반 `sessions`를 추가했다. USD 정수 센트, timestamptz, 같은 방의 멤버·라운드를 요구하는 복합 외래키, 유일성, revision, 주문/권한/데이터 분리를 적용했다.
- `issueSession(tx, memberId, clock?)`는 내부 함수다. 결제 확인·활성 방·활성 멤버를 확인하고 32바이트 무작위 토큰의 SHA-256 digest만 저장한다. 세션 쿠키에는 Secure, HttpOnly, SameSite=Lax, Path=/를 적용한다. 발급 HTTP 경로는 없으며 합성 발급은 테스트에서만 실행했다.
- 방을 요청할 때 유효 세션의 방과 경로 UUID가 일치해야 한다. 개인 카드 조회는 같은 방의 현재 멤버가 소유한 개인 카드만 반환한다. API는 no-store·no-referrer를 응답하고 쓰기는 설정된 Origin과 정확히 일치해야 한다. 읽기는 권한 행에 공유 잠금, 갱신은 행 잠금·revision 조건을 사용한다. P2 환불 처리도 주문/방 갱신을 같은 DB 트랜잭션에서 운영하도록 검증한다.
- 방의 실효 만료는 서버 확인 결제 시각 + 14일과 저장된 만료 중 빠른 값이다. 세션의 별도 15일 수명은 14일 경계에서 410을 반환할 수 있게 한다. 세션의 수명이 방 접근을 늘리지 않는다.

| 경로 | 계약 |
|---|---|
| `GET /api/b2c/rooms/:roomId` | 유효한 같은 방 멤버에 방 만료와 본인 role·locale·revision 반환 |
| `GET /api/b2c/me/card` | 본인 개인 카드 200, 아직 준비 전이면 202 |
| `PATCH /api/b2c/rooms/:roomId/me` | 본인 locale 변경. 본문 `{locale, revision}`. 동시 같은 revision은 한 요청만 성공, 다른 요청은 409 |
| 공통 오류 | 세션 만료·철회 401, 다른 방·미존재 경로 404, 유효 세션의 방 만료·철회·비결제 상태 410, 지원하지 않는 갱신 입력 422, 쓰기 Origin 불일치 403, 처리 불능 503 |

## 재실행과 증거

저장소 루트에서 Node 24.x를 사용한다. PostgreSQL 실행 파일이 PATH에 없다면 `B2C_PG_BIN`에 PostgreSQL 17의 bin 디렉터리를 지정한다.

```bash
npm --prefix apps/b2c ci
npm --prefix apps/b2c run check
npm --prefix apps/b2c run db:generate
npm --prefix apps/b2c audit --audit-level=moderate
python apps/b2c/scripts/test-postgres.py
B2C_BROWSER=/path/to/chromium python apps/b2c/tests/browser_check.py
npm run check
```

| 결과 | 확인 사항 |
|---|---|
| B2C check PASS | 최종 잠금 파일로 클린 설치, lint, typecheck, unit **9/9**, 정적 build. 별도 Node 진입점에서 무료 랜딩이 HTTP 200 및 빌드 바이트 일치 |
| B2C 의존성 PASS | 마지막 `npm audit`에서 취약점 0건 보고. Drizzle Kit 개발 의존성의 esbuild 버전 고정은 루트에서 사용하던 버전과 일치시켰다. |
| DB·HTTP PASS | 일회용 PostgreSQL 17.11에서 빈 DB migration 2회, journal 1건, 통합 **5/5**. 격리된 타 방·상대 카드 차단, own locale CAS, 중복 제약, 철회, 환불 상태, 14일 경계를 확인했다. 임시 서버는 종료했다. |
| Drizzle PASS | 동일 schema에서 `db:generate` 재실행 결과 추가 migration 없음 |
| P0 Chromium PASS | Chromium 153, 360×800 및 1440×1000. EN/KO, 키보드, 검증 오류, 결과, 가로 스크롤 없음, 조작 중 네트워크 요청 0건. [모바일 KO](evidence/p0-mobile-ko.webp) · [데스크톱 EN](evidence/p0-desktop-en.webp) |
| Alpha check PASS | 루트 lint/typecheck/test/build, **405/405**, 정적 페이지 39/39. P0 기준 라우트 유지 |
| 원격 격리 검증 대기 | 이번 작업에 원격 전용 B2C DB·Preview·Paddle Sandbox를 연결하지 않았다. Runtime/migrator 권한 분리는 원격 준비에서 적용 및 재검증한다. |

로컬 서버를 시작할 때 `B2C_DATABASE_URL`과 `B2C_ORIGIN`을 설정하고 `npm --prefix apps/b2c run start`를 실행한다. 마이그레이션은 로컬의 `B2C_MIGRATE_CONFIRM=local-b2c`로 별도 실행한다. DB URI는 전용 DB를 지정하며 쿼리 옵션을 붙이지 않는다. 원격은 사전 승인 및 `B2C_EXPECT_DB_HOST`와 정확한 호스트 일치, TLS 인증서 검증, `B2C_MIGRATE_CONFIRM=authorized-remote-b2c`가 필요하다. 마이그레이션은 빌드에 포함되지 않는다.

## 다음 작업

[P2–P8 실행 프롬프트](https://drive.google.com/file/d/1JoqqZiuh9ZM6Mq_7RzXlwHeElak34mSa/view?usp=drivesdk)에 Paddle 설정 사전 점검과 후속 단계 통과 조건을 기록했다. P2는 USD SKU·가격 ID·웹훅 목적지·복구 메일을 준비하며, 로컬 합성 결제와 실제 Sandbox 체크아웃을 각각 검증한다. 각 단계에서 격리 자원만 사용한다.
