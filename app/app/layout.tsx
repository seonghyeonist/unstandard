import { requirePageUser } from "@/lib/auth/page-guard";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requirePageUser({ requireOnboarded: false });
  return children;
}
