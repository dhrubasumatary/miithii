import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { miithiiThemeInitScript } from "@miithii/ui";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://miithii.in"),
  title: {
    default: "Miithii",
    template: "%s | Miithii"
  },
  description: "Miithii brings Assamese conversation, voice, and speech tools into one simple experience.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Miithii",
    description: "Assamese conversation, voice, and speech tools in one simple experience.",
    url: "https://miithii.in",
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

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: miithiiThemeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
