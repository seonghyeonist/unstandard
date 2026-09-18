import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const OPERATOR_COOKIE = "unstandard_invite_operator";
const OPERATOR_TTL_SECONDS = 30 * 60;

function secret(): string | null {
  return process.env.UNSTANDARD_INVITE_OPERATOR_TOKEN?.trim() || null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(exp: number, value: string): string {
  return createHmac("sha256", value).update(`unstandard:invite-operator:${exp}`).digest("base64url");
}

export function verifyOperatorToken(value: string): boolean {
  const configured = secret();
  return Boolean(configured && value && safeEqual(value, configured));
}

export function createOperatorSession(value: string): { token: string; maxAge: number } {
  const exp = Date.now() + OPERATOR_TTL_SECONDS * 1000;
  return { token: `${exp}.${sign(exp, value)}`, maxAge: OPERATOR_TTL_SECONDS };
}

export function verifyOperatorSession(token: string): boolean {
  const configured = secret();
  const [expText, signature] = token.split(".");
  const exp = Number(expText);
  if (!configured || !signature || !Number.isSafeInteger(exp) || Date.now() > exp) return false;
  return safeEqual(signature, sign(exp, configured));
}

export async function hasOperatorSession(): Promise<boolean> {
  const value = (await cookies()).get(OPERATOR_COOKIE)?.value;
  return Boolean(value && verifyOperatorSession(value));
}

export async function setOperatorSession(): Promise<boolean> {
  const configured = secret();
  if (!configured) return false;
  const session = createOperatorSession(configured);
  (await cookies()).set(OPERATOR_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: session.maxAge,
  });
  return true;
}

export async function clearOperatorSession(): Promise<void> {
  (await cookies()).delete(OPERATOR_COOKIE);
}
