import { handleIdentity } from "@/lib/server/identity/http";
export async function POST(request: Request) { return handleIdentity(request, "complete"); }
