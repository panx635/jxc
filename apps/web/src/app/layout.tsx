import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "进销存",
  description: "五金水暖进销存",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
