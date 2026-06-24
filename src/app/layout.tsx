import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebX 2026 おすすめセッションルート",
  description: "WebX 2026の参加目的に合わせて、おすすめセッションと回り方を提案します。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
