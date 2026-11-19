# UNSTANDARD B2C P0 인수인계

작업 브랜치 `pivot/b2c-v4-foundation-20261119`. 제품 범위는 갈등 후 다시 연락하기를 위한 무료 영수증과 구매 전 대화 카드 샘플이다. 기준과 의존성은 [P0_BASELINE.md](P0_BASELINE.md)에 기록했다.

## 실행

저장소 루트에서 실행한다. Node 24.x 기준이다.

```bash
npm --prefix apps/b2c ci
npm --prefix apps/b2c run check
python -m http.server 4173 --bind 127.0.0.1 --directory apps/b2c/dist
```

로컬 URL은 `http://127.0.0.1:4173/`이다. 브라우저 검수 스크립트는 Python Playwright와 Chromium이 설치된 개발 환경에서 `B2C_BROWSER=/path/to/chromium python apps/b2c/tests/browser_check.py`로 실행한다. Playwright 관리 Chromium을 쓰는 환경에서는 `B2C_BROWSER`를 생략한다. 스크린샷은 `apps/b2c/coverage/browser/`에 저장한다.

## 화면과 결과

- 영어로 시작하고 헤더에서 한국어로 바꾼다. 언어를 바꿔도 입력과 결과는 현재 페이지에 유지된다. 브라우저 문서 언어도 바뀐다.
- 히어로의 카드에서 사건, 원하는 행동, 기한, 양보, 톤과 실제 보낼 수 있는 문장을 보여준다.
- 여섯 축에 −5~+5 정수를 각각 선택한다. 미입력과 0은 구별한다. 제출 오류에는 오류 문구와 첫 미완료 필드 포커스를 제공한다. 진행 수, 결과 화면, 수정 후 재계산을 구현했다.
- 결과는 절댓값 내림차순, 같으면 ASCII 축 ID 오름차순으로 두 개를 고른다. 축 ID는 `boundary`, `commitment`, `confidence`, `expression`, `pace`, `reality`다. 전부 0이면 앞의 두 축을 중립 선택으로 표시한다.
- 무료와 계획된 유료 범위를 비교하고 시험가 USD $8.99, 1인 결제·상대 무료, 결제 후 14일, 상대 미참여 시 개인 카드와 다음 행동 안내를 명시한다. 결제 미개방은 상태 텍스트로 표시한다.

## 검증 결과

| 검증 | 증거 |
|---|---|
| `npm --prefix apps/b2c run check` | lint, strict JSDoc/TypeScript 검사, 단위 테스트 6/6, 정적 빌드 통과. 경계, 동률, 전부 0, 비정상 값, 문자열 파싱, EN/KO 결과와 진행 수 포함 |
| `npm --prefix apps/b2c ci --dry-run --offline --ignore-scripts` | 독립 잠금 파일 해석 성공. 새 레지스트리 다운로드를 수반하는 설치는 이번 검수에서 실행하지 않았다. |
| 루트 `npm run check` | Production 기준 SHA에서 PASS. 변경 브랜치에서 lint 설정의 익명 default export 경고를 수정하고 PASS. 양쪽 모두 Alpha 테스트 405/405, 정적 페이지 39/39, Next 라우트 목록 동일. 잠금 파일과 버전이 일치하는 기존 로컬 의존성을 재사용했다. 실계정·Didit·운영 DB 대상 E2E는 범위 밖이었다. |
| 합성 정적 HTTP | localhost에서 정적 파일 6개 모두 HTTP 200 및 파일 바이트 일치. 6개 축에 각 11개 숫자 선택지, 샘플 항목 5개, 전송 form이 없는 HTML 및 CSP 확인 |
| 모바일 360px / 데스크톱 | 컬러 대비 산출과 CSS·포커스 구조 검토 완료. 작은 본문/보조/강조 텍스트 검증 조합 5.94:1 이상. Chromium 프로세스가 AF_UNIX socket을 열 때 거부되어 로컬 자동화가 시작되지 못했다. 별도 브라우저에서도 작업 환경의 로컬 주소에 연결할 수 없었다. 실제 가로 스크롤·키보드·시각 검수·스크린샷·상호작용 네트워크 캡처는 미검증이다. |

## 개인정보 경계

무료 답변·결과는 브라우저 메모리의 단일 페이지 상태다. 별도 입력 폼 제출, 네트워크 호출, 저장소, 쿠키, 원격 폰트, 광고 추적기, 운영 DB나 Alpha 모듈 의존성이 없다. 문서 CSP는 `connect-src 'none'`, `form-action 'none'`을 적용하고 같은 출처의 정적 JS/CSS만 허용한다. 정책과 소스를 확인했다. 사용자 조작 중 요청 0을 확인하는 브라우저 계측은 위 검수 제약으로 재실행이 필요하다.

## P1 선행조건

1. 실제 브라우저에서 360px/데스크톱·키보드·언어 전환·요청 0 검수를 완료한다.
2. Preview와 신규 DB가 필요해지는 시점에 별도 B2C 프로젝트와 준비 권한을 확보한다. Alpha 자격증명을 재사용하지 않고 B2C 전용 시크릿, 빈 DB, 합성 seed, 독립 migration journal을 정한다.
3. v4의 USD 주문 계약을 확정하고 격리된 테스트 결제사 환경에서 테스트한다. 서버 주문 확인, 서명 검증, 원장·권한·작업 원자 저장, 중복/역순 환불, 복구 링크, 14일 만료를 먼저 검증한다. 실결제를 열기 전 판매자·도메인 적격성과 USD 체크아웃을 별도로 확인한다.

P0에는 체크아웃, 주문, 개인 카드 생성, 초대·합의·체크인, 저장, 배포가 없다. 운영 롤백은 필요하지 않다. 작업을 되돌릴 경우 Draft를 닫거나 P0 커밋을 작업 브랜치에서 되돌린다.
