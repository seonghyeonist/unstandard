import Link from "next/link";

const rules = [
  "상대방의 동의 없는 반복 연락, 모욕, 성적 괴롭힘, 협박을 하지 않습니다.",
  "실명·연락처·주소·계정 정보·대화 캡처 등 타인의 개인정보를 공개하거나 요구하지 않습니다.",
  "사칭, 사기, 금전 요구, 스팸, 자동화된 대량 접촉을 하지 않습니다.",
  "불법 콘텐츠, 미성년자와 관련된 성적 접근, 자해·타해를 조장하는 내용을 공유하지 않습니다.",
  "불편하거나 위험하다고 느끼면 먼저 차단하고 신고합니다. 긴급한 위험은 지역 응급·수사기관에 직접 연락합니다.",
];

export default function SafetyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-8">
      <nav className="mb-10 flex items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-[-0.04em]">unstandard</Link>
        <Link href="/register" className="text-sm font-semibold text-accent">가입</Link>
      </nav>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">closed-alpha-safety-v1 · effective 2026-08-21</p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.06em]">Community Safety Rules</h1>
      <p className="mt-5 text-base leading-7 text-foreground/75">
        Unstandard는 첫 대화를 천천히 시작하는 성인용 Closed Alpha입니다. 아래 규칙을 지키지 않으면 노출·메시지·계정 접근이 제한될 수 있습니다.
      </p>
      <ul className="mt-10 list-disc space-y-4 pl-5 text-sm leading-7 text-foreground/75">
        {rules.map((rule) => <li key={rule}>{rule}</li>)}
      </ul>
      <section className="mt-10 space-y-3 text-sm leading-7 text-foreground/75">
        <h2 className="text-xl font-black tracking-[-0.03em] text-foreground">신고와 운영 처리</h2>
        <p>앱의 신고·차단 기능 또는 설정의 지원·안전 요청을 사용해 주세요. 운영자는 신고를 P0(즉시 안전·개인정보·권한 문제), P1(괴롭힘·반복 접촉·스팸), P2(일반 문의)로 분류하고, Stage 1 목표 응답시간은 240분입니다.</p>
        <p>신고가 접수되었다는 사실만으로 상대방을 자동 제재하지 않습니다. 다만 즉각적인 안전 위험이나 권한 침해가 확인되면 신규 초대를 중단하고 필요한 보호 조치를 시행합니다.</p>
      </section>
      <p className="mt-10 text-sm text-foreground/70">
        자세한 참여 조건은 <Link className="underline underline-offset-4" href="/terms">이용약관</Link>, 개인정보 처리는 <Link className="underline underline-offset-4" href="/privacy">개인정보 처리방침</Link>을 확인하세요.
      </p>
    </main>
  );
}
