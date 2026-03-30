import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import { TempoInit } from "@/components/tempo-init";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "LinkFlux — URL Shortener & Analytics Platform",
  description: "Shorten URLs, track clicks, manage teams, and grow with real-time analytics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <TempoInit />
      </body>
    </html>
  );
}

