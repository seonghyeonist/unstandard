## 변경 사항

<!-- 이 PR에서 변경한 내용을 간결하게 설명해 주세요 -->



## 관련 이슈

<!-- 관련 이슈 번호를 링크해 주세요 (없으면 삭제) -->
- Closes #

## 변경 유형

- [ ] 🆕 새 기능 (feat)
- [ ] 🐛 버그 수정 (fix)
- [ ] 📝 문서 수정 (docs)
- [ ] 🔧 설정/도구 (chore)
- [ ] ♻️ 리팩터링 (refactor)
- [ ] 🧪 테스트 (test)

## 변경 파일 목록

<!-- 주요 변경 파일을 나열해 주세요 -->
| 파일 | 변경 내용 |
|------|-----------|
| | |

## 테스트 결과

```bash
# 실행한 테스트 명령과 결과를 붙여넣어 주세요
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run check
npm audit --audit-level=moderate
```

> 알려진 moderate advisory: Next.js 번들 postcss (`GHSA-qx2v-qp2m-jg93`). `npm audit fix --force`는 Next major 다운그레이드를 유발하므로 사용하지 않습니다.

## 롤백 방법

<!-- 이 변경을 되돌려야 할 때 어떻게 하면 되는지 -->



## 스크린샷 (UI 변경 시)

<!-- UI 변경이 있다면 before/after 스크린샷을 첨부해 주세요 -->

## 체크리스트

- [ ] 커밋 메시지가 컨벤션을 따르는가 (`feat:`, `fix:` 등)
- [ ] 의도하지 않은 파일이 변경되지 않았는가
- [ ] `.env` 또는 시크릿이 코드에 노출되지 않았는가
- [ ] 불필요한 리팩터링/제품 동작 변경이 섞이지 않았는가
- [ ] `npm ci` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run typecheck` 통과
- [ ] `npm run test` 통과
- [ ] `npm run build` 통과
- [ ] `npm run check` 통과
- [ ] `npm audit --audit-level=moderate` 확인 (알려진 Next/postcss moderate만 허용)
- [ ] UI 변경 시 스크린샷/녹화 등 확인 자료를 첨부했는가 (해당 시)
- [ ] (보안 관련) 악마의 대변인 리뷰 통과
