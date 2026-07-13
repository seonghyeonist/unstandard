import { NextResponse } from "next/server";
import { signOutCurrentUser } from "@/lib/auth/server";

export async function POST() {
  await signOutCurrentUser();
  return NextResponse.json({ ok: true });
}
