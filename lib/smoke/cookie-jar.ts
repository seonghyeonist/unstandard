/**
 * In-memory CookieJar for deployed Preview smoke.
 * Never serialize/log cookie values; clone is deep in-memory only.
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  ingest(setCookieHeader: string | null | undefined): void {
    if (!setCookieHeader) return;
    for (const part of setCookieHeader.split(/,(?=\s*[^;]+=)/)) {
      this.ingestOne(part);
    }
  }

  ingestAll(setCookies: string[]): void {
    for (const part of setCookies) {
      this.ingestOne(part);
    }
  }

  private ingestOne(part: string): void {
    const segments = part.split(";").map((s) => s.trim());
    const [pair] = segments;
    if (!pair) return;
    const eq = pair.indexOf("=");
    if (eq <= 0) return;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) return;

    const attrs = segments.slice(1).join(";").toLowerCase();
    const deleted =
      value === "" ||
      attrs.includes("max-age=0") ||
      /expires=[^;]*1970/i.test(part) ||
      /expires=[^;]*thu,\s*01\s*jan\s*1970/i.test(part);

    if (deleted) {
      this.cookies.delete(name);
      return;
    }

    this.cookies.set(name, value);
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  clear(): void {
    this.cookies.clear();
  }

  /** Safe deep in-memory clone. Does not print or serialize cookies. */
  clone(): CookieJar {
    const next = new CookieJar();
    for (const [name, value] of this.cookies.entries()) {
      next.cookies.set(name, value);
    }
    return next;
  }

  /** Size only — for tests; never expose values. */
  size(): number {
    return this.cookies.size;
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }
}

export function collectSetCookieHeaders(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    return anyHeaders.getSetCookie();
  }
  const single = headers.get("set-cookie");
  return single ? [single] : [];
}
