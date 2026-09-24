import OperatorInviteConsole from "@/components/alpha/operator-invite-console";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default function OperatorInvitesPage() {
  return <AppShell title="초대 운영" eyebrow="operator"><Card><OperatorInviteConsole /></Card></AppShell>;
}
