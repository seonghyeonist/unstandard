"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Invite = {
  id: string;
  emailMasked: string;
  status: string;
  expiresAt: string;
  recruitmentCohort: string;
  acquisitionChannel: string;
  balanceBucket: string;
};

async function json(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => ({}));
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export default function OperatorInviteConsole() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [recruitmentCohort, setRecruitmentCohort] = useState("founder_network");
  const [acquisitionChannel, setAcquisitionChannel] = useState("founder_direct");
  const [balanceBucket, setBalanceBucket] = useState("not_counted");
  const [balanceConsent, setBalanceConsent] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteLink, setInviteLink] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadInvites = useCallback(async () => {
    const response = await fetch("/api/alpha/operator/invites", { credentials: "same-origin" });
    if (!response.ok) return false;
    const body = await json(response);
    setInvites(Array.isArray(body.invites) ? body.invites as Invite[] : []);
    return true;
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/alpha/operator/session", { credentials: "same-origin" });
      const body = await json(response);
      const allowed = body.authorized === true;
      setAuthorized(allowed);
      if (allowed) await loadInvites();
    })();
  }, [loadInvites]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const response = await fetch("/api/alpha/operator/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ token }),
    });
    setToken(""); setBusy(false);
    if (!response.ok) { setMessage("운영자 접근을 확인하지 못했어요."); return; }
    setAuthorized(true); await loadInvites();
  }

  async function issue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setInviteLink("");
    const response = await fetch("/api/alpha/operator/invites", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ email, recruitmentCohort, acquisitionChannel, balanceBucket, balanceConsent }),
    });
    const body = await json(response); setBusy(false);
    if (!response.ok || typeof body.inviteLink !== "string") { setMessage("초대를 발급하지 못했어요. 좌석·중복 이메일·균형 조건을 확인해 주세요."); return; }
    setEmail(""); setInviteLink(body.inviteLink); setMessage("초대를 만들었어요. 아래 링크는 지금만 복사해 안전하게 전달해 주세요.");
    await loadInvites();
  }

  async function act(inviteId: string, action: "revoke" | "reissue") {
    setBusy(true); setMessage(""); setInviteLink("");
    const response = await fetch(`/api/alpha/operator/invites/${inviteId}/${action}`, { method: "POST", credentials: "same-origin" });
    const body = await json(response); setBusy(false);
    if (!response.ok) { setMessage("요청을 완료하지 못했어요."); return; }
    if (typeof body.inviteLink === "string") {
      setInviteLink(body.inviteLink); setMessage("새 초대 링크를 만들었어요. 지금 복사해 안전하게 전달해 주세요.");
    } else setMessage("초대를 철회했어요.");
    await loadInvites();
  }

  async function logout() {
    await fetch("/api/alpha/operator/logout", { method: "POST", credentials: "same-origin" });
    setAuthorized(false); setInvites([]); setInviteLink(""); setMessage("");
  }

  if (authorized === null) return <p className="text-sm text-foreground/60">운영자 접근을 확인하는 중이에요.</p>;
  if (!authorized) return (
    <form className="space-y-3" onSubmit={login}>
      <p className="text-sm leading-6 text-foreground/60">초대 운영 권한이 있는 사람만 사용할 수 있어요.</p>
      <label className="block text-sm" htmlFor="operator-token">운영자 접근 키</label>
      <input id="operator-token" type="password" autoComplete="current-password" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={token} onChange={(event) => setToken(event.target.value)} />
      <Button className="w-full" type="submit" disabled={busy || !token}>운영자 확인</Button>
      {message ? <p className="text-sm text-danger">{message}</p> : null}
    </form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-foreground/60">이 화면은 이메일·초대 capability를 브라우저 저장소에 보관하지 않아요.</p><Button type="button" className="bg-foreground/10 text-foreground hover:bg-foreground/15" onClick={logout}>로그아웃</Button></div>
      <form className="space-y-3 rounded-2xl border border-line p-4" onSubmit={issue}>
        <p className="font-semibold">새 초대 발급</p>
        <input type="email" required placeholder="초대할 이메일" className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)} />
        <select className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={recruitmentCohort} onChange={(event) => setRecruitmentCohort(event.target.value)}><option value="founder_network">Founder network</option><option value="writing_reading">Writing / reading</option><option value="subculture_meme">Subculture / meme</option><option value="dating_app_fatigue">Dating-app fatigue</option><option value="quiet_introvert">Quiet introvert</option></select>
        <select className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={acquisitionChannel} onChange={(event) => setAcquisitionChannel(event.target.value)}><option value="founder_direct">Founder direct</option><option value="referral">Referral</option><option value="writing_community">Writing community</option><option value="subculture_community">Subculture community</option><option value="dating_fatigue_community">Dating-fatigue community</option><option value="quiet_introvert_community">Quiet-introvert community</option><option value="organic">Organic</option><option value="other_declared">Other declared</option></select>
        <select className="w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 text-sm" value={balanceBucket} onChange={(event) => { setBalanceBucket(event.target.value); if (event.target.value === "not_counted") setBalanceConsent(false); }}><option value="not_counted">Not counted</option><option value="bucket_a">Bucket A</option><option value="bucket_b">Bucket B</option></select>
        {balanceBucket !== "not_counted" ? <label className="flex gap-3 text-sm"><input type="checkbox" checked={balanceConsent} onChange={(event) => setBalanceConsent(event.target.checked)} /><span>해당 참여자가 Stage 1 공급 균형에 이 선호를 쓰는 데 동의했음을 확인합니다.</span></label> : null}
        <Button className="w-full" type="submit" disabled={busy || !email || (balanceBucket !== "not_counted" && !balanceConsent)}>초대 발급</Button>
      </form>
      {inviteLink ? <div className="rounded-2xl border border-line p-4"><p className="text-sm font-semibold">새 초대 링크</p><p className="mt-2 break-all text-xs text-foreground/70">{inviteLink}</p><Button className="mt-3" type="button" onClick={() => void navigator.clipboard.writeText(inviteLink)}>링크 복사</Button></div> : null}
      {message ? <p className="text-sm text-foreground/70">{message}</p> : null}
      <div className="space-y-3"><p className="font-semibold">초대 상태</p>{invites.length === 0 ? <p className="text-sm text-foreground/60">표시할 Stage 1 초대가 없어요.</p> : invites.map((invite) => <div key={invite.id} className="rounded-2xl border border-line p-4 text-sm"><p>{invite.emailMasked} · {invite.status}</p><p className="mt-1 text-xs text-foreground/60">{invite.recruitmentCohort} / {invite.acquisitionChannel} / {invite.balanceBucket} · expires {new Date(invite.expiresAt).toLocaleString()}</p><div className="mt-3 flex gap-2">{["pending", "reserved"].includes(invite.status) ? <Button type="button" disabled={busy} onClick={() => void act(invite.id, "revoke")}>철회</Button> : null}{["revoked", "expired"].includes(invite.status) ? <Button type="button" disabled={busy} onClick={() => void act(invite.id, "reissue")}>재발급</Button> : null}</div></div>)}</div>
    </div>
  );
}
