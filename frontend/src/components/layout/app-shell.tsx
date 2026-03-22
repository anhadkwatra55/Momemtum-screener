"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "./sidebar";
import { TopNav } from "./topnav";

interface AppShellProps {
  children: (activePage: string, setActivePage: (p: string) => void) => React.ReactNode;
  dbStats?: string;
}

export function AppShell({ children, dbStats }: AppShellProps) {
  const [activePage, setActivePage] = useState("market-pulse");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = useCallback((page: string) => {
    setActivePage(page);
    setSidebarOpen(false);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#000000]">
      {/* Engine Status Bar (Top) */}
      <TopNav />

      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onNavigate={handleNavigate}
        dbStats={dbStats}
        isOpen={sidebarOpen}
        onClose={useCallback(() => setSidebarOpen(false), [])}
      />

      {/* Mobile hamburger */}
      <button
        className="fixed top-[10px] left-2 z-50 md:hidden w-8 h-8 flex items-center justify-center bg-[#111111] border border-[#2A2A2A] rounded-[2px] text-[#C0C0C0] hover:text-[#00FF66] hover:border-[#00FF66] transition-all duration-[50ms]"
        aria-label="Open menu"
        onClick={() => setSidebarOpen(true)}
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path d="M2 4h12v1H2zm0 3.5h12v1H2zm0 3.5h12v1H2z" />
        </svg>
      </button>

      {/* Main content */}
      <main className="ml-0 md:ml-[200px] flex-1 min-w-0 overflow-x-hidden p-2 md:p-3 min-h-screen relative z-[1] pt-[56px] md:pt-[56px]">
        {children(activePage, setActivePage)}
      </main>
    </div>
  );
}