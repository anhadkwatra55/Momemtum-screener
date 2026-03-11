"use client";

import { useState, useCallback, useMemo } from "react";
import { Sidebar } from "./sidebar";
import { motion } from "framer-motion";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { SFIcon } from "../ui/sf-icon";
import {
  SPRING_PHYSICS_DEFAULT,
  Z_INDEX,
  HAMBURGER_BUTTON_INITIAL_SHADOW,
  HAMBURGER_BUTTON_HOVER_SHADOW,
} from "../../lib/constants";

interface AppShellProps {
  children: (activePage: string, setActivePage: (p: string) => void) => React.ReactNode;
  dbStats?: string;
}

export function AppShell({ children, dbStats }: AppShellProps) {
  const [activePage, setActivePage] = useState("intelligence");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const hamburgerInitial = useMemo(() => ({
    y: 0,
    boxShadow: HAMBURGER_BUTTON_INITIAL_SHADOW,
  }), []);

  const hamburgerWhileHover = useMemo(() => ({
    y: -2,
    boxShadow: HAMBURGER_BUTTON_HOVER_SHADOW,
  }), []);

  const hamburgerTransition = useMemo(() => (
    SPRING_PHYSICS_DEFAULT
  ), []);

  const handleNavigate = useCallback((page: string) => {
    setActivePage(page);
    setSidebarOpen(false); // Close the mobile sheet on navigation
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar — Always present and visible on medium screens and above */}
      <div className="hidden md:block">
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          dbStats={dbStats}
          isOpen={true} // For desktop, Sidebar is always conceptually "open"
          onClose={useCallback(() => {}, [])} // No-op for desktop as it's not a temporary modal
        />
      </div>

      {/* Mobile Sidebar (Sheet) — Only visible on small screens when triggered */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <motion.button
          className={`fixed top-3 left-3 z-50 md:hidden w-11 h-11 flex items-center justify-center rounded-2xl bg-card/80 glass cursor-pointer`}
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          initial={hamburgerInitial}
          whileHover={hamburgerWhileHover}
          whileTap={{ scale: 0.95 }}
          transition={hamburgerTransition}
        >
          <SFIcon name="line.horizontal.3" className="text-foreground" />
        </motion.button>
        <SheetContent side="left" className="p-0 bg-transparent border-none w-[240px]">
          {/* Sidebar content for mobile, rendered inside the Sheet.
              The Sidebar component itself is expected to apply its glassmorphic background and styling. */}
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            dbStats={dbStats}
            isOpen={true} // When inside SheetContent, Sidebar content is conceptually "open"
            onClose={useCallback(() => setSidebarOpen(false), [])} // If Sidebar has an internal close button, it should close the sheet
          />
        </SheetContent>
      </Sheet>

      {/* Main content — collapses margin on mobile, takes sidebar space on desktop */}
      <main className="ml-0 md:ml-[240px] flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 min-h-screen relative z-[1] pt-16 md:pt-6">
        {children(activePage, setActivePage)}
      </main>
    </div>
  );
}