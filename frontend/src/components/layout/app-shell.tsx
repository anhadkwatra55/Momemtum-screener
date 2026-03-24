"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./topnav";

interface AppShellProps {
  children: (activePage: string, setActivePage: (p: string) => void) => React.ReactNode;
  dbStats?: string;
}

function AppShellInner({ children, dbStats }: AppShellProps) {
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") || "market-pulse";

  const [activePage, setActivePage] = useState(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync with URL changes (e.g. back/forward navigation)
  useEffect(() => {
    const view = searchParams.get("view");
    if (view && view !== activePage) {
      setActivePage(view);
    }
  }, [searchParams]);

  const handleNavigate = useCallback((page: string) => {
    setActivePage(page);
    setSidebarOpen(false);
    // Update URL without full page reload
    const url = new URL(window.location.href);
    url.searchParams.set("view", page);
    window.history.replaceState({}, "", url.toString());
  }, []);

  const handleOpenSidebar = useCallback(() => setSidebarOpen(true), []);
  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]" style={{ fontFamily: "'Inter', var(--font-sans), sans-serif" }}>
      {/* Top Nav — z-50 */}
      <TopNav onMenuClick={handleOpenSidebar} />

      {/* Sidebar — desktop z-30, mobile overlay z-90, mobile panel z-100 */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        dbStats={dbStats}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
      />

      {/* Main content — no z-index needed, natural flow */}
      <main className="ml-0 md:ml-[220px] flex-1 min-w-0 overflow-x-hidden px-3 py-3 md:px-5 md:py-5 min-h-screen pt-[54px] md:pt-[54px]">
        {children(activePage, setActivePage)}
      </main>
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export function AppShell(props: AppShellProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#2d2d2d] border-t-[#e2b857] rounded-full animate-spin" />
      </div>
    }>
      <AppShellInner {...props} />
    </Suspense>
  );
}