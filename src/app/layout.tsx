import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/ui/navbar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
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
        className={`${inter.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased bg-black text-[#EDEDED]`}
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <Navbar />
        {children}
      </body>
    </html>
  );
}
