import { getAuth } from "@/lib/auth/auth";
import {
  getOAuthRequestDiagnostics,
  getOAuthResponseDiagnostics,
  isOAuthBoundaryPath,
} from "@/lib/auth/oauth-boundary-diagnostics";

async function handler(request: Request) {
  const pathname = new URL(request.url).pathname;
  const diagnostics = isOAuthBoundaryPath(pathname) ? getOAuthRequestDiagnostics(request) : null;
  const response = await getAuth().handler(request);
  if (diagnostics) {
    // Sanitized operational evidence only: no cookie values, OAuth state/code,
    // tokens, invite capability, email, or secrets are included.
    console.info("oauth_boundary", JSON.stringify({
      ...diagnostics,
      responseStatus: response.status,
      setCookies: getOAuthResponseDiagnostics(response),
    }));
  }
  return response;
}

export { handler as GET, handler as POST };
