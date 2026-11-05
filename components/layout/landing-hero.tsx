import Link from "next/link";
import { AlphaCta, LandingMeasurement } from "@/components/waitlist/landing-measurement";
import { WaitlistForm } from "@/components/waitlist/waitlist-form";

export function LandingHero() {
  return (
    <main className="recruitment">
      <LandingMeasurement />
      <nav className="recruitment-nav" aria-label="주요 메뉴">
        <span className="recruitment-wordmark">unstandard</span>
        <Link href="/login" className="recruitment-login">기존 회원 로그인</Link>
      </nav>
      <div className="recruitment-grid">
        <section className="recruitment-intro" aria-labelledby="landing-title">
          <p className="recruitment-label">만 19세 이상 · 비공개 알파</p>
          <h1 id="landing-title">첫인상은,<br />첫 질문부터.</h1>
          <p className="recruitment-description">질문과 답변으로 상대의 생각과 취향을 먼저 알아가는 데이팅.</p>
          <AlphaCta />
          <p className="recruitment-question">어떤 순간에 마음이 놓여요?</p>
        </section>
        <section id="alpha-apply" tabIndex={-1} aria-labelledby="alpha-apply-title" className="recruitment-apply">
          <p className="recruitment-kicker">당신의 첫 질문을 기다립니다</p>
          <h2 id="alpha-apply-title">알파 초대 신청</h2>
          <p className="recruitment-form-intro">초대 대상으로 선정되면 이메일로 가입 링크를 보내드려요.</p>
          <WaitlistForm />
        </section>
        <figure className="recruitment-paper">
          <figcaption>첫 질문 예시 · 가상 답변</figcaption>
          <p className="recruitment-paper-question">어떤 순간에<br />마음이 놓여요?</p>
          <blockquote>말이 없어도<br className="recruitment-answer-break" /> 어색하지 않을 때요.</blockquote>
          <span className="recruitment-paper-rule" aria-hidden="true" />
          <p className="recruitment-paper-note">한 사람을 알아가는, 또 하나의 시작.</p>
        </figure>
      </div>
      <section className="recruitment-faq" aria-labelledby="faq-title">
        <h2 id="faq-title">신청 전에 궁금한 것</h2>
        <div className="recruitment-faq-grid">
          <div><h3>신청하면 바로 가입하나요?</h3><p>신청은 가입과 달라요. 초대 대상으로 선정되면 이메일로 가입 링크를 보내드려요.</p></div>
          <div><h3>신청 정보를 삭제하고 싶어요.</h3><p>등록한 브라우저의 접수 화면에서 삭제할 수 있어요. 다른 브라우저에서 받은 접수증으로는 기존 신청을 삭제할 수 없어요.</p></div>
          <div><h3>개인정보 문의는 어디로 하나요?</h3><p><a href="mailto:privacy@unstandard.app">privacy@unstandard.app</a>으로 삭제·처리정지를 요청할 수 있어요. <Link href="/privacy">개인정보 처리 안내</Link>에서 자세히 확인해 주세요.</p></div>
        </div>
      </section>
      <footer className="recruitment-footer"><span>unstandard</span><Link href="/privacy">개인정보 처리 안내</Link></footer>
    </main>
  );
}
