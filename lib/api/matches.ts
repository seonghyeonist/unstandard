import { matches, messages } from "@/lib/api/mock-data";
import type { Match, Message } from "@/types/match";

const sentMessages: Message[] = [];

export async function getMatches(): Promise<Match[]> {
  return matches;
}

export async function getMessages(matchId: string): Promise<Message[]> {
  return [...messages, ...sentMessages].filter((message) => message.matchId === matchId);
}

export async function sendMessage(matchId: string, body: string): Promise<Message> {
  const message: Message = {
    id: crypto.randomUUID(),
    matchId,
    author: "me",
    body,
    createdAt: new Date().toISOString(),
  };
  sentMessages.push(message);
  return message;
}
