import type { Metadata } from "next";
import "./globals.css";

export const viewport = {width: "device-width", initialScale: 1};

export const metadata: Metadata = {
  title: "AI 사업 통합 업무보고",
  description: "부서별 AI 사업 공동 입력과 통합 보고",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
