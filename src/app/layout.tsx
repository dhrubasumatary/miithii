import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Miithii — Your Assamese AI",
  description:
    "Miithii is a premium AI assistant built for Assam. Chat in Assamese, English, or both. Powered by advanced language models with real memory.",
  keywords: [
    "Assamese AI",
    "Miithii",
    "AI chatbot",
    "Assam",
    "Guwahati",
    "Assamese language",
    "AI assistant",
  ],
  authors: [{ name: "Prompt Mafia Inc.", url: "https://miithii.in" }],
  openGraph: {
    title: "Miithii — Your Assamese AI",
    description: "Premium AI assistant built for Assam.",
    url: "https://miithii.in",
    siteName: "Miithii",
    locale: "en_IN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
