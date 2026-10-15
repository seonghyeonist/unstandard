import OperatorInviteConsole from "@/components/alpha/operator-invite-console";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function OperatorInvitesPage() {
  return <AppShell title="초대 운영" eyebrow="operator"><Card><Link href="/operator/support" className="underline">지원 요청 처리</Link><OperatorInviteConsole /></Card></AppShell>;
}
