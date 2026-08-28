import Link from "next/link";

const sections = [
  {
    title: "1. 처리 목적과 항목",
    body: (
      <>
        <p>초대제 계정 인증, 프로필·답변·매칭 해제 기능, 신고·차단·지원 처리, 보안과 오남용 방지를 위해 다음 정보를 처리합니다.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>계정: 이메일, 닉네임, 비밀번호 해시, 이메일 확인 상태</li>
          <li>기본 프로필: 닉네임, 본인이 선택한 남녀 구분, 입력 시점 만 나이, 시도 단위 활동 지역, 남녀 간 소개 범위 확인, 수집·이용 동의 버전·시각. 프로필 표시·소개 범위 제한·모집 집계에 사용하며, 나이·성별 자체가 인증된 정보라는 뜻은 아닙니다.</li>
          <li>인증 결과: 별도 테이블에 사용자 연결값, 무작위 요청 식별자, 프로필 버전, 인증사 식별값, 인증 안내 동의 버전과 요청·만료·확인 시각과 상태만 저장하도록 설계했습니다. 인증사 미연결 상태에서는 실명·전화번호를 수집하거나 인증문자를 발송하지 않습니다.</li>
          <li>서비스: 도시, 공개·비공개 프로필 문장, 질문 답변, 평가 결과, 고유 질문 노출 관계, UTC 일별 접속일, 메시지, 해제·차단·신고·지원 기록</li>
          <li>자동 생성: 세션, IP 주소, 사용자 에이전트, 접속·rate-limit 시각과 횟수</li>
          <li>알파 운영: 초대 이메일, 모집 cohort·유입 채널·선택한 첫 대화 역할의 불투명 수급 bucket, 동의 계약 버전·UTC 동의 날짜, 초대 상태와 코드 해시</li>
          <li>가입 게이트: 만 19세 이상 확인, 이용약관·Community Safety Rules 버전, 서버가 기록한 동의 시각</li>
          <li>대기 명단: 동의한 이메일, 유입 채널, 삭제용 capability 해시, 고유 재방문 날짜</li>
        </ul>
        <p className="mt-3">사진, 결제정보, 정밀 위치정보는 현재 Closed Alpha에서 수집하지 않습니다.</p>
        <p className="mt-3">질문과 메시지는 민감정보를 요구하도록 설계하지 않습니다. 종교·정치적 견해·건강·성생활 등 민감정보를 입력하지 않아도 서비스를 사용할 수 있으며, 실수로 입력한 경우 개인정보 문의로 삭제·처리정지를 요청할 수 있습니다.</p>
        <p className="mt-3">첫 대화 역할은 서울 수도권에서 일대일 로맨틱 대화를 원하는 성인의 Stage-1 수급 균형에만 사용합니다. 별도 질문에 선택적으로 답하고 해당 사용에 동의한 경우만 A/B로 집계하며, 이 역할 선택에서 성별·성적 지향·정체성을 추론하지 않습니다. 성별은 기본 프로필에서 본인이 별도로 선택하며, A/B 역할 집계와 남녀 집계는 분리합니다. 성적 지향은 질문하거나 인증하지 않습니다.</p>
      </>
    ),
  },
  {
    title: "2. 처리 근거, 보유 기간과 삭제",
    body: (
      <>
        <p>계정·서비스 제공, 이용자 요청 처리, 안전·보안·오남용 방지와 Closed Alpha 운영을 위해 필요한 범위에서 처리합니다. 별도 동의가 필요한 선택적 역할 집계는 약관·개인정보 고지와 분리된 버전 동의로 관리합니다.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>계정·프로필·답변·질문 노출·일별 접속·메시지·해제·차단·신고·지원 기록: 회원 탈퇴 시까지</li>
          <li>기본 프로필·인증 결과: 탈퇴 또는 ‘기본 정보 삭제·소개 참여 철회’ 버튼 사용 시 활성 DB에서 삭제합니다. 소개 범위 선택만 해제하고 저장하면 노출·대화를 중단하되 기본 정보는 삭제 요청 전까지 보관합니다. 수정 시 이전 인증을 무효화하고 삭제합니다. 기존 회원의 새 항목은 추정해 채우지 않습니다.</li>
          <li>실명·전화번호 원문: 본인인증 기능은 현재 비활성 상태입니다. 연결 후에는 인증사 화면에서 입력하며, 서버 결과 조회 과정에서 이름·전화번호·생년월일·CI/DI 등 인증사 응답을 메모리에서 일시 처리할 수 있습니다. 확인 후 원문은 별도 보관하지 않고, 회원 DB·애플리케이션 로그·브라우저 저장소에도 저장하지 않습니다. 인증 상태와 요청·동의 기록만 보관합니다. 이는 메모리의 즉각적인 보안 삭제나 외부 인증사 기록의 즉시 파기를 뜻하지 않습니다.</li>
          <li>인증 대기 요청: 10분 후 효력을 잃으며, 다음 인증 시작 시 만료된 대기 기록을 정리합니다. 만료는 즉시 물리적 삭제와 다르며, 보관되는 요청 기록에도 실명·전화번호·인증번호 원문은 없습니다.</li>
          <li>가입 게이트 증거: 계정 삭제 시 함께 삭제</li>
          <li>초대 기록: 탈퇴 시 해당 이메일·사용자 연결 기록 삭제</li>
          <li>대기 명단: 초대 안내 목적 종료 또는 삭제 요청 시까지. 등록한 브라우저에서 즉시 삭제 가능</li>
          <li>rate-limit 기록: 마지막 요청 후 최대 2일</li>
          <li>활성 데이터베이스에서는 계정 삭제 요청 완료 즉시 삭제하며, Neon 복구 이력에서는 최대 6시간 뒤 만료됩니다.</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. 처리 위탁과 국외 이전",
    body: (
      <>
        <p>서비스 제공 계약 이행에 필요한 처리위탁·보관을 위해 아래 수탁자가 정보를 처리합니다. 국외 이전을 원하지 않으면 서비스를 이용하지 않거나 계정 삭제를 요청할 수 있습니다. 이 경우 국외 인프라가 필요한 계정·메시지·대기 명단 서비스를 제공하기 어렵습니다.</p>
        <ul className="mt-3 list-disc space-y-3 pl-5">
          <li>
            <strong>Vercel, Inc.</strong>: 웹 호스팅·전송·운영 로그. 미국 등 글로벌 인프라로 서비스 이용 시 네트워크 이전. 계정 삭제 또는 계약상 보유기간까지. 문의는 <a className="underline underline-offset-4" href="mailto:privacy@vercel.com">privacy@vercel.com</a> 및 <a className="underline underline-offset-4" href="https://vercel.com/legal/privacy-notice" rel="noreferrer" target="_blank">Vercel Privacy Notice</a>.
          </li>
          <li>
            <strong>Neon cloud database service</strong>: 계정과 서비스 데이터베이스. 미국 AWS us-east-2(Ohio)로 서비스 이용 시 네트워크 이전. 계정 삭제 및 최대 6시간 복구 이력 만료까지. 문의는 <a className="underline underline-offset-4" href="https://neon.tech/privacy-policy" rel="noreferrer" target="_blank">Neon Privacy Policy의 Contact Us</a>.
          </li>
          <li>
            <strong>ImprovMX Incorporation</strong>: <a className="underline underline-offset-4" href="mailto:privacy@unstandard.app">privacy@unstandard.app</a> 수신 메일 전달. 미국·유럽의 인프라로 메일 수신 시 네트워크 이전. 메일 본문은 전달 또는 영구 반송 뒤 삭제하고, 최소 상세 전달 로그는 최대 7일, 전달 설정 변경 로그는 최대 365일 보관. 문의는 <a className="underline underline-offset-4" href="https://improvmx.com/transparency/privacy-policy/" rel="noreferrer" target="_blank">ImprovMX Privacy Policy</a>.
          </li>
          <li>
            <strong>Google LLC (Gmail)</strong>: 전달된 개인정보 문의의 수신·보관·응대. 미국 등 전 세계 인프라로 메일 전달 시 네트워크 이전. 문의 처리 완료 후 90일 이내 삭제하며, 분쟁 대응이나 법정 의무가 있으면 해당 기간까지 보관. 문의는 <a className="underline underline-offset-4" href="https://policies.google.com/privacy" rel="noreferrer" target="_blank">Google Privacy Policy</a>.
          </li>
        </ul>
        <p className="mt-3">수탁자, 국가·시기·방법, 이용 목적·보유기간이 바뀌면 시행 전에 이 페이지를 갱신합니다.</p>
        <p className="mt-3">본인인증 연동 준비 대상은 PortOne을 통한 다날 휴대폰 본인인증입니다. 현재 활성 수탁자로 추가했다는 뜻은 아닙니다. 실제 계약 당사자·처리 항목·보유기간·국외 이전 여부와 인증사 문의 경로를 확정해 고지하고, 로그 잔존 방지를 점검하기 전에는 본인인증을 활성화하지 않습니다. 인증사·통신사의 보관분까지 ‘확인 즉시 폐기’한다고 약속하지 않습니다.</p>
      </>
    ),
  },
  {
    title: "4. 이용자 권리와 행사 방법",
    body: (
      <>
        <p>기본 프로필 화면에서 새 기본 정보·인증 결과를 삭제하고 소개 참여를 철회할 수 있습니다. 이 경우 상대 노출·조회·대화가 제한되며 닉네임과 기존 대화 기록 등은 계정 삭제 전까지 남습니다. 설정에서 계정과 연결 데이터를 직접 삭제할 수 있습니다. 열람·정정·삭제·처리정지, 신고 후속조치 또는 개인정보 문의는 로그인 후 설정의 ‘지원·안전 요청’에서 접수해 주세요.</p>
        <p className="mt-3">로그인할 수 없거나 계정을 삭제한 뒤 요청하는 경우에도 <a className="underline underline-offset-4" href="mailto:privacy@unstandard.app">privacy@unstandard.app</a>으로 접수할 수 있습니다. 요청 확인에 필요한 최소 정보만 보내 주세요. 비밀번호·초대코드·세션 토큰은 보내지 마세요.</p>
        <p className="mt-3">계정 삭제에는 현재 비밀번호와 명시적 확인 문구가 필요하며, 완료 후 복구할 수 없습니다.</p>
        <p className="mt-3">첫 대화 역할 사용 동의는 선택 사항입니다. 초대 사용 전에는 철회 후 집계 제외 초대로 재발급할 수 있고, 사용 후에는 개인정보 담당자에게 정정·처리정지를 요청할 수 있습니다.</p>
      </>
    ),
  },
  {
    title: "5. 안전조치와 AI 고지",
    body: (
      <>
        <p>비밀번호 해시, 서버 전용 비밀정보, HTTPS, 세션·권한 검사, 최소권한 데이터 접근, 원자적 요청 제한, 신고·차단 절차와 배포·복구 증거 검증을 적용합니다.</p>
        <p className="mt-3">현재 Closed Alpha의 Depth Score는 질문·답변에 대한 결정론적 평가와 로컬/임베딩 PoC 범위이며, 사용자에게 생성형 AI가 만든 설명·코칭·추천 문장을 제공하지 않습니다. 향후 생성형 AI 결과물을 제공하면 사용 전에 별도 고지·표시를 추가합니다.</p>
        <p className="mt-3">대기 명단 이메일은 초대·서비스 운영 목적에만 사용하며, 별도 근거 없이 홍보성 메일로 재사용하지 않습니다.</p>
      </>
    ),
  },
  {
    title: "6. 책임자와 문의",
    body: (
      <>
        <p><strong>개인정보 보호책임자 및 고충처리 담당:</strong> Founder · seonghyeonist</p>
        <p className="mt-1"><strong>로그인 사용자 접수:</strong> 앱 설정 → 지원·안전 요청 (개인정보 분류)</p>
        <p className="mt-1"><strong>로그아웃·탈퇴 사용자 접수:</strong> <a className="underline underline-offset-4" href="mailto:privacy@unstandard.app">privacy@unstandard.app</a></p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-8">
      <nav className="mb-10 flex items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-[-0.04em]">unstandard</Link>
        <Link href="/app/settings" className="text-sm font-semibold text-accent">설정</Link>
      </nav>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">effective on profile-feature deployment</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.06em]">개인정보 처리방침</h1>
      <p className="mt-5 text-base leading-7 text-foreground/75">
        Unstandard Closed Alpha의 실제 수집·보유·삭제·국외 이전 범위를 설명합니다. 처리 항목이나 수탁자가 바뀌면 시행 전에 이 페이지를 갱신합니다.
      </p>
      <div className="mt-10 space-y-9 text-sm leading-7 text-foreground/75">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-black tracking-[-0.03em] text-foreground">{section.title}</h2>
            <div className="mt-3">{section.body}</div>
          </section>
        ))}
        <section>
          <h2 className="text-xl font-black tracking-[-0.03em] text-foreground">7. 관련 기준</h2>
          <p className="mt-3">이 방침은 개인정보보호위원회의 2026 처리방침 작성지침과 개인정보 보호법을 참고해 작성했습니다. 최종 법률 판단은 사업 형태·계약·실제 운영 사실을 함께 검토해야 합니다.</p>
          <div className="mt-3 flex flex-col gap-2">
            <a className="underline underline-offset-4" href="https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=D010030000.Updated&nttId=12018" rel="noreferrer" target="_blank">개인정보보호위원회 2026 처리방침 작성지침</a>
            <a className="underline underline-offset-4" href="https://www.law.go.kr/lsInfoP.do?lsiSeq=283839" rel="noreferrer" target="_blank">개인정보 보호법</a>
          </div>
        </section>
      </div>
    </main>
  );
}
