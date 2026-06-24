import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "회식 hasik",
  description: "익명 직장인 롤플레잉 실시간 회식방",
  openGraph: {
    title: "회식 hasik",
    description: "퇴근 후 들어오는 익명 회식방",
    type: "website"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
