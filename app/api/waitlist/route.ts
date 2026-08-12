import { cookies } from "next/headers";
import { isDatabaseRuntime } from "@/lib/config/runtime-mode";
import { privateJson } from "@/lib/http/private-json";
import {
  consumeRateLimit,
  RateLimitUnavailableError,
  requestIpAddress,
} from "@/lib/security/rate-limit";
import {
  deleteWaitlistEntry,
  joinWaitlist,
  recordWaitlistVisit,
} from "@/lib/waitlist/waitlist.repository";
import {
  WAITLIST_COOKIE_MAX_AGE_SECONDS,
  WAITLIST_COOKIE_NAME,
} from "@/lib/waitlist/waitlist-token";
import { validateWaitlistJoin } from "@/lib/waitlist/waitlist-validation";

function unavailable() {
  return privateJson({ error: "Waitlist temporarily unavailable" }, { status: 503 });
}

export async function GET() {
  if (!isDatabaseRuntime()) return privateJson({ joined: false, source: "mock" });
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(WAITLIST_COOKIE_NAME)?.value;
  if (!rawToken) return privateJson({ joined: false });

  try {
    const joined = await recordWaitlistVisit(rawToken);
    if (!joined) cookieStore.delete(WAITLIST_COOKIE_NAME);
    return privateJson({ joined });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  if (!isDatabaseRuntime()) return unavailable();
  try {
    const decision = await consumeRateLimit({
      scope: "waitlistJoin",
      subject: requestIpAddress(request),
    });
    if (!decision.allowed) {
      return privateJson(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(decision.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return unavailable();
    throw error;
  }

  let input;
  try {
    input = validateWaitlistJoin(await request.json());
  } catch {
    return privateJson({ error: "Invalid waitlist request" }, { status: 400 });
  }

  try {
    const result = await joinWaitlist(input);
    if (result.created) {
      const cookieStore = await cookies();
      cookieStore.set(WAITLIST_COOKIE_NAME, result.rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: WAITLIST_COOKIE_MAX_AGE_SECONDS,
      });
    }
    // Deliberately does not reveal whether an email was already registered.
    return privateJson({ accepted: true }, { status: 202 });
  } catch {
    return unavailable();
  }
}

export async function DELETE() {
  if (!isDatabaseRuntime()) return unavailable();
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(WAITLIST_COOKIE_NAME)?.value;
  if (!rawToken) return privateJson({ deleted: false });
  try {
    const deleted = await deleteWaitlistEntry(rawToken);
    cookieStore.delete(WAITLIST_COOKIE_NAME);
    return privateJson({ deleted });
  } catch {
    return unavailable();
  }
}
