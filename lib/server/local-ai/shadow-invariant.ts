/** A shadow operation is observational; its value or failure cannot replace the authoritative result. */
export async function preserveAuthoritativeUnlock<T>(
  authoritativeResult: T,
  shadowOperation: () => Promise<unknown>,
  onFailure?: () => void,
): Promise<T> {
  try {
    await shadowOperation();
  } catch {
    try {
      onFailure?.();
    } catch {
      // Logging failures are also contained from the authoritative result.
    }
  }
  return authoritativeResult;
}
