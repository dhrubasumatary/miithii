import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk, Space_Mono } from "next/font/google";
import { miithiiThemeInitScript } from "@miithii/ui";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-miithii-display",
  display: "swap"
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-miithii-body",
  display: "swap"
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-miithii-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Miithii Subtitles",
    template: "%s | Miithii Subtitles"
  },
  description: "Join the waitlist for Assamese subtitles for Instagram reels, podcasts, and shorts.",
  metadataBase: new URL("https://subtitles.miithii.in"),
  alternates: { canonical: "/" },
  openGraph: {
    title: "Miithii Subtitles",
    description: "Assamese subtitles for reels, podcasts, and shorts — coming soon.",
    url: "https://subtitles.miithii.in",
    siteName: "Miithii",
    type: "website"
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
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: miithiiThemeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

