import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEO-Guardian | Asteroid Proximity & Risk Dashboard",
  description:
    "Real-time Near-Earth Object tracking with custom Impact Hazard Scoring. Data powered by NASA's Small-Body Database.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NEO-Guardian",
  },
};

export const viewport: Viewport = {
  themeColor: "#38bdf8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-space-950 text-slate-200 font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
