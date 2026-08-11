import { timingSafeEqual } from "node:crypto";

/**
 * Operator-only endpoints deliberately authenticate from the Authorization
 * header. Query-string credentials would leak through URLs and access logs.
 */
export function isAuthorizedOperatorRequest(
  request: Request,
  expectedToken = process.env.UNSTANDARD_DEBUG_CHECK_TOKEN,
): boolean {
  const expected = expectedToken?.trim();
  if (!expected) return false;

  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/iu.exec(authorization);
  const provided = match?.[1]?.trim();
  if (!provided) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
