import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebX 2026 おすすめルート",
  description: "WebX 2026の参加目的に合わせて、公式セッションとサイドイベントの回り方を提案します。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
