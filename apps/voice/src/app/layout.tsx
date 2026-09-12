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
  metadataBase: new URL("https://voice.miithii.in"),
  title: "Miithii Voice | Assamese and Bodo Voice AI",
  description: "Speak naturally in English or an Indian language and hear Miithii reply in Assamese or Bodo.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Miithii Voice | Assamese and Bodo Voice AI",
    description: "Speak naturally and choose Assamese or Bodo for Miithii's spoken reply.",
    url: "https://voice.miithii.in",
    siteName: "Miithii",
    type: "website",
    locale: "en_IN"
  },
  twitter: {
    card: "summary",
    title: "Miithii Voice | Assamese and Bodo Voice AI",
    description: "Speak naturally and choose Assamese or Bodo for Miithii's spoken reply."
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07130f"
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

