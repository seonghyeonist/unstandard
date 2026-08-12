export const MESSAGE_MAX_LENGTH = 500;

export function validateMessageBody(value: unknown): string {
  if (typeof value !== "string") throw new Error("INVALID_MESSAGE");
  const body = value.trim();
  if (body.length < 1 || body.length > MESSAGE_MAX_LENGTH) {
    throw new Error("INVALID_MESSAGE");
  }
  return body;
}
