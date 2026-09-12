import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk, Space_Mono } from "next/font/google";
import { miithiiThemeInitScript } from "@miithii/ui";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-miithii-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-miithii-body", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-miithii-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Miithii Voice",
  description: "Have a spoken Assamese conversation with Miithii."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f2ea"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: miithiiThemeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

