import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Bengali, Noto_Sans_Devanagari, Space_Grotesk, Space_Mono } from "next/font/google";
import { miithiiThemeInitScript } from "@miithii/ui";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-miithii-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-miithii-body", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-miithii-mono", display: "swap" });
const assamese = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-miithii-assamese", display: "swap" });
const bodo = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-miithii-bodo", display: "swap" });

export const metadata: Metadata = {
  title: "Miithii Voice",
  description: "Have a spoken Assamese or Bodo conversation with Miithii."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f2ea"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable} ${assamese.variable} ${bodo.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: miithiiThemeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

