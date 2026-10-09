import OperatorSupportConsole from "@/components/alpha/operator-support-console";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
export const dynamic = "force-dynamic";
export default function OperatorSupportPage() {
  return <AppShell title="지원 요청 처리" eyebrow="operator"><Card><OperatorSupportConsole /></Card></AppShell>;
}
