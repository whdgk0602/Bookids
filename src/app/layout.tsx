import type { Metadata, Viewport } from "next";
import { Jua } from "next/font/google";
import "./globals.css";

// 아이용 둥근 한글 글꼴. 한글 글리프는 용량이 커서 미리 불러오지 않는다.
const jua = Jua({
  weight: "400",
  variable: "--font-jua",
  preload: false,
});

export const metadata: Metadata = {
  title: "Bookids",
  description: "아이의 말로 이어 가는 그림책",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 아이가 화면을 실수로 확대하지 않도록
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${jua.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
