import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { PageTransitionWrapper } from "@/components/layout/page-transition-wrapper";

// Inter for UI text, labels, paragraphs
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "optional",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

// JetBrains Mono for numbers, prices, data, code
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "optional",
  weight: ["400", "500", "600"],
});

// Newsreader for premium serif headings (Anthropic research aesthetic)
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "optional",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "HEADSTART — Smarter Alpha",
  description:
    "Your thinking partner for institutional-grade trading intelligence. Discover alpha signals, options flow, and AI-driven research.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} ${newsreader.variable} antialiased`}>
        <PageTransitionWrapper>
          {children}
        </PageTransitionWrapper>
      </body>
    </html>
  );
}