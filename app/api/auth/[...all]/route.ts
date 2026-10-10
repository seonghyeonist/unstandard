import { getAuth } from "@/lib/auth/auth";
import { applyPrivateNoStoreHeaders, privateJson } from "@/lib/http/private-json";

function isDisabledOAuthPath(pathname: string): boolean {
  return (
    pathname === "/api/auth/sign-in/social" ||
    pathname === "/api/auth/sign-in/oauth2" ||
    /^\/api\/auth\/(?:callback|oauth2\/callback)\/(?:google|naver)$/.test(pathname)
  );
}

async function handler(request: Request) {
  const pathname = new URL(request.url).pathname;
  if (isDisabledOAuthPath(pathname)) {
    return privateJson(
      { error: "OAuth authentication is disabled" },
      { status: 404 },
    );
  }
  const response = await getAuth().handler(request);
  const headers = new Headers(response.headers);
  applyPrivateNoStoreHeaders(headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export { handler as GET, handler as POST };
