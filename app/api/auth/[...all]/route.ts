import { getAuth } from "@/lib/auth/auth";

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
    return Response.json(
      { error: "OAuth authentication is disabled" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return getAuth().handler(request);
}

export { handler as GET, handler as POST };
