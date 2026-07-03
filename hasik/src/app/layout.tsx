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
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6614664375260186"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
