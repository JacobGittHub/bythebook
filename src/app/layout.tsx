import type { Metadata } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono, Literata } from "next/font/google";
import { AppearanceProvider } from "@/context/Appearance";
import { APPEARANCE_SCRIPT } from "@/lib/appearance";
import "./globals.css";

// The book's three faces (plans/book-ui.md D2): Literata for headings, Atkinson Hyperlegible
// for text and IBM Plex Mono for figures. globals.css turns them into the --font-* tokens.
const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
      className={`${literata.variable} ${atkinson.variable} ${plexMono.variable} h-full antialiased`}
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
