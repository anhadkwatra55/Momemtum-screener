"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV, ROUTES } from "@/lib/constants";
import React, { useEffect, useCallback } from "react";
import Link from "next/link";
import { SFIcon, SFSymbolName } from "@/components/ui/SFIcon";

interface SidebarNavItemProps {
  item: typeof SIDEBAR_NAV[0];
  isActive: boolean;
  onClick: (pageId: string) => void;
  showSectionHeader: boolean;
  itemIndex: number;
}

const SidebarNavItem = React.memo(function SidebarNavItem({
  item, isActive, onClick, showSectionHeader, itemIndex,
}: SidebarNavItemProps) {
  const handleClick = useCallback(() => onClick(item.pageId), [onClick, item.pageId]);

  return (
    <>
      {showSectionHeader && (
        <div className={cn(
          "px-5 pb-1 text-[10px] font-medium tracking-[0.08em] uppercase text-[#707070]",
          itemIndex === 0 ? "pt-4" : "pt-5 mt-2"
        )}>
          {item.section}
        </div>
      )}
      <button
        className={cn(
          "w-full flex items-center gap-3 px-5 py-2 text-[13px] text-left group",
          "rounded-md mx-1 transition-all duration-200 ease-out",
          isActive
            ? "bg-[#1e1e1e] text-[#e2b857] font-medium"
            : "text-[#a0a0a0] hover:bg-[#1a1a1a] hover:text-[#e0e0e0]"
        )}
        style={{ width: "calc(100% - 8px)" }}
        onClick={handleClick}
        aria-current={isActive ? "page" : undefined}
      >
        <SFIcon
          name={item.icon as SFSymbolName}
          size={14}
          className={cn(
            "w-4 text-center flex-shrink-0 transition-colors duration-200",
            isActive ? "text-[#e2b857]" : "text-[#505050] group-hover:text-[#a0a0a0]"
          )}
        />
        <span className="truncate">{item.label}</span>
      </button>
    </>
  );
});

interface SidebarProps {
  activePage: string;
  onNavigate: (pageId: string) => void;
  dbStats?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = React.memo(function Sidebar({
  activePage, onNavigate, dbStats, isOpen = false, onClose,
}: SidebarProps) {
  const handleNavClick = useCallback((pageId: string) => {
    onNavigate(pageId);
    if (onClose) onClose();
  }, [onNavigate, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose && isOpen) { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, isOpen]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  const sidebarContent = (
    <nav className="flex flex-col h-full overflow-y-auto py-2" style={{ fontFamily: "'Inter', var(--font-sans), sans-serif" }}>
      {/* Logo */}
      <Link href={ROUTES.home} passHref className="group no-underline">
        <div className="flex items-center gap-3 px-5 pt-3 pb-4">
          <div className="w-8 h-8 rounded-md flex items-center justify-center text-sm font-bold text-[#0d0d0d] bg-[#e2b857] flex-shrink-0">
            H
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-semibold tracking-wide text-[#e0e0e0]">HEADSTART</h2>
            <p className="text-[10px] text-[#505050] truncate tracking-wide">
              Research Terminal
            </p>
          </div>
          {onClose && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              className="md:hidden w-8 h-8 flex items-center justify-center text-[#707070] hover:text-[#e0e0e0] transition-all duration-200 border border-[#2d2d2d] rounded-md hover:border-[#e2b857]"
              aria-label="Close sidebar"
            >
              <SFIcon name="xmark" size={16} />
            </button>
          )}
        </div>
      </Link>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto space-y-0.5 px-1">
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
      <div className="px-5 py-3 border-t border-[#2d2d2d]">
        <div className="flex items-center gap-2 text-[10px]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" style={{ boxShadow: "0 0 6px rgba(74,222,128,0.5)" }} />
          <span className="text-[#4ade80] tracking-wide font-medium">Engine Active</span>
        </div>
        {dbStats && (
          <div className="text-[10px] text-[#505050] mt-1.5 tracking-wide">
            <SFIcon name="database" size={10} className="mr-1 inline-block opacity-50" />{dbStats}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop: fixed left panel — z-30, below topnav(z-50) */}
      <div className="hidden md:block fixed top-0 bottom-0 left-0 w-[220px] z-30 bg-[#111111] border-r border-[#2d2d2d]">
        {sidebarContent}
      </div>

      {/* Mobile: overlay + slide-in panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop: z-[90] covers everything */}
            <motion.div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
            />
            {/* Panel: z-[100] on top of backdrop */}
            <motion.div
              className="fixed top-0 bottom-0 left-0 w-[260px] md:hidden z-[100] bg-[#111111] border-r border-[#2d2d2d] shadow-2xl"
              initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});