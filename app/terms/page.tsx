import Link from "next/link";

const terms = [
  {
    title: "1. Closed Alpha 범위",
    body: "Unstandard Closed Alpha는 초대받은 성인만 참여하는 제한된 테스트입니다. 기능, 질문, 매칭 노출, 운영 기간은 예고 없이 변경되거나 중단될 수 있습니다.",
  },
  {
    title: "2. 계정과 성인 이용",
    body: "계정 정보는 본인이 관리해야 하며, 가입 시 만 19세 이상임을 확인해야 합니다. 타인의 계정·초대코드를 사용하거나 사칭해서는 안 됩니다.",
  },
  {
    title: "3. 금지 행위",
    body: "협박, 괴롭힘, 반복적인 원치 않는 연락, 사기·스팸, 불법 콘텐츠, 타인의 개인정보 무단 공유, 취약점을 이용한 접근, 운영자나 다른 사용자를 속이는 행위를 금지합니다.",
  },
  {
    title: "4. 신고·차단과 제한",
    body: "사용자는 차단·신고 기능을 이용할 수 있습니다. Unstandard는 신고와 운영 증거를 검토해 노출·메시지·계정 접근을 제한하거나 계정을 종료할 수 있습니다. 신고가 접수되었다는 이유만으로 자동 제재하지는 않습니다.",
  },
  {
    title: "5. 테스트 데이터와 삭제",
    body: "처리 항목, 보유기간, 삭제 방법은 개인정보 처리방침에 따릅니다. 계정 삭제는 설정에서 요청할 수 있으며, Closed Alpha 데이터와 운영 정책을 검증하기 위한 기록은 법령과 처리방침 범위 안에서 관리합니다.",
  },
  {
    title: "6. 문의",
    body: "서비스 안전·계정·개인정보 문의는 로그인 후 설정의 지원·안전 요청에서 접수할 수 있습니다. 로그인할 수 없는 개인정보 요청은 privacy@unstandard.app으로 보내 주세요.",
  },
];

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-8">
      <nav className="mb-10 flex items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-[-0.04em]">unstandard</Link>
        <Link href="/register" className="text-sm font-semibold text-accent">가입</Link>
      </nav>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">closed-alpha-terms-v1 · effective 2026-08-21</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.06em]">이용약관</h1>
      <p className="mt-5 text-base leading-7 text-foreground/75">
        이 문서는 Closed Alpha Stage 1의 참여 조건과 커뮤니티 운영 기준을 설명합니다. 가입 전에 읽고 동의해 주세요.
      </p>
      <div className="mt-10 space-y-9 text-sm leading-7 text-foreground/75">
        {terms.map((section) => (
          <section key={section.title}>
            <h2 className="text-xl font-black tracking-[-0.03em] text-foreground">{section.title}</h2>
            <p className="mt-3">{section.body}</p>
          </section>
        ))}
        <p>
          관련 안전 규칙은 <Link className="underline underline-offset-4" href="/safety">Community Safety Rules</Link>에서 확인할 수 있습니다. 개인정보 처리방침은 <Link className="underline underline-offset-4" href="/privacy">여기</Link>에 있습니다.
        </p>
      </div>
    </main>
  );
}
