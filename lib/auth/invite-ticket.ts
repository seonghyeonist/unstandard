import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createRegistrationLegalAcceptance,
  isRegistrationLegalAcceptance,
  type RegistrationLegalAcceptance,
  type RegistrationLegalSelection,
} from "@/lib/legal/acceptance";

export type RegistrationTicket = {
  inviteId: string;
  email: string;
  capability: string;
  emailVerificationId: string;
  exp: number;
  legalAcceptance: RegistrationLegalAcceptance;
};

/**
 * Short-lived state created after the invite capability has been removed from
 * the address bar. It deliberately contains no raw invite capability: the
 * server proved possession during the fragment-to-POST exchange.
 */
export type PreparedInviteTicket = {
  inviteId: string;
  email: string;
  exp: number;
};

/**
 * Proof issued only after the server verifies the one-time email challenge.
 * It is deliberately distinct from both the invite capability and the
 * registration ticket so neither artifact can stand in for the other.
 */
export type EmailVerificationTicket = {
  inviteId: string;
  email: string;
  challengeId: string;
  exp: number;
};

const TICKET_COOKIE = "unstandard_registration_ticket";
const PREPARED_INVITE_COOKIE = "unstandard_prepared_invite";
const EMAIL_VERIFICATION_COOKIE = "unstandard_email_verification";
const TICKET_TTL_SECONDS = 15 * 60;

export function getRegistrationTicketCookieName(): string {
  return TICKET_COOKIE;
}

export function getPreparedInviteCookieName(): string {
  return PREPARED_INVITE_COOKIE;
}

export function getEmailVerificationCookieName(): string {
  return EMAIL_VERIFICATION_COOKIE;
}

export function signRegistrationTicket(
  payload: RegistrationTicket,
  secret: string,
): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyRegistrationTicket(
  token: string,
  secret: string,
): RegistrationTicket | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as RegistrationTicket;
    if (!payload.inviteId || !payload.email || !payload.capability || !payload.emailVerificationId || !payload.exp) return null;
    if (!isRegistrationLegalAcceptance(payload.legalAcceptance)) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createRegistrationTicket(
  inviteId: string,
  email: string,
  capability: string,
  emailVerificationId: string,
  secret: string,
  legalSelection: RegistrationLegalSelection,
): { token: string; maxAge: number } {
  const exp = Date.now() + TICKET_TTL_SECONDS * 1000;
  const legalAcceptance = createRegistrationLegalAcceptance(legalSelection);
  return {
    token: signRegistrationTicket(
      { inviteId, email, capability, emailVerificationId, exp, legalAcceptance },
      secret,
    ),
    maxAge: TICKET_TTL_SECONDS,
  };
}

export function signEmailVerificationTicket(
  payload: EmailVerificationTicket,
  secret: string,
): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyEmailVerificationTicket(
  token: string,
  secret: string,
): EmailVerificationTicket | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as EmailVerificationTicket;
    if (!payload.inviteId || !payload.email || !payload.challengeId || !payload.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createEmailVerificationTicket(
  inviteId: string,
  email: string,
  challengeId: string,
  secret: string,
): { token: string; maxAge: number } {
  const exp = Date.now() + TICKET_TTL_SECONDS * 1000;
  return {
    token: signEmailVerificationTicket({ inviteId, email, challengeId, exp }, secret),
    maxAge: TICKET_TTL_SECONDS,
  };
}

export function signPreparedInviteTicket(payload: PreparedInviteTicket, secret: string): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPreparedInviteTicket(token: string, secret: string): PreparedInviteTicket | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;

  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as PreparedInviteTicket;
    if (!payload.inviteId || !payload.email || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createPreparedInviteTicket(
  inviteId: string,
  email: string,
  secret: string,
): { token: string; maxAge: number } {
  const exp = Date.now() + TICKET_TTL_SECONDS * 1000;
  return {
    token: signPreparedInviteTicket({ inviteId, email, exp }, secret),
    maxAge: TICKET_TTL_SECONDS,
  };
}

export const INVITE_RESERVATION_TTL_MS = TICKET_TTL_SECONDS * 1000;
