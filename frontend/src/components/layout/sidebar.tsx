"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn, getTextColorClass, getBackgroundColorClass, getBorderColorClass } from "@/lib/utils";
import { SIDEBAR_NAV, COLORS, SPRING_TRANSITION, TAP_TRANSITION, ROUTES, Z_INDEX_STICKY_HEADER, Z_INDEX_SIDEBAR, Z_INDEX_SIDEBAR_OVERLAY } from "@/lib/constants";
import React, { useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { SFIcon, SFSymbolName } from "@/components/ui/SFIcon"; // Extracted SFIcon to a dedicated component

interface SidebarNavItemProps {
  item: typeof SIDEBAR_NAV[0];
  isActive: boolean;
  onClick: (pageId: string) => void;
  showSectionHeader: boolean;
  itemIndex: number;
}

const SidebarNavItem = React.memo(function SidebarNavItem({
  item,
  isActive,
  onClick,
  showSectionHeader,
  itemIndex,
}: SidebarNavItemProps) {
  const handleClick = useCallback(() => {
    onClick(item.pageId);
  }, [onClick, item.pageId]);

  const hoverShadow = useMemo(
    () =>
      isActive
        ? `0 0 0 3px ${COLORS.cyan}, var(--shadow-soft)` // Cyan glow for active
        : `var(--shadow-soft)`, // Softer shadow for inactive
    [isActive]
  );

  return (
    <>
      {showSectionHeader && (
        <div
          className={cn(
            "px-5 pb-2 text-xs font-bold uppercase tracking-[0.1em] text-sidebar-foreground/60",
            itemIndex === 0 ? "pt-6" : "pt-4",
            "sticky top-0 z-[var(--z-sticky-header)] bg-background/80 backdrop-blur-sm" // Use semantic z-index
          )}
        >
          {item.section}
        </div>
      )}
      <motion.button
        className={cn(
          "w-full flex items-center gap-3 px-5 py-3 text-base text-left group min-h-[48px]",
          "rounded-[var(--radius-2xl)]", // Ensures 1rem+ border-radius
          "transition-colors duration-200",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary font-semibold"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
        )}
        onClick={handleClick}
        whileHover={{
          translateY: -2,
          boxShadow: hoverShadow,
        }}
        whileTap={TAP_TRANSITION}
        transition={SPRING_TRANSITION}
        aria-current={isActive ? "page" : undefined}
      >
        <SFIcon
          name={item.icon as SFSymbolName} // Cast to SFSymbolName as it's now a defined type
          size={20}
          className={cn(
            "w-6 text-center flex-shrink-0 transition-transform duration-200",
            isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:scale-105 group-hover:text-sidebar-foreground"
          )}
        />
        <span className="truncate">{item.label}</span>
      </motion.button>
    </>
  );
});

interface SidebarProps {
  activePage: string;
  onNavigate: (pageId: string) => void;
  dbStats?: string;
  /** Mobile-only: whether the sidebar overlay is open. */
  isOpen?: boolean;
  /** Mobile-only: callback to close the sidebar. */
  onClose?: () => void;
}

export const Sidebar = React.memo(function Sidebar({
  activePage,
  onNavigate,
  dbStats,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const handleNavClick = useCallback(
    (pageId: string) => {
      onNavigate(pageId);
      if (onClose) onClose();
    },
    [onNavigate, onClose]
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, isOpen]);

  const sidebarContent = (
    <nav
      className={cn(
        "flex flex-col h-full text-[--sidebar-foreground] overflow-y-auto",
        "py-3" // Overall vertical padding for content breathing room
      )}
    >
      {/* Logo and Close Button for Mobile */}
      <Link href={ROUTES.home} passHref className="group">
        <div className="flex items-center gap-3 px-5 pt-2 pb-4 min-h-[44px]"> {/* Ensure touch target */}
          <motion.div
            className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-extrabold text-white flex-shrink-0",
              "bg-gradient-to-br from-cyan-500 to-cyan-700" // Uses primary accent shades
            )}
            initial={false}
            whileHover={{ scale: 1.05, boxShadow: `0 0 0 3px ${COLORS.cyan}, var(--shadow-soft)` }} // Subtle border glow on hover
            whileTap={TAP_TRANSITION}
            transition={SPRING_TRANSITION}
          >
            M
          </motion.div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold [letter-spacing:-0.03em]">MOMENTUM</h2>
            <p className="text-sm text-sidebar-foreground/70 truncate">
              Intelligence for the Modern Trader.
            </p>
          </div>
          {onClose && (
            <motion.button
              onClick={onClose}
              className={cn(
                "ml-auto md:hidden w-11 h-11 flex items-center justify-center rounded-[var(--radius-2xl)] transition-colors flex-shrink-0",
                "text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400", // Correct ring color
                "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "border border-transparent hover:border-background/20" // Subtle border on hover
              )}
              whileHover={{
                backgroundColor: "rgba(255,255,255,0.08)", // More subtle dark mode background on hover
                color: "var(--foreground)",
              }}
              whileTap={TAP_TRANSITION}
              transition={SPRING_TRANSITION}
              aria-label="Close sidebar"
            >
              <SFIcon name="xmark" size={20} />
            </motion.button>
          )}
        </div>
      </Link>

      {/* Nav Items - Removed `pr-3` to rely on `custom-scrollbar` for visual consistency */}
      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
        {SIDEBAR_NAV.reduce((acc: JSX.Element[], item, index) => {
          const showSection = index === 0 || item.section !== SIDEBAR_NAV[index - 1].section;
          acc.push(
            <SidebarNavItem
              key={item.pageId}
              item={item}
              isActive={activePage === item.pageId}
              onClick={handleNavClick}
              showSectionHeader={showSection}
              itemIndex={index}
            />
          );
          return acc;
        }, [])}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 bg-background/50 backdrop-blur-sm rounded-b-[var(--radius-3xl)] md:rounded-b-none border-t border-background/20">
        <div className="flex items-center gap-2 text-sm font-medium">
          {/* Status indicator uses primary accent (cyan) for UI status */}
          <div className={cn("w-2 h-2 rounded-full animate-pulse-glow flex-shrink-0", getBackgroundColorClass('cyan', '400'))} />
          <span className={getTextColorClass('cyan', '400')}>Pipeline Active</span>
        </div>
        {dbStats && (
          <div className="text-xs text-sidebar-foreground/60 mt-2 font-mono-data">
            <SFIcon name="database" size={12} className="mr-1 inline-block opacity-60" />{dbStats}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop: Always visible, fixed position on the left */}
      <div className="hidden md:block fixed top-0 bottom-0 left-0 w-[260px] z-[var(--z-sidebar)] overflow-hidden apple-card rounded-r-[var(--radius-3xl)]"> {/* Use semantic z-index */}
        {sidebarContent}
      </div>

      {/* Mobile: slide-in overlay with backdrop */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 glass-subtle z-[var(--z-sidebar-overlay)] md:hidden" // Use semantic z-index
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              aria-label="Close sidebar"
            />
            <motion.div
              className="fixed top-0 bottom-0 left-0 w-[260px] md:hidden z-[var(--z-sidebar)] apple-card rounded-r-[var(--radius-3xl)]" // Use semantic z-index
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={SPRING_TRANSITION}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});