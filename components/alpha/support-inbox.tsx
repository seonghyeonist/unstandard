"use client";
import { useQuery } from "@tanstack/react-query";
type Ticket = { id: string; category: string; status: string; message: string; replies: { response: string; createdAt: string }[] };
export function SupportInbox() {
  const { data, isError } = useQuery({ queryKey: ["support-tickets"], queryFn: async () => {
    const response = await fetch("/api/support", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("지원 내역을 불러오지 못했습니다.");
    return (await response.json()) as { tickets: Ticket[] };
  }, refetchInterval: 60_000 });
  return <section className="mt-5" aria-label="지원 요청 내역">
    <h3 className="font-semibold">내 요청과 운영자 답변</h3>
    {isError ? <p role="alert">지원 내역을 불러오지 못했습니다.</p> : null}
    {data?.tickets.length === 0 ? <p className="mt-2 text-sm">접수한 요청이 없습니다.</p> : null}
    {data?.tickets.map(ticket => <article key={ticket.id} className="mt-4 rounded-xl border border-line p-4">
      <p className="text-sm">{ticket.category} · {ticket.status === "CLOSED" ? "처리 완료" : ticket.status === "IN_PROGRESS" ? "확인 중" : "접수됨"}</p>
      <p className="mt-2 whitespace-pre-wrap break-words">{ticket.message}</p>
      {ticket.replies.map((reply, i) => <div key={i} className="mt-3 border-t border-line pt-3"><p className="text-sm font-semibold">운영자 답변 · {new Date(reply.createdAt).toLocaleString("ko-KR")}</p><p className="whitespace-pre-wrap break-words">{reply.response}</p></div>)}
    </article>)}
  </section>;
}
