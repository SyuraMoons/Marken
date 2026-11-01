import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { RootPrefs } from "@/components/root-prefs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MARKEN",
  description: "Your AI marketing team. One ready post every day.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2456db",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <RootPrefs />
        {children}
      </body>
    </html>
  );
}
