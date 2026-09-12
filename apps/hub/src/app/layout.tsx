import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Manrope, Noto_Sans_Bengali, Noto_Sans_Devanagari, Space_Grotesk, Space_Mono } from "next/font/google";
import { miithiiThemeInitScript } from "@miithii/ui";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-miithii-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-miithii-body", display: "swap" });
const mono = Space_Mono({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-miithii-mono", display: "swap" });
const assamese = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-miithii-assamese", display: "swap" });
const bodo = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-miithii-bodo", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://miithii.in"),
  title: {
    default: "Miithii | Assamese and Bodo AI Chat and Voice",
    template: "%s | Miithii"
  },
  description: "Miithii is a multilingual AI language layer for Assamese and Bodo. Chat naturally, speak in your language, and carry useful context across conversations.",
  applicationName: "Miithii",
  keywords: [
    "Miithii",
    "Assamese AI",
    "Bodo AI",
    "Assamese chatbot",
    "Bodo chatbot",
    "Assamese voice AI",
    "Bodo voice AI",
    "Northeast India languages",
    "multilingual AI"
  ],
  alternates: {
    canonical: "/"
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  openGraph: {
    title: "Miithii | Assamese and Bodo AI Chat and Voice",
    description: "A language layer for talking with intelligence in Assamese and Bodo, with more Northeast Indian languages coming.",
    url: "https://miithii.in",
    siteName: "Miithii",
    type: "website",
    locale: "en_IN"
  },
  twitter: {
    card: "summary",
    title: "Miithii | Assamese and Bodo AI Chat and Voice",
    description: "Talk with intelligence in Assamese and Bodo. More Northeast Indian languages are coming."
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07130f"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable} ${assamese.variable} ${bodo.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: miithiiThemeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Miithii",
              url: "https://miithii.in/",
              applicationCategory: "CommunicationApplication",
              operatingSystem: "Web",
              description: "A multilingual AI language layer for Assamese and Bodo chat, voice, and subtitles.",
              inLanguage: ["en", "as", "brx"]
            })
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
