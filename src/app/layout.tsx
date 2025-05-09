import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "./providers";
import { LayoutShell } from "@/components/LayoutShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Miithii",
  description: "Your AI Language Learning Assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <Providers>
            <LayoutShell>{children}</LayoutShell>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
