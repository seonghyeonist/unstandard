"use client";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
type Ticket = { id: string; category: string; message: string; status: "OPEN" | "IN_PROGRESS" | "CLOSED"; assignedTo: string | null; createdAt: string; updatedAt: string; slaBreached: boolean; history: { id: string; status: string; response: string | null; createdAt: string }[] };
function TicketEditor({ ticket }: { ticket: Ticket }) {
  const client = useQueryClient();
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState(ticket.status);
  const mutation = useMutation({ mutationFn: async () => {
    const result = await fetch("/api/alpha/operator/support", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: ticket.id, expectedStatus: ticket.status, expectedUpdatedAt: ticket.updatedAt, status, assignedTo: "seonghyeonist", response: response.trim() || null }) });
    if (!result.ok) throw new Error(result.status === 409 ? "다른 처리가 저장됐습니다. 새로고침 후 확인해 주세요." : "저장하지 못했습니다. 인증과 입력을 확인해 주세요.");
  }, onSuccess: async () => { setResponse(""); await client.invalidateQueries({ queryKey: ["operator-support"] }); } });
  return <article className="mt-4 rounded-xl border border-line p-4"><p>{ticket.category} · {ticket.status} · 담당: {ticket.assignedTo ?? "미배정"}</p><p className="text-sm">접수: {new Date(ticket.createdAt).toLocaleString("ko-KR")}{ticket.slaBreached ? " · 첫 답변 240분 SLA 초과" : ""}</p><p className="mt-3 whitespace-pre-wrap break-words">{ticket.message}</p>
    {ticket.history.map(event => <div className="mt-2 border-t border-line pt-2" key={event.id}><p className="text-sm">{event.status} · {new Date(event.createdAt).toLocaleString("ko-KR")}</p>{event.response ? <p className="whitespace-pre-wrap break-words">{event.response}</p> : null}</div>)}
    <label className="mt-3 block">상태<select className="ml-3" value={status} onChange={e => setStatus(e.target.value as Ticket["status"])}><option value="OPEN">접수</option><option value="IN_PROGRESS">확인 중</option><option value="CLOSED">처리 완료</option></select></label>
    <label className="mt-3 block">회원에게 전달할 답변<textarea className="mt-2 w-full rounded-lg border border-line p-3" value={response} onChange={e => setResponse(e.target.value)} maxLength={2000} rows={4} /></label>
    <Button className="mt-3" disabled={mutation.isPending || (response.trim().length > 0 && response.trim().length < 10) || (status === "CLOSED" && response.trim().length < 10)} onClick={() => mutation.mutate()}>담당 배정·상태·답변 저장</Button>
    {mutation.isError ? <p role="alert">{mutation.error.message}</p> : null}{mutation.isSuccess ? <p role="status">저장했습니다. 회원은 설정 화면에서 답변을 확인할 수 있습니다.</p> : null}
  </article>;
}
export default function OperatorSupportConsole() {
  const { data, isError, refetch } = useQuery({ queryKey: ["operator-support"], retry: false, queryFn: async () => {
    const result = await fetch("/api/alpha/operator/support", { credentials: "same-origin", cache: "no-store" });
    if (!result.ok) throw new Error("운영자 인증 또는 지원 서비스를 확인해 주세요.");
    return (await result.json()) as { tickets: Ticket[] };
  } });
  return <section><p>담당: seonghyeonist · 답변은 회원 설정 화면에 전달됩니다.</p><Link className="underline" href="/operator/invites">운영자 로그인</Link><Button className="ml-3" onClick={() => void refetch()}>새로고침</Button>{isError ? <p role="alert">운영자 로그인 후 새로고침해 주세요.</p> : null}{data?.tickets.map(ticket => <TicketEditor key={`${ticket.id}:${ticket.updatedAt}`} ticket={ticket} />)}</section>;
}
