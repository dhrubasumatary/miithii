import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://miithii.in"),
  title: {
    default: "Miithii",
    template: "%s | Miithii"
  },
  description: "Miithii.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Miithii",
    description: "Miithii.",
    url: "https://miithii.in",
    siteName: "Miithii",
    type: "website"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#081F1C"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
