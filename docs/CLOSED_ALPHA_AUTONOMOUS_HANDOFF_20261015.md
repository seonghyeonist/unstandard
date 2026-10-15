# UNSTANDARD — Closed Alpha Full-Cycle Autonomous Closure Handoff
> 기준: 2026-10-15 KST / classification: PUBLIC-SAFE OPERATIONAL INSTRUCTIONS (no credentials or member IDs)
> Source release: `4cf4338c95a390b956cddd3ca1817fe8fb5327d9`
> Document branch: `agent/closed-alpha-closure-handoff-20261015` (documentation only; **NOT** Production SHA or PR #92 HEAD)

## EXECUTION MANDATE: DO THE WORK
너는 UNSTANDARD Closed Alpha의 실제 실행 담당 에이전트다. 창업자는 Production 배포·Didit Live 구성을 이미 승인했다. 계획만 세우지 말고, 읽기 전용 검증 → 필요한 최소 수정 → 검사 → 증거 기록 → 정리까지 수행하라. **인간이 수행한 사실이 없는 테스트를 PASS로 위조하지 말 것.** 특정 작업이 막혀도 다른 독립 항목을 진행할 것. 날짜·SHA·게이트 증거의 적용 범위를 정확히 구분할 것.

### A. 가장 먼저 버려야 할 잘못된 가정 12개
1. Production은 미배포가 아니다. `dpl_8yLrAn6sy2WccABGQxhZDCF12frU` READY; canonical `unstandard.app`; SHA `4cf4338c95a390b956cddd3ca1817fe8fb5327d9`.
2. PR #92는 여전히 OPEN/DRAFT/unmerged이고 main은 `30d0c78ee19d652fed2bedcae7271931f8f04b31`. Production SHA와 main SHA가 다른 것은 사실이며 자동 오류라고 추정하지 않는다.
3. 기존 Live 공급자 서명 Not Started 합성 발송은 HTTP 200 / NO_PENDING_REQUEST safe-ignore로 통과했다. 실제 사람의 성공 KYC는 검증되지 않았다.
4. 정상 로그인/리로드 증거는 **Production 미인증 회원 세션**에 한정한다. verified-member home / Live Approved decision + purge E2E는 미검증이다.
5. Production Neon은 Free가 아니라 Launch (`launch_v3`), main `br-bitter-wave-ajs8dy0u`는 primary/default/protected=true다.
6. Production read-only 집계는 2026-10-15 재조회 기준 users=5, profiles=5, identity_verifications=0, purge_queue=0이다. 실제 사용자를 테스트에서 변경하지 말라.
7. CI #283 / Rebuild #223 SUCCESS는 **위 Production source SHA**에 대한 증거다. 새로운 문서 브랜치 SHA와 혼동하지 말라.
8. Production readiness 10/10 PASS와 공식 모집 gate 10/11은 서로 다른 계약이다. 10/11의 실패는 `OPERATIONAL_EVIDENCE_MISSING_OR_PLACEHOLDER`.
9. 운영 입력의 기존 13 boolean true는 실제 근거가 있지만, 도메인 evidence 구조체의 상표·소셜·실제 사람 철자 항목은 비어 있다.
10. 최초 Stage 1 상한은 50명이다. 문서의 옛 50–200명 표현을 자동으로 적용하지 말라.
11. 제품 지표는 `COLLECTING`; 모집 전 D7 성공률을 요구하여 자기모순에 빠지지 말라. 제품 성과 미확인은 인프라 실패가 아니다.
12. `AGENTS.md`, `CLOSED_ALPHA_STAGE1_RUNBOOK.md`, `DOMAIN_AUDIT_20260821.md`의 날짜가 오래된 baseline 행들은 **역사적 관측**이다. 새 배포/DB 상태를 소급해서 덮어쓰지 않는다.

### B. 식별자와 증거 출처
- Repo: `seonghyeonist/unstandard`; PR: https://github.com/seonghyeonist/unstandard/pull/92; tracking Issue: https://github.com/seonghyeonist/unstandard/issues/93
- 마지막 엄밀한 Production closure evidence: https://github.com/seonghyeonist/unstandard/issues/93#issuecomment-6183313437
- Deploy: `dpl_8yLrAn6sy2WccABGQxhZDCF12frU` (Production); Vercel project `prj_9RHqHMFTeB0c2V3LGlAdTezmvcYn`, team `team_E2i0VO9zm0ksZmTN3XEDD2JH`
- Prev rollback candidate: `dpl_9znHGVpdgDdsKdnZ9keEMYBrMMiE` — rollback is not automatic; **credentials within immutable deploy may be older**.
- Neon: project `raspy-fog-00907976`, production branch `br-bitter-wave-ajs8dy0u`, database `neondb`, DB host fingerprint `fa86792b8117`.
- RC: `br-still-bar-ajx7wl9d`, DB `unstandard_rc_it_20260929_0940a`, expiry 2026-10-31T20:00:00Z (Nov 1 05:00 KST).
- Isolated auth test: `br-quiet-mode-ajmtz198`, DB `unstandard_auth_test_20261011`, expiry 2026-10-19T23:59:00Z (Oct 20 08:59 KST). **같은 branch의 neondb에는 inherited real member rows가 있을 수 있음**.
- Latest historical restore evidence: https://github.com/seonghyeonist/unstandard/issues/93#issuecomment-6073196906, checksum correction #6073220991; recorded completedAt `2026-10-09T02:45:11Z`. 7-day conservatively expires around 2026-10-16 11:45:11 KST.
- Read-only Prod counts rechecked 2026-10-15. PR source commit CI #283 / Rebuild #223 both SUCCESS. Vercel Production env key metadata includes Production-only `RESEND_API_KEY`, `DIDIT_WEBHOOK_SECRET`, `UNSTANDARD_DEBUG_CHECK_TOKEN`; **do not decrypt or display their values**.
- Google mailbox receipt historically established once at 2026-10-15T02:22:05Z on preceding Production deployment. Reset link never opened. Do not publish token-bearing mailbox snippets.

### C. Actionable execution graph (priority and success conditions)
**T00 — Time/source lock [P0, read-only].** Establish current KST/UTC. Fetch PR #92 head, main SHA, CI runs, current canonical Vercel deployment alias/deploy SHA, Neon owner subscription + branch protection, current Issue #93 latest evidence. Create `observedAt`; never call old evidence fresh. PASS = exact currently observed identity table and any drift assessed.

**T01 — New deployment runtime triage [P0, read-only].** Vercel grouped error query may show historical `identity.webhook.signature_invalid` attributed to rollback deployment `dpl_9zn...`, 1 cluster. Do not call it new Production failure without confirming deployment/time. Per-deploy logs beyond Hobby retention may give 400; retry only `since=30m`, and classify `NO_LOGS_IN_WINDOW` distinct from `NO_ERROR`. If actual latest SHA shows reproduced errors, correlate route/time before patch.

**T02 — Safe code-change decision [P0].** If no reproduced app bug, do **not** modify application code or rotate production secrets for appearance. If bug exists: isolate root cause/file, smallest patch, regression test, lint/typecheck/tests/build, CI, exact-head Preview, controlled Production ONLY if necessary, readiness re-run, rollback ID. No base-branch force push/reset; no schema migration to production on speculation.

**T03 — Brand clearance scope [P0].** Read `docs/DOMAIN_AUDIT_20260821.md`. Old exact query 0 hits is **not** clearance. Official KIPRIS service: https://www.kipris.or.kr/ ; search exact `UNSTANDARD`, `언스탠다드`, and spacing/phonetic/wildcard similarities `UNSTAND*`, `UN-STANDARD`, `NONSTANDARD`, `SUBSTANDARD`. Record each date, query, domestic/foreign jurisdiction, class, status, likely confusion, clickable official record ID, finding, reviewer. Relevant potential classes: 45 (internet dating/matchmaking/personal introductions; official EUIPO TMclass), 42 (SaaS), and 9 (downloadable app **only if applicable**). Classification shortlist is **not legal opinion**. If KIPRIS 5xx, document tool/network unavailability, use legitimate alternative official search/access, never bypass blocks or claim zero results. Any material similar mark => ESCALATE/STOP brand PASS, not unilateral clearance. Counsel or suitably qualified decision record required by existing audit.

**T04 — Social handle evidence [P0].** Define exact approved handles by brand channel: Instagram, Threads, X, TikTok, YouTube. For EACH: requested handle, canonical platform search/profile URL, observation timestamp, `OWNED` / `AVAILABLE_UNVERIFIED` / `CONFLICT` / `WAIVED_BY_FOUNDER` / `NOT_CHECKED`, method (authenticated account settings vs public lookup), evidence link. 404/profile not found != verified availability or ownership. Do not open/sign up accounts or agree to new platform terms without specific confirmation. Brand audit references an unrelated clothing handle; don't claim that every "unstandard" use is same entity.

**T05 — Five-human pronunciation/spelling pilot [P0].** Must use actual consenting people; AI answers and invented respondents forbidden. Create two-stage blind test: (a) show "Unstandard" once, ask for Korean pronunciation, one-line meaning, and whether same as existing brand; (b) verbally give "언스탠다드" without visual cue, ask English spelling, recall after distraction. Use pre-specified rubric: exact spelling, acceptable pronunciation, brand-confusion instances, ambiguous/negative associations. Log sample count, recruitment method, date, question form, anonymized individual yes/no columns only, aggregate (n/exact/near/confused), caveats; no name, contact, voice recording, identifiers. Suggested n=5 follows existing internal audit, not universal legal obligation. Only actually completed pilot can produce `pronunciationSpellingReview=PASS` after review. Draft participant message in a private artifact; do not unsolicited email/DM unspecified recipients. If access unavailable: `BLOCKED_REAL_HUMAN_INPUT` and continue T06–T13.

**T06 — Domain ownership [P0].** Preserve verified registrar Vercel acquisition evidence of `unstandard.app`. Do not purchase again. Domain acquisition is not trademark clearance, platform handle proof or human spelling test.

**T07 — Formal attestation [P0].** Read `lib/operations/closed-alpha-gate.ts` and the actual private attestation input (not `config/closed-alpha-attestation.example.json`). Keep 13 evidence-backed booleans, 50 cap, 240 minute response objective, original support SLA breach, rollback and restore dates. Update `evidence.domain.trademarkReview` to `NO_BLOCKING_CONFLICT_FOUND` ONLY after T03 is actually substantiated; handle reference only after T04; spelling review `PASS` ONLY after T05; never insert fake placeholder strings to game `isSubstantive`. If founder explicitly changes internal gate policy, track that as **reviewable policy change and new tests**; generic previous Production approval is not explicit brand-evidence waiver.

**T08 — Production authenticated readiness [P0].** If the existing technical evidence is still ≤6h old it is valid for formal gate; underlying Production verifier raw source freshness is 15m when freshly generating. If stale and secure runner credential is legitimately available, run:
```bash
UNSTANDARD_PRODUCTION_BASE_URL=https://unstandard.app \
UNSTANDARD_DEBUG_CHECK_TOKEN=<secure-injected-value> \
UNSTANDARD_EXPECTED_PRODUCTION_GIT_SHA=<CURRENT_FULL_PRODUCTION_SHA> \
UNSTANDARD_EXPECTED_PRODUCTION_DB_HOST_SHA12=<CURRENT_READONLY_FINGERPRINT> \
UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_OUT=<PRIVATE_NEW_PATH> \
npm run operations:production:verify
```
Never paste token or DB URL into chat, GitHub, logs or report. Sensitive env APIs may not return decrypted values; absence of read access is not proof the secret is absent. Require exact 10 codes, exit 0, gitSha and DB fingerprint match. If no secure runner, `BLOCKED_RUNNER_SECRET`; do not fabricate verifier output or rotate for no cause.

**T09 — Formal launch gate [P0].** With current technical evidence and substantive attestation:
```bash
UNSTANDARD_PRODUCTION_READINESS_EVIDENCE_PATH=<PRIVATE_EVIDENCE_JSON> \
UNSTANDARD_CLOSED_ALPHA_ATTESTATION_PATH=<PRIVATE_ACTUAL_ATTESTATION_JSON> \
UNSTANDARD_CLOSED_ALPHA_GATE_OUT=<PRIVATE_NEW_RESULT_PATH> \
npm run operations:closed-alpha:gate
```
Expected if T03–T05 incomplete = 10 PASS/1 FAIL; this is **not** a justification to weaken verifier. Only exit 0, 11/11 genuine PASS, artifact digest/integrity, correct SHA/host and reviewer evidence may mark `FORMAL_OPERATIONAL_GATE=PASS`.

**T10 — Restore freshness [P1, deadline].** Verify 7-day clock against 2026-10-09T02:45:11Z posted completion proof (conservative). Once stale, conduct *new* isolated synthetic restore into disposable empty project/branch and prove **every database in the branch** has zero real member rows before cloning. Verify marker restored, baseline returned and cleanup, record actual finish timestamp and checksums. NEVER restore/reset/delete Production. Avoid cloning child branch containing inherited Production members as an "empty" fixture. If tooling disallows safe isolation, record blocker and keep recruitment paused.

**T11 — Auth lifecycle/deletion [P1].** Existing 10/10 isolated password signup/login and deletion/cascade harness PASS is historical, not Production-user destructive proof. Do not delete real users, do not recycle RC member passwords, do not mutate identity statuses. Re-run only if contract changed, freshness demanded or actual P0 regression; use empty synthetic DB with zero-real-user assurance.

**T12 — Didit Live [P1].** Official signed Not Started synthetic → HTTP 200 and `NO_PENDING_REQUEST` safe-ignore already proven. Do not require another KYC from founder or copy verified Sandbox state into Live. Only retest if signature, workflow, environment or handler changes. A new real Approved KYC/canonical/purge scenario must be independently evidenced and clearly distinguished from safe-ignore; never forge provider events with app secret or send PII-filled samples.

**T13 — Member session [P1].** Prior successful normal member sign-in, protected setup navigation, refresh and settings survives as historical PASS for one existing unverified Production member. A later session expiry does not negate prior PASS. Verified-member home remains NOT_RUN; attempt controlled authorized path if naturally accessible, not via DB identity edits or compulsory new KYC.

**T14 — Release proof [P0 if changed].** On any app code/config change, execute `npm run check`, `npm run guard:boundaries`, `npm run guard:no-legacy-backend`; check CI/Rebuild exact new SHA; Vercel latest Production = exact approved tested SHA; migration ledger exactly 16 and 28 required app tables if no migration planned. Preview tests aren't automatically Production proof. New SHA invalidates old exact-head assertions until retested.

**T15 — Privacy/support/rate-limit/cap [P1].** Verify /privacy, consent notice versions, in-app support availability, emergency invitation pause, abuse-report/moderation owner, rate-limit policy `closed-alpha-v3`, monetization disabled, 50-seat trigger. Historical support first response violated 240-minute objective; do not rewrite SLA history. If founder unavailable for response objective, keep invites paused.

**T16 — Alpha instrumentation [P1].** Run `npm run alpha:metrics` read-only on legit production config only. Check cohort, channel, seat cap, question response, onboarding, first-unlock median, D7 sample maturity, waitlist revisit, supply-balance coverage. Distinguish instrumented from product success; 0/50 occupied and `COLLECTING` as reported, subject to new observation. Do not build payment, Local AI engine, beta staged reveal or unrelated platform expansion as this phase's blockers.

**T17 — Recruitment start [hard-gated action].** Do not claim performed until formal gate genuine PASS, owner/support availability, rate-limit/cap/monitoring verified and founder's approved recruitment scope is known. Use explicit consent and whitelisted existing channels; only invite chosen consenting users, daily cohort/balance controls, pause on P0. No unsolicited Gmail outreach, paid spend or mass blast from an inferred audience. `PUBLIC_RECRUITMENT=NOT_EXECUTED` until real invite/post action.

**T18 — Persist result [required].** Write 6-part final report: (1) technical/operational/recruitment verdict, (2) FRESH vs HISTORICAL vs NOT_RUN evidence, (3) changes+diff+CI, (4) full SHA/deployment/Neon identity, (5) remaining exact tasks with blockers/input/next command/deadlines, (6) actual approvals/deploy/recruitment state. Post **sanitized** Issue #93 checkpoint only for new work, never support UUID, auth reset URL, credentials, name/email, KYC payload. Store full private artifact in approved private location only.

### D. Severity, independence and scope
- P0 BLOCKER: conflicting current Production origin/SHA/DB, security or deletion critical regression, real signed-provider processing defect, member loss, formal brand evidence missing when contemplating public recruitment.
- P1 REQUIRED AFTER EVIDENCE EXPIRY: new private verifier, isolated recovery drill, updated support/operational review.
- P2 LATER: Local AI PoC, broad UI refinements, beta 25–39 staged reveal, monetization. None are new Alpha prerequisites.
- Execute independent T00–T04/T06/T15/T16 while waiting for external T05; do not stop entire task.
- Gate outcomes: `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, `NOT_RUN`, `COLLECTING`. Report source-specific freshness and avoid the word "all done" when formal gate is incomplete.

### E. Quick decision tree for junior models
IF Production HEAD/alias/Neon differ from B → investigate drift BEFORE write.
ELSE IF actual P0 code failure reproducible → smallest fix + test + deployment as T14.
ELSE → **NO APP CODE CHANGE**.
IF any one of trademark/social/real-human evidence missing → formal launch remains `NOT_READY`, even when 13 booleans true.
IF brand evidence substantiated → refresh technical evidence if needed → run original gate → only verified success leads toward curated invitations.
IF restoration evidence older than 7 days → new synthetic empty isolation and record actual finish time; do not rewrite old timestamps.
IF no authorized person to gather 5 real human responses → prepare exact survey and status `BLOCKED_REAL_HUMAN_INPUT`; do not fabricate.
IF provider test previously PASS and no relevant change → do not demand Didit repeat from founder.
IF logs are unavailable due to retention → `LOGS_UNAVAILABLE` (never `PASS_NO_ERRORS`).

### F. Permitted vs prohibited write operations
PERMITTED within standing authorization: read-only inspections; safe documentation updates in a separate branch; necessary tested code repairs with rollback; approved deployment/config remedial actions; synthetic empty-data testing; evidence record.
PROHIBITED without action-specific authorization: production DB destructive DDL/DML, deleting real members, resetting passwords, sending unsolicited email/DM, buying new domains, signing new third-party terms, bypassing provider authentication, forged human responses, fabricated provider signatures, removing launch policy checks merely to obtain green output, force-pushing main.

### G. Sources and precedence
1. Fresh provider GitHub/Vercel/Neon observed state (precise scope/timestamp).
2. Exact release source code and immutable CI artifacts.
3. Latest Issue #93 post at 2026-10-15 #6183313437 and founder-approved execution report.
4. Source planning documents: MVP v4.1/v4.2, AI Agent Harness v0.1, Alpha/Beta Stage Reveal Change Note v0.1; classify PoC/strategic plans separately.
5. Historical snapshots in AGENTS.md / 2026-08 runbooks have **no power to override** current external state.

End-state target: Production genuinely safe + operational gate with authentic evidence + authorized limited recruitment, not maximum lines of code. Do not substitute a polished report for execution.
