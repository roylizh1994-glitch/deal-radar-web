import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DealRadar — 每日精选科技好价",
  description: "自动聚合 Reddit / Slickdeals 等平台的科技产品折扣，每日更新 Top 10。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
