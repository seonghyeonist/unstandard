# MANUAL TEST CHECKLIST — Depth Score mock & answer persistence

프론트엔드에 자동 테스트 러너/프레임워크가 아직 없습니다(의존성 추가는 승인 전 금지).
그래서 아래 **수동 체크리스트**로 검증합니다. 대상 코드:

- `lib/depth/evaluate-depth-answer.ts` — 결정론적 mock(`mock-local-heuristic-v0.0`, AI 아님)
- `lib/api/onboarding.ts` + `lib/api/onboarding-store.ts` — 온보딩 답변 영속화
- `lib/api/answers.ts` — 잠금해제 답변 평가

## A. Depth Score mock — 순수 함수 단위 케이스

`evaluateDepthAnswer({ questionText, answerText })`의 기대 결과. (점수/내부 path는 **사용자에게 노출되지 않으며**, 검증용일 뿐입니다.)

| # | answerText | 기대 verdict |
|---|-----------|--------------|
| 1 | `""` (빈 답) | `REJECT` |
| 2 | `ㅋㅋㅋ` | `REJECT` 또는 `REVIEW` (PASS 아님) |
| 3 | `효율보다 사람이 먼저.` | `PASS` 또는 FAST_TRACK |
| 4 | 길지만 일반적인 답 (`그냥 보통 평범…`) | `REVIEW` 또는 `REJECT` |
| 5 | 구체적·개인적인 답 (`어제 편의점 앞에서 길고양이가…`) | `PASS` |
| 6 | 반복 기호/이모지 (`😀😀😀!!!`) | `REJECT` |

> 위 6개는 개발 중 실제 함수를 컴파일해 실행 검증 완료(모두 통과). 의존성 없이 다시 확인하려면
> 순수 함수라 단일 파일을 `npx tsc`로 임시 컴파일 후 Node로 호출하면 됩니다(임시 검증용, 레포에 추가하지 않음).

## B. 온보딩 답변 영속화 (브라우저 수동)

1. `NEXT_PUBLIC_API_BASE_URL= npm run dev` 로 standalone 실행 → `http://localhost:3000`.
2. `/login` → "세션 시작하기" → `/onboarding`.
3. 닉네임 + 답변(20자 이상) 입력 후 "시작하기".
4. DevTools → Application → Session Storage → `unstandard.alpha.onboarding` 키 확인.
   - [ ] `answerText`에 입력한 답변이 **그대로 저장**되어 있다(이전엔 버려졌음).
   - [ ] `questionId` / `questionText` / `userId` / `createdAt` 존재.
   - [ ] `evaluation.modelVersion === "mock-local-heuristic-v0.0"`.

## C. 잠금해제 답변 평가 (브라우저 수동)

1. `/app/home`에서 후보 선택 → 답변 화면.
2. 케이스별 입력 후 "답 보내기":
   - [ ] 빈/너무 짧은 답 → "너무 짧아서 아직 잘 보이지 않아요." (REJECT)
   - [ ] 애매한 답 → "조금 더 당신답게 적어볼까요?" (REVIEW)
   - [ ] 구체적·감정 있는 답 → "이 사람의 세계가 보이기 시작해요." + 잠금해제 (PASS)
3. 사용자 노출 문구 점검:
   - [ ] 화면에 **점수/임계값/"Depth Score"/내부 path 명칭이 보이지 않는다.**

## D. 회귀 (CI 게이트)

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run check`
