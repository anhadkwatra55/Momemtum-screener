"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import React, { useMemo } from "react";
import { cn, getTextColorClass, getFromColorClass, getToColorClass, getBackgroundColorClass } from "@/lib/utils";
import { ROUTES, COLORS, Z_INDEX, MOTION, SHADOWS, TYPOGRAPHY } from "@/lib/constants";

// --- SF Symbol SVG Paths (simplified paths for demonstration, in a real project these would be precise) ---
// This map allows `SFIcon` to render actual SVG icons based on SF Symbol names.
const SF_SYMBOLS_SVG_PATHS: Record<string, string> = {
  "square.grid.2x2.fill": "M4 4h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm12 0h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1zM4 16h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zm12 0h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1z",
  "flask.fill": "M16.5 2H7.5A2.5 2.5 0 0 0 5 4.5v16A2.5 2.5 0 0 0 7.5 23h9A2.5 2.5 0 0 0 19 20.5V4.5A2.5 2.5 0 0 0 16.5 2zm-9 2h9a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5zM6 9h12v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9zM9 13v-1h6v1h-6zm0 3v-1h6v1h-6z",
  "arrow.up.arrow.down.circle.fill": "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14.5a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-1.5v3.5zm-1-10a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-1.5v3.5a.5.5 0 0 1-1 0v-4z",
  "bell.fill": "M12 2C7.589 2 4 5.589 4 10v6l-2 2v1h20v-1l-2-2v-6c0-4.411-3.589-8-8-8zm0 18c-1.654 0-3-1.346-3-3h6c0 1.654-1.346 3-3 3z",
  "person.crop.circle.fill": "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-4 9a7 7 0 0 1 8 0v1.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V14z",
  "bolt.fill": "M13.682 2.21A.9.9 0 0 0 12.83 2h-1.5a.9.9 0 0 0-.85.79l-4 9a.9.9 0 0 0 .8.92h3.5l-1.5 8a.9.9 0 0 0 .7.99.9.9 0 0 0 .84-.13l9-10a.9.9 0 0 0-.7-.99h-3.5l1.5-8a.9.9 0 0 0-.7-.98z",
};

const SFIcon = React.memo(({ name, className }: { name: string; className?: string }) => {
  const path = SF_SYMBOLS_SVG_PATHS[name];

  if (!path) {
    console.warn(`SF Symbol "${name}" not found in local paths. Displaying a generic placeholder.`);
    // Fallback to a consistent, generic SVG icon (e.g., a question mark circle)
    // to maintain layout and indicate missing data, rather than a text character.
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn("w-[1.25em] h-[1.25em] text-current", className)}
        aria-hidden="true"
      >
        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14.5a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-1.5v3.5zm-1-10a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-1.5v3.5a.5.5 0 0 1-1 0v-4z" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24" // Standard viewBox for most SF Symbols paths
      fill="currentColor"
      className={cn("w-[1.25em] h-[1.25em] text-current flex-shrink-0", className)} // Ensure size scales with text utilities
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
});
SFIcon.displayName = "SFIcon";

interface TopNavItemData {
  label: string;
  href: string;
  icon: string; // SF Symbol name
}

const TOP_NAV_LINKS: TopNavItemData[] = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: "square.grid.2x2.fill" },
  { label: "Research", href: "/research", icon: "flask.fill" },
  { label: "Trade", href: "/trade", icon: "arrow.up.arrow.down.circle.fill" },
  { label: "Alerts", href: "/alerts", icon: "bell.fill" },
  { label: "Account", href: "/account", icon: "person.crop.circle.fill" },
];

const TopNavItem = React.memo(
  ({ label, href, icon }: TopNavItemData) => {
    return (
      <motion.div
        whileHover={{
          y: -2, // Subtle lift effect
          boxShadow: SHADOWS.ACCENT_GLOW_PRIMARY, // Primary accent glow
          backgroundColor: `rgba(255, 255, 255, 0.08)`, // Specific translucent white tint for hover
          transition: MOTION.SPRING_PRESET,
        }}
        whileTap={{ scale: 0.98 }} // Pressed state
        className="relative"
      >
        <Link
          href={href}
          className={cn(
            "flex items-center justify-center sm:justify-start gap-1.5",
            "text-sm font-medium",
            "text-muted-foreground hover:text-foreground", // Semantic colors for text
            "px-3.5 sm:px-4",
            "h-[44px]", // Ensures generous touch target size (44x44px minimum)
            "rounded-2xl", // Generous rounded corners (2rem)
            getBackgroundColorClass('white', '500', '5'), // Uses bg-white/5 for default background, consistent with design tokens
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "whitespace-nowrap"
          )}
        >
          <SFIcon name={icon} className="text-xl sm:text-lg text-foreground" />
          <span className={cn("hidden sm:inline-block text-sm", TYPOGRAPHY.UI_LABEL_TRACKING_CLASS)}>
            {label}
          </span>
        </Link>
      </motion.div>
    );
  }
);
TopNavItem.displayName = "TopNavItem";

interface TopNavProps {
  title?: string;
  icon?: string; // SF Symbol name for the app logo
}

export const TopNav = React.memo(function TopNav({
  title = "MOMENTUM",
  icon = "bolt.fill",
}: TopNavProps) {
  const logoHoverProps = useMemo(() => ({
    y: -2,
    boxShadow: SHADOWS.ACCENT_GLOW_PRIMARY,
    scale: 1.02,
    transition: MOTION.SPRING_PRESET,
  }), []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 h-14",
      "bg-[var(--card)] backdrop-blur-xl shadow-[var(--shadow-soft)]", // Uses semantic CSS variable for card background and backdrop-blur
      "px-4 sm:px-7 flex items-center justify-between",
      `z-${Z_INDEX.TOP_NAV}` // Uses centralized Z-index constant
    )}>
      <Link href={ROUTES.home} className="flex items-center gap-3 no-underline">
        <motion.div
          whileHover={logoHoverProps}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "relative w-11 h-11 rounded-2xl",
            "bg-gradient-to-br",
            getFromColorClass('cyan', '500'), // Uses utility for gradient start color
            getToColorClass('cyan', '600'),   // Uses utility for gradient end color
            "flex items-center justify-center text-lg font-extrabold",
            getTextColorClass('white', '500'), // Uses utility for text color
            "shadow-[var(--shadow-soft)] flex-shrink-0 overflow-hidden"
          )}
        >
          <SFIcon name={icon} className={cn(getTextColorClass('white', '500'), "text-xl")} /> {/* Uses utility for icon color */}
        </motion.div>
        <h1 className={cn("text-lg font-extrabold text-foreground hidden sm:block", TYPOGRAPHY.HERO_TRACKING_CLASS)}>
          {title}
        </h1>
      </Link>

      <div className="flex items-center gap-1 sm:gap-2.5">
        {TOP_NAV_LINKS.map((item) => (
          <TopNavItem
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.icon}
          />
        ))}
      </div>
    </nav>
  );
});