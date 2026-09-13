import { requirePageUser } from "@/lib/auth/page-guard";
export default async function IntroductionLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser({ requireIntroduction: true });
  return children;
}
