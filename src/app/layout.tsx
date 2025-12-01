import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
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

// Premium serif font for headings - warm, intelligent feel
const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f0f10",
};

export const metadata: Metadata = {
  title: "Miithii - Chat with AI in Assamese",
  description: "Miithii speaks your language. Real AI conversations in Axomiya that spark ideas, solve problems, and maybe even roast your bad puns. Built by Prompt Mafia Inc.",
  keywords: ["Assamese AI", "Axomiya chat", "Miithii", "Guwahati", "Prompt Mafia", "AI chatbot"],
  authors: [{ name: "Prompt Mafia Inc." }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Miithii - Chat with AI in Assamese",
    description: "Real AI conversations in Axomiya. Built by Prompt Mafia Inc.",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Miithii - Chat with AI in Assamese",
    description: "Real AI conversations in Axomiya. Built by Prompt Mafia Inc.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${newsreader.variable} antialiased h-screen w-screen overflow-hidden`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {children}
      </body>
    </html>
  );
}
