# Contributing to Unstandard

Unstandard에 기여해 주셔서 감사합니다.
이 문서는 프로젝트의 개발 규칙과 AI 에이전트 운영 원칙을 정리합니다.

---

## 브랜치 규칙

### 네이밍 컨벤션

| 접두어 | 용도 | 예시 |
|--------|------|------|
| `feat/` | 새 기능 | `feat/onboarding-question` |
| `fix/` | 버그 수정 | `fix/auth-redirect` |
| `docs/` | 문서 수정 | `docs/update-readme` |
| `chore/` | 설정/도구 | `chore/eslint-config` |
| `refactor/` | 코드 개선 | `refactor/depth-score-util` |
| `test/` | 테스트 | `test/auth-flow` |

### 브랜치 흐름

1. `dev`에서 기능 브랜치를 생성
2. 기능 브랜치에서 작업
3. lint/build/test 통과 확인
4. `dev`로 머지 (또는 PR)
5. `dev` → `main` 머지는 배포 준비 완료 시에만

```bash
# 기능 브랜치 생성
git checkout dev
git pull origin dev
git checkout -b feat/my-feature

# 작업 완료 후
git add .
git commit -m "feat: add my feature"
git push origin feat/my-feature
```

---

## 커밋 메시지 컨벤션

### 형식
```
<type>: <description>
```

### 타입

| 타입 | 용도 |
|------|------|
| `feat` | 새 기능 추가 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `chore` | 빌드/설정 변경 |
| `refactor` | 기능 변경 없는 코드 구조 개선 |
| `test` | 테스트 추가/수정 |

### 좋은 예시
```
feat: add onboarding question page
fix: resolve login redirect loop on mobile
docs: add environment variable documentation
chore: configure ESLint strict mode
refactor: extract depth score calculation to utility
test: add unit tests for auth middleware
```

### 나쁜 예시
```
update files          ← 무엇을 업데이트했는지 불명
fix stuff             ← 무엇을 고쳤는지 불명
WIP                   ← 완성되지 않은 커밋
asdfasdf              ← 의미 없음
```

---

## AI 에이전트 운영 원칙

### 절대 규칙

> ⚠️ AI 코딩 에이전트는 유능한 인턴이지만, 통제하지 않으면 프로젝트를 갈아엎습니다.

1. **1 브랜치 = 1 기능 = 1 AI 에이전트**
   - 여러 AI가 같은 브랜치에서 동시에 작업하지 않는다
2. **한 번에 하나의 기능만** 구현
3. **전체 리팩터링 금지** — 별도 브랜치 + 명시적 승인 필요
4. **파일 삭제 금지** — 삭제 전 이유와 영향 범위 설명 필수
5. **DB 스키마 변경 금지** — migration plan 먼저 제출
6. **시크릿 하드코딩 금지** — .env, API key, token 등
7. **빌드 깨진 상태로 종료 금지** — npm run build 통과 필수

### AI에게 요구하는 작업 순서

```
1. 진단 (무엇이 문제인가)
2. 구현 계획 (어떻게 고칠 것인가)
3. 변경 예정 파일 목록
4. 위험도 판단
5. --- 승인 후 ---
6. 코드 수정
7. 테스트 명령 제공
8. 변경 파일 요약
9. 롤백 방법
```

### AI 작업 후 체크리스트

- [ ] `git diff --stat`으로 변경 범위 확인
- [ ] 의도하지 않은 파일이 변경되지 않았는가
- [ ] `.env` 또는 시크릿이 코드에 노출되지 않았는가
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과
- [ ] 커밋 메시지가 컨벤션을 따르는가

---

## PR 규칙

1. PR 제목은 커밋 컨벤션과 동일한 형식 사용
2. PR 템플릿의 모든 항목을 작성
3. UI 변경 시 스크린샷 첨부
4. 보안 관련 변경은 악마의 대변인 리뷰 프롬프트 실행 결과 첨부

---

## 코드 스타일

- TypeScript strict 모드 유지
- ESLint 규칙 준수
- 단순하고 지루하고 유지보수 가능한 코드 > 영리한 추상화
- 컴포넌트가 너무 커지면 분리
- 비즈니스 룰은 UI 파일 밖으로 분리

---

## 보안 원칙

- 환경변수는 `.env.local`에만 저장
- `DATABASE_URL`, `BETTER_AUTH_SECRET`는 절대 클라이언트에 노출 금지
- `NEXT_PUBLIC_` 접두어가 붙은 변수만 클라이언트에서 접근 가능
- 애플리케이션 authorization + SQL constraints 필수 검토
- Markdown 렌더링 시 XSS 방지 확인
- 배포 전 악마의 대변인 검증 프롬프트 실행
