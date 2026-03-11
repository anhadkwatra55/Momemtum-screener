import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PageTransitionWrapper } from "@/components/layout/page-transition-wrapper";

// Inter for UI text, labels, paragraphs
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  // Using 'optional' to ensure absolute visual seamlessness.
  // This avoids any 'flash of unstyled text' (FOUT) by either
  // rendering the custom font instantly or gracefully sticking to
  // a fallback without a jarring swap.
  display: "optional",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

// JetBrains Mono for numbers, prices, data, code
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  // Consistent 'optional' display strategy for all custom fonts
  // to maintain a premium, glitch-free visual experience.
  display: "optional",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Evocative title that reflects the platform's power and user benefit.
  title: "MOMENTUM — Unleash Your Trading Edge",
  // Compelling, benefit-driven description for a premium digital experience,
  // aligning with the "IQ 300" standard of telling a story for every interaction.
  description:
    "Unlock unparalleled market insights with MOMENTUM: a premium trading platform engineered for precision. Discover real-time signals, build powerful strategies, and backtest with confidence to elevate your financial edge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrains.variable} antialiased`}>
        <PageTransitionWrapper>
          {children}
        </PageTransitionWrapper>
      </body>
    </html>
  );
}