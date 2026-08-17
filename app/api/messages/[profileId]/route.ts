import { getAuthenticatedUser, ServiceUnavailableError } from "@/lib/auth/server";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import {
  createMessage,
  listConversation,
  type ConversationError,
} from "@/lib/db/repositories/messages.repository";
import { privateJson } from "@/lib/http/private-json";
import { consumeRateLimit, RateLimitUnavailableError } from "@/lib/security/rate-limit";
import { validateMessageBody } from "@/lib/security/message-validation";

const mockSentMessages = new Map<string, Array<{ id: string; body: string; createdAt: string }>>();

function errorStatus(code: ConversationError): number {
  if (code === "INVALID_PROFILE_ID") return 400;
  if (code === "PROFILE_NOT_FOUND") return 404;
  if (code === "NOT_ONBOARDED") return 409;
  return 403;
}

async function actor() {
  try {
    return await getAuthenticatedUser();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) return "unavailable" as const;
    return null;
  }
}

export async function GET(_request: Request, context: { params: Promise<{ profileId: string }> }) {
  const user = await actor();
  if (user === "unavailable") return privateJson({ error: "Messages unavailable" }, { status: 503 });
  if (!user) return privateJson({ error: "Unauthorized" }, { status: 401 });
  const { profileId } = await context.params;

  if (!isDatabaseRuntime()) {
    const sent = mockSentMessages.get(profileId) ?? [];
    return privateJson({
      messages: sent.map((message) => ({ ...message, profileId, author: "me" as const })),
      source: "mock",
    });
  }

  try {
    const result = await listConversation({ viewerUserId: user.id, targetProfileId: profileId });
    if (!result.ok) {
      return privateJson({ error: "Conversation unavailable", code: result.code }, { status: errorStatus(result.code) });
    }
    return privateJson({ messages: result.messages, source: "database" });
  } catch {
    return privateJson({ error: "Messages unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ profileId: string }> }) {
  const user = await actor();
  if (user === "unavailable") return privateJson({ error: "Messages unavailable" }, { status: 503 });
  if (!user) return privateJson({ error: "Unauthorized" }, { status: 401 });

  try {
    const decision = await consumeRateLimit({ scope: "messageSend", subject: user.id });
    if (!decision.allowed) {
      return privateJson(
        { error: "Too many messages" },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return privateJson({ error: "Messages unavailable" }, { status: 503 });
    }
    throw error;
  }

  let value: unknown;
  try {
    const body = (await request.json()) as { body?: unknown };
    value = body?.body;
  } catch {
    return privateJson({ error: "Invalid JSON" }, { status: 400 });
  }

  let body: string;
  try {
    body = validateMessageBody(value);
  } catch {
    return privateJson({ error: "Invalid message" }, { status: 400 });
  }

  const { profileId } = await context.params;
  if (!isDatabaseRuntime()) {
    const message = { id: crypto.randomUUID(), body, createdAt: new Date().toISOString() };
    mockSentMessages.set(profileId, [...(mockSentMessages.get(profileId) ?? []), message]);
    return privateJson({ message: { ...message, profileId, author: "me" }, source: "mock" }, { status: 201 });
  }

  try {
    const result = await createMessage({ viewerUserId: user.id, targetProfileId: profileId, body });
    if (!result.ok) {
      return privateJson({ error: "Message not allowed", code: result.code }, { status: errorStatus(result.code) });
    }
    return privateJson({ message: result.message, source: "database" }, { status: 201 });
  } catch {
    return privateJson({ error: "Messages unavailable" }, { status: 503 });
  }
}
