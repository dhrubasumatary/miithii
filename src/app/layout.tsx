import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f5ef",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: {
    default: "Miithii \u2014 AI Assamese Voice Generator",
    template: "%s | Miithii",
  },
  description: "Generate Assamese voiceovers for reels, YouTube, and business promotions. Powered by AI.",
  keywords: ["Assamese TTS", "Assamese voice generator", "Axomiya voiceover", "Miithii"],
  authors: [{ name: "Prompt Mafia Inc." }],
  creator: "Prompt Mafia Inc.",
  publisher: "Prompt Mafia Inc.",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon", type: "image/png" },
      { url: "/brand/miithii-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon", type: "image/png" }],
  },
  openGraph: {
    title: "Miithii \u2014 AI Assamese Voice Generator",
    description: "Generate Assamese voiceovers for reels, YouTube, and business promotions. Powered by AI.",
    url: "/",
    siteName: siteConfig.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Miithii \u2014 AI Assamese Voice Generator",
      },
    ],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miithii \u2014 AI Assamese Voice Generator",
    description: "Generate Assamese voiceovers for reels, YouTube, and business promotions. Powered by AI.",
    images: ["/twitter-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${newsreader.variable} antialiased min-h-screen`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
