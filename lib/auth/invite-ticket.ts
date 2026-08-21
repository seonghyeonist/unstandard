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
  exp: number;
  legalAcceptance: RegistrationLegalAcceptance;
};

const TICKET_COOKIE = "unstandard_registration_ticket";
const TICKET_TTL_SECONDS = 15 * 60;

export function getRegistrationTicketCookieName(): string {
  return TICKET_COOKIE;
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
    if (!payload.inviteId || !payload.email || !payload.capability || !payload.exp) return null;
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
  secret: string,
  legalSelection: RegistrationLegalSelection,
): { token: string; maxAge: number } {
  const exp = Date.now() + TICKET_TTL_SECONDS * 1000;
  const legalAcceptance = createRegistrationLegalAcceptance(legalSelection);
  return {
    token: signRegistrationTicket(
      { inviteId, email, capability, exp, legalAcceptance },
      secret,
    ),
    maxAge: TICKET_TTL_SECONDS,
  };
}

export const INVITE_RESERVATION_TTL_MS = TICKET_TTL_SECONDS * 1000;
