import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppearanceProvider } from "@/context/Appearance";
import { APPEARANCE_SCRIPT } from "@/lib/appearance";
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
  title: "ByTheBook",
  description: "Chess opening training, repertoire building, and puzzle review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The head script sets the theme and vibes from the browser's settings before the first
    // paint, so <html> differs from the server's render on purpose.
    <html
      lang="en"
      data-theme="light"
      data-vibes="on"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
