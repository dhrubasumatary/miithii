import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { miithiiThemeInitScript } from "@miithii/ui";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-miithii-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-miithii-body", display: "swap" });

export const metadata: Metadata = {
  title: "Miithii — Assamese AI companion",
  description: "Talk with Miithii in your own words.",
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#07130f"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${display.variable} ${body.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: miithiiThemeInitScript }} />
      </head>
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
