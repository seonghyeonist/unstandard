# UNSTANDARD B2C P2 승인 기록

2026-11-20 KST.

| 분류 | 범위 |
|---|---|
| AUTO | GitHub/Vercel/Neon/Drive 조회, P1 기반 코드·migration·일회용 로컬 DB·검증, P2 원격 Git 브랜치 및 Draft PR |
| APPROVAL | Paddle Sandbox 설정과 결제 시연, 전용 Vercel Preview 1개와 합성 데이터용 빈 Neon DB 1개를 기존 무료 할당량 안에서 생성 또는 재사용 |
| OWNER ACTION | Paddle Sandbox 계정 로그인과 최소권한 API 키 발급·연결. Paddle의 합성 거래 알림 전달 정책 선택 |
| FORBIDDEN | Live/실청구, 운영 DB/Alpha 인증·환경/Production 변경, 기존 사용자정보 재사용, PR 병합 |

## 남은 승인 한 건

**Paddle Sandbox 연결 및 격리된 원격 리허설. 추가 지출 한도 USD $0.** 기존 무료 할당량을 먼저 확인하고 전용 자원을 재사용한다. 무료 근거가 없는 유료 변경은 별도 결정 대상이다. Alpha와 공유하는 Paddle 설정은 쓰기 전 영향 범위를 다시 확인한다.

- 대상은 USD 899센트 가격/상품, Sandbox 클라이언트 토큰, Platform 및 Simulator 알림 목적지, B2C Checkout URL 및 통화 설정, 독립 Preview/빈 DB다.
- 런타임 키는 Paddle 상품·가격 읽기, 거래 읽기·생성, 조정 읽기, 고객 조회로 제한한다. Provision 키는 관련 카탈로그·기본 링크·통화·클라이언트 토큰·Destination의 필요한 읽기/쓰기, Simulator 키는 notification simulation 읽기/쓰기, E2E 키는 조정 쓰기에 한정한다. 키 발급과 보안 경로 주입은 계정 소유자 조작이다. 채팅에 비밀을 남길 필요가 없다.
- Preview와 DB 분리 설정을 되돌릴 수 있다. 키를 철회하고 목적지를 비활성화할 수 있다. Paddle의 합성 거래 및 환불 원장은 공급자에 남는다.
- 승인과 키 연결 전에는 실제 Sandbox 사전 점검, Simulator, Checkout, 승인 환불 후 접근 철회가 막힌다. 로컬 합성 및 Draft 리뷰는 가능하다.

이번 세션에서 결제사·배포·DB의 원격 자원 변경 및 실거래 비용은 0이다.
