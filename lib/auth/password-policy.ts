const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "unstandard",
  "unstandard123",
]);

/** Minimum password policy shared by signup, reset and the browser copy. */
export function isAcceptableNewPassword(password: unknown): password is string {
  if (typeof password !== "string" || password.length < 10 || password.length > 128) return false;
  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return false;
  if (/^(.)\1+$/.test(password)) return false;
  if (/^(?:0123456789|1234567890|9876543210)$/.test(normalized)) return false;
  return true;
}
