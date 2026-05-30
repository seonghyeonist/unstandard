import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/layout/query-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Unstandard Closed Alpha",
  description: "Question-first dating for better first messages.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={inter.variable}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
