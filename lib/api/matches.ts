import { matches } from "@/lib/api/mock-data";
import type { Match, Message } from "@/types/match";

export async function getMatches(): Promise<Match[]> {
  return matches;
}

export async function getMessages(profileId: string): Promise<Message[]> {
  const response = await fetch(`/api/messages/${encodeURIComponent(profileId)}`, {
    credentials: "include",
  });
  const value = (await response.json().catch(() => null)) as { messages?: Message[] } | null;
  if (!response.ok || !Array.isArray(value?.messages)) throw new Error("messages_unavailable");
  return value.messages;
}

export async function sendMessage(profileId: string, body: string): Promise<Message> {
  const response = await fetch(`/api/messages/${encodeURIComponent(profileId)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  const value = (await response.json().catch(() => null)) as { message?: Message } | null;
  if (!response.ok || !value?.message) throw new Error("message_send_failed");
  return value.message;
}
