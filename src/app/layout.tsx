import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Poster Studio",
  description: "Tạo poster marketing bằng AI: đề xuất phương án, tạo ảnh nền, ghép chữ đa ngôn ngữ và tự kiểm tra chất lượng.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
