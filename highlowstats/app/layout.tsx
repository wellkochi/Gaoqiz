import type { Metadata } from "next";
import "./globals.css";

const basePath =
  process.env.GITHUB_PAGES === "true" ? "/highlowstats" : "";

export const metadata: Metadata = {
  title: "highlowstats | Binance Futures 高低点统计",
  description: "统计 BTC、ETH、SOL、HYPE、XRP、DOGE、ZEC 和 BNB 每个 UTC 交易日最高价和最低价首次出现小时的概率分布。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
