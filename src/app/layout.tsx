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
    default: "Miithii Voice - Assamese and Northeast voiceovers",
    template: "%s | Miithii Voice",
  },
  description: siteConfig.description,
  keywords: [
    "Miithii Voice",
    "Assamese text to speech",
    "Assamese voice generator",
    "Northeast India voiceover",
    "Bodo text to speech",
    "Manipuri voice",
    "regional voice generator",
    "downloadable voice files",
  ],
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
    title: "Miithii Voice - Assamese and Northeast voiceovers",
    description: siteConfig.tagline,
    url: "/",
    siteName: siteConfig.name,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Miithii Voice - Assamese and Northeast voiceovers in seconds",
      },
    ],
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miithii Voice - Assamese and Northeast voiceovers",
    description: siteConfig.tagline,
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
        className={`${inter.variable} ${jetbrainsMono.variable} ${newsreader.variable} antialiased h-screen w-screen overflow-hidden`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
