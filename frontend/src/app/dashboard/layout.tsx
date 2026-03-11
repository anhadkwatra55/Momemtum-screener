import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Intelligence Dashboard — MOMENTUM",
  description:
    "Real-time momentum intelligence, signal screening, and strategy execution. Institutional-grade analytics for precision trading.",
};

/**
 * Server Component layout for /dashboard.
 *
 * Provides:
 * - Route-level metadata (title, description) for SEO without client JS
 * - A stable outer shell that avoids re-mounting on sub-navigation
 * - The sidebar and interactive chrome live inside the client-side AppShell
 *   (rendered by page.tsx) because navigation state, framer-motion animations,
 *   and the Sheet component all require "use client"
 *
 * The key architectural win here is that Next.js caches this layout across
 * navigations, so the metadata + font loading + CSS are never re-evaluated.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
