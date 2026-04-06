import type { Metadata } from "next";
import "./globals.css";
import { TempoInit } from "@/components/tempo-init";
import { ThemeProvider } from "@/components/theme-provider";
import PWA from "@/components/pwa-registration";
import InstallPrompt from "@/components/install-prompt";

export const metadata: Metadata = {
  title: "LinkFlux — URL Shortener & Analytics Platform",
  description: "Shorten URLs, track clicks, manage teams, and grow with real-time analytics.",
  manifest: "/manifest.json",
  themeColor: "#7c3aed",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LinkFlux",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          <PWA />
          <InstallPrompt />
        </ThemeProvider>
        <TempoInit />
      </body>
    </html>
  );
}

