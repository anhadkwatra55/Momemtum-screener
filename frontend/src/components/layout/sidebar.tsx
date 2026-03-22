"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { SIDEBAR_NAV, COLORS, ROUTES, Z_INDEX_SIDEBAR, Z_INDEX_SIDEBAR_OVERLAY } from "@/lib/constants";
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
  item,
  isActive,
  onClick,
  showSectionHeader,
  itemIndex,
}: SidebarNavItemProps) {
  const handleClick = useCallback(() => {
    onClick(item.pageId);
  }, [onClick, item.pageId]);

  return (
    <>
      {showSectionHeader && (
        <div
          className={cn(
            "px-4 pb-1 text-label-uppercase",
            itemIndex === 0 ? "pt-4" : "pt-4 mt-1 border-t border-[#2A2A2A]"
          )}
        >
          {item.section}
        </div>
      )}
      <button
        className={cn(
          "w-full flex items-center gap-2.5 px-4 py-1.5 text-[12px] text-left group min-h-[32px]",
          "rounded-none border-l-2",
          "transition-all duration-[50ms] ease-out",
          isActive
            ? "border-l-[#00FF66] bg-[#1C1C1C] text-[#00FF66] font-semibold"
            : "border-l-transparent text-[#C0C0C0] hover:bg-[#161616] hover:text-[#E8E8E8]"
        )}
        onClick={handleClick}
        aria-current={isActive ? "page" : undefined}
      >
        <SFIcon
          name={item.icon as SFSymbolName}
          size={14}
          className={cn(
            "w-4 text-center flex-shrink-0",
            isActive ? "text-[#00FF66]" : "text-[#6B6B6B] group-hover:text-[#C0C0C0]"
          )}
        />
        <span className="truncate font-mono-data">{item.label}</span>
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
    <nav className="flex flex-col h-full overflow-y-auto py-2">
      {/* Logo */}
      <Link href={ROUTES.home} passHref className="group">
        <div className="flex items-center gap-2.5 px-4 pt-2 pb-3 min-h-[36px]">
          <div className="w-8 h-8 rounded-[3px] flex items-center justify-center text-sm font-extrabold text-black bg-[#00FF66] flex-shrink-0 font-mono-data">
            H
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-bold tracking-[0.15em] text-[#E8E8E8] font-mono-data uppercase">HEADSTART</h2>
            <p className="text-[10px] text-[#6B6B6B] truncate font-mono-data tracking-[0.05em]">
              CARBON TERMINAL v2.0
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-auto md:hidden w-8 h-8 flex items-center justify-center text-[#6B6B6B] hover:text-[#E8E8E8] transition-all duration-[50ms] border border-[#2A2A2A] rounded-[2px] hover:border-[#00FF66]"
              aria-label="Close sidebar"
            >
              <SFIcon name="xmark" size={16} />
            </button>
          )}
        </div>
      </Link>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto space-y-0">
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

      {/* Footer — Engine Status */}
      <div className="px-4 py-2.5 border-t border-[#2A2A2A]">
        <div className="flex items-center gap-2 text-[10px] font-mono-data">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00FF66] ct-pulse flex-shrink-0" />
          <span className="text-[#00FF66] tracking-[0.08em] uppercase">Engine Active</span>
        </div>
        {dbStats && (
          <div className="text-[10px] text-[#6B6B6B] mt-1.5 font-mono-data tracking-[0.02em]">
            <SFIcon name="database" size={10} className="mr-1 inline-block opacity-60" />{dbStats}
          </div>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop: Fixed left panel */}
      <div className="hidden md:block fixed top-0 bottom-0 left-0 w-[200px] z-40 bg-[#0A0A0A] border-r border-[#2A2A2A]">
        {sidebarContent}
      </div>

      {/* Mobile: slide-in overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/80 z-[80] md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={onClose}
              aria-label="Close sidebar"
            />
            <motion.div
              className="fixed top-0 bottom-0 left-0 w-[200px] md:hidden z-40 bg-[#0A0A0A] border-r border-[#2A2A2A]"
              initial={{ x: -220 }}
              animate={{ x: 0 }}
              exit={{ x: -220 }}
              transition={{ duration: 0.1, ease: "easeOut" }}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});