# UNSTANDARD B2C P2 외부 검증 및 P3 인계 프롬프트

UNSTANDARD P2를 이어받아 실제 Sandbox 증거까지 완성한다. v4의 갈등 후 재연락, EN/KO 무료 6축 영수증, USD $8.99 단건, 구매자 한 명과 상대 한 명 무료, 결제 후 최대 14일 계약을 따른다.

1. P2 Draft의 현재 HEAD와 base, 병합 상태를 확인한다. P1 base 브랜치는 `pivot/b2c-v4-p1-data-session`이다. 인수인계·검증 매트릭스·Sandbox 런북·권한 기록을 읽고 로컬 집계 및 Alpha 회귀를 재실행한다.
2. 사용자 결정이 필요한 것은 Paddle 계정 연결, 격리 원격 리허설, 메일 전달 정책이다. 지출 한도 $0과 조직 권한을 확인한다. 키는 비밀 경로에서 주입한다. 기존 자원을 재사용하고 Alpha/Production/Live/병합의 경계를 지킨다.
3. 전용 Vercel Preview와 빈 Neon DB를 연결한다. 두 webhook URL만 보호 예외로 두고 raw body, 실제 Vercel IP 헤더, no-store, Origin, runtime/migrator 권한을 검증한다.
4. Paddle 읽기 preflight부터 시작한다. 계정 차이를 검토하고 승인된 값만 적용한 뒤 read-back을 남긴다. 공식 Simulator와 실제 Checkout을 구분해 실행한다.
5. 실제 Paddle 서명, 거래 API, 내부 원장·방·작업·세션 1세트, 결제 전 거절, 결제 후 카드 API 202, 승인 환불 후 철회를 증거로 남긴다. 결제사 보안 통제가 개입하면 그 지점까지 기록하고 BLOCKED로 남긴다. 수정 후 정확한 SHA에서 재검증하고 Draft의 문서를 갱신한다.
6. P3 별도 승인 이후 `personal_card` revision 0을 처리한다. EN/KO 결정론 템플릿, 72시간 안내, 권한·멱등·회귀를 검증한다. 결과를 저장하기 직전에 권한을 재확인하고 구매자 한 명만 자신의 카드를 열 수 있어야 한다.
