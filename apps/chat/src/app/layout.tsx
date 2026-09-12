import type { Metadata, Viewport } from "next";
import { Manrope, Noto_Sans_Bengali, Space_Grotesk } from "next/font/google";
import { miithiiThemeInitScript } from "@miithii/ui";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-miithii-display", display: "swap" });
const body = Manrope({ subsets: ["latin"], variable: "--font-miithii-body", display: "swap" });
const assamese = Noto_Sans_Bengali({ subsets: ["bengali"], variable: "--font-miithii-assamese", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://chat.miithii.in"),
  title: "Miithii Chat | Chat in Assamese and English",
  description: "Chat with Miithii in English, Assamese, or both. Ask, write, plan, and continue conversations with useful context carried forward.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Miithii Chat | Chat in Assamese and English",
    description: "Ask, write, plan, and chat naturally in English, Assamese, or both.",
    url: "https://chat.miithii.in",
    siteName: "Miithii",
    type: "website",
    locale: "en_IN"
  },
  twitter: {
    card: "summary",
    title: "Miithii Chat | Chat in Assamese and English",
    description: "Ask, write, plan, and chat naturally in English, Assamese, or both."
  }
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
      className={`${display.variable} ${body.variable} ${assamese.variable}`}
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
