"use client";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { YieldSignal } from "@/types/momentum";
import { cn, getTextColorClass, getBackgroundColorClass } from "@/lib/utils";
import {
  SENTIMENT_STYLES,
  SPRING_TRANSITION_PROPS,
  PAGE_TRANSITION_VARIANTS_PROPS,
  STAGGER_CHILDREN_DELAY_MS,
  DEFAULT_ICON_SIZE_LG,
  DEFAULT_ICON_SIZE_MD,
  DEFAULT_ICON_SIZE_SM,
  DEFAULT_TOUCH_TARGET_MIN_SIZE
} from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";

// --- Z-Index Constants (would typically be in lib/constants.ts) ---
// Defined locally for this component as per output rules,
// but in a full project, these would be centralized.
const Z_INDEX = {
  DEFAULT: 0,
  STICKY_ELEMENT: 10,
  STICKY_HEADER: 20,
  FLASH_OVERLAY: 30,
  OVERLAY: 40,
  MODAL: 50,
  DIALOG: 60,
  POPOVER: 70,
  TOOLTIP: 80,
  NOTIFICATION: 90,
  TOP_BAR: 100,
} as const;

// --- SFIcon Component (placeholder for a real SF Symbols integration) ---
// This component abstracts icon rendering, aligning with the "SF Symbol-like names" standard.
// If a centralized `components/ui/SFIcon.tsx` existed, it would be imported instead.
interface SFIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  size?: 'sm' | 'md' | 'lg' | string;
}

const SFIcon = React.memo(function SFIcon({ name, size = 'md', className, ...props }: SFIconProps) {
  const iconSizeClass = useMemo(() => {
    switch (size) {
      case 'sm': return DEFAULT_ICON_SIZE_SM;
      case 'md': return DEFAULT_ICON_SIZE_MD;
      case 'lg': return DEFAULT_ICON_SIZE_LG;
      default: return size; // Allow custom Tailwind classes like "w-5 h-5"
    }
  }, [size]);

  const IconComponent = useMemo(() => {
    const baseIconProps = {
      xmlns: "http://www.w3.org/2000/svg",
      fill: "currentColor",
      className: cn("inline-block flex-shrink-0", iconSizeClass, className),
      ...props
    };

    switch (name) {
      case "chevron.up":
        return (
          <svg viewBox="0 0 24 24" {...baseIconProps}>
            <path
              fillRule="evenodd"
              d="M11.47 7.72a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 01-1.06-1.06l7.5-7.5z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "chevron.down":
        return (
          <svg viewBox="0 0 24 24" {...baseIconProps}>
            <path
              fillRule="evenodd"
              d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "magnifyingglass":
        return (
          <svg viewBox="0 0 20 20" {...baseIconProps}>
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "chart.bar.fill":
        return (
          <svg viewBox="0 0 24 24" {...baseIconProps}>
            <path d="M7 5a3 3 0 013 3v8a3 3 0 01-3 3H4a3 3 0 01-3-3V8a3 3 0 013-3h3zM16 3a3 3 0 013 3v5a3 3 0 01-3 3h-3a3 3 0 01-3-3V6a3 3 0 013-3h3zM22 8a3 3 0 013 3v8a3 3 0 01-3 3h-3a3 3 0 01-3-3v-8a3 3 0 013-3h3z" />
          </svg>
        );
      case "questionmark.circle.fill":
        return (
          <svg viewBox="0 0 24 24" {...baseIconProps}>
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.115-.453 2.162-.895 3.006-1.331.006-.003.012-.006.018-.009a.75.75 0 10-.978-1.132c-.934.48-1.87 1.018-2.802 1.559-.292.16-.41.64-.135.914.24.24.57.495.92.748.306.22.662.485 1.017.768.426.332.655.51.655.66 0 .096-.07.159-.19.159-.141 0-.334-.082-.54-.24-.21-.162-.435-.357-.665-.559a.75.75 0 10-.622 1.25c.834.61 1.637 1.14 2.404 1.547.424.225.8.337 1.107.337.311 0 .5-.06.602-.172.11-.113.11-.253.11-.385 0-.154-.066-.377-.18-.588-.184-.316-.395-.572-.63-.787a11.533 11.533 0 0-.915-.764 1.764 1.764 0 00-.59-.444zM12 15.75a.75.75 0 100 1.5.75.75 0 010-1.5z" clipRule="evenodd" />
          </svg>
        );
      default:
        console.warn(`SFIcon: Unknown icon name "${name}". Using text fallback.`);
        return <span className={cn("text-base font-inter", iconSizeClass, className)} {...props}>{name}</span>;
    }
  }, [name, iconSizeClass, className, props]);

  return IconComponent;
});
SFIcon.displayName = "SFIcon";

// Sub-component for flash animation on data updates
interface FlashWrapperProps {
  value: string | number;
  children: React.ReactNode;
  className?: string;
  flashColor?: string; // Optional custom flash color
}

const FlashWrapper = React.memo(function FlashWrapper({ value, children, className, flashColor = getBackgroundColorClass('cyan', '500', '5') }: FlashWrapperProps) {
  const [key, setKey] = useState(0);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setKey((prevKey) => prevKey + 1);
    }
    prevValueRef.current = value;
  }, [value]);

  return (
    <span className={cn("inline-block relative overflow-hidden", className)}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={key}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={cn(
            "absolute inset-0 rounded-[var(--radius-xl)] pointer-events-none",
            `z-[${Z_INDEX.FLASH_OVERLAY}]`,
            flashColor
          )}
        />
      </AnimatePresence>
      <span className={`relative z-[${Z_INDEX.FLASH_OVERLAY + 1}]`}>
        {children}
      </span>
    </span>
  );
});
FlashWrapper.displayName = "FlashWrapper";

// Sub-component for Sentiment Badge to encapsulate styling and memoization
interface SentimentBadgeProps {
  sentiment: string;
}

const SentimentBadge = React.memo(function SentimentBadge({ sentiment }: SentimentBadgeProps) {
  const style = SENTIMENT_STYLES[sentiment] || SENTIMENT_STYLES["Neutral"];
  return (
    <span
      className={cn(
        "text-xs px-2.5 py-1.5 rounded-[var(--radius-xl)] tracking-[0.1em] uppercase font-medium",
        style.bg,
        style.text,
        "inline-flex items-center justify-center transition-colors duration-200 min-w-[90px] text-center"
      )}
    >
      {sentiment || "Neutral"}
    </span>
  );
});
SentimentBadge.displayName = "SentimentBadge";

// Premium Empty State Component
const EmptyState = React.memo(function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
      <SFIcon name="questionmark.circle.fill" size="lg" className="text-muted-foreground/30 mb-4" />
      <p className="text-xl font-semibold tracking-tight text-foreground/80 mb-2">No Results Found</p>
      <p className="text-base text-muted-foreground/70 max-w-sm">{message}</p>
    </div>
  );
});
EmptyState.displayName = "EmptyState";


interface YieldTableProps {
  data: YieldSignal[];
  title: string;
  icon: string; // SF Symbol-like name
  onSelectTicker?: (ticker: string) => void;
  isLoading?: boolean;
}

// Skeleton Row Component for optimistic UI
const YieldTableSkeletonRow = React.memo(function YieldTableSkeletonRow() {
  return (
    <motion.tr
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { ...SPRING_TRANSITION_PROPS, duration: 0.3 } },
      }}
      className="border-b border-border/5 last:border-b-0"
    >
      <td className="py-4 px-4 pr-2">
        <div className="h-4 w-16 skeleton rounded-md" />
      </td>
      <td className="py-4 px-4 pr-2">
        <div className="h-4 w-32 skeleton rounded-md" />
      </td>
      <td className="py-4 px-4 pr-2">
        <div className="h-4 w-24 skeleton rounded-md" />
      </td>
      <td className="py-4 px-4 text-right">
        <div className="h-4 w-12 ml-auto skeleton rounded-md" />
      </td>
      <td className="py-4 px-4 text-right">
        <div className="h-4 w-10 ml-auto skeleton rounded-md" />
      </td>
      <td className="py-4 px-4 text-right">
        <div className="h-4 w-14 ml-auto skeleton rounded-md" />
      </td>
      <td className="py-4 px-4 text-right">
        <div className="h-4 w-10 ml-auto skeleton rounded-md" />
      </td>
      <td className="py-4 px-4 text-center">
        <div className="h-6 w-20 mx-auto skeleton rounded-xl" />
      </td>
    </motion.tr>
  );
});
YieldTableSkeletonRow.displayName = "YieldTableSkeletonRow";

const YieldTable = React.memo(function YieldTable({ data, title, icon, onSelectTicker, isLoading = false }: YieldTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"dividend_yield" | "price" | "composite" | "annual_dividend">("dividend_yield");
  const [sortAsc, setSortAsc] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledHorizontally, setIsScrolledHorizontally] = useState(false);
  const [isScrolledVertically, setIsScrolledVertically] = useState(false);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setIsScrolledHorizontally(container.scrollLeft > 0);
      setIsScrolledVertically(container.scrollTop > 0);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial check

    return () => container.removeEventListener("scroll", handleScroll);
  }, []);


  const filtered = useMemo(() => {
    if (isLoading) return [];
    const lowerSearch = search.toLowerCase();
    return data
      .filter((s) => {
        if (!lowerSearch) return true;
        return s.ticker.toLowerCase().includes(lowerSearch) || s.company_name.toLowerCase().includes(lowerSearch) || s.sector.toLowerCase().includes(lowerSearch);
      })
      .sort((a, b) => {
        const valA = a[sortKey] ?? (sortKey === "price" ? Infinity : -Infinity);
        const valB = b[sortKey] ?? (sortKey === "price" ? Infinity : -Infinity);

        const diff = (valA as number) - (valB as number);
        return sortAsc ? diff : -diff;
      });
  }, [data, search, sortKey, sortAsc, isLoading]);

  const handleSort = useCallback((key: typeof sortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortAsc((prevAsc) => !prevAsc);
      } else {
        setSortAsc(false); // Default to descending when changing sort key
      }
      return key;
    });
  }, []);

  const getYieldColorClass = useCallback((y: number) => {
    if (y >= 6) return getTextColorClass('emerald', '400');
    if (y >= 3) return getTextColorClass('amber', '400');
    return getTextColorClass('slate', '400');
  }, []);

  const getCompositeColorClass = useCallback((c: number) => {
    if (c > 0) return getTextColorClass('emerald', '400');
    if (c < 0) return getTextColorClass('rose', '400');
    return getTextColorClass('slate', '400');
  }, []);

  const renderSortIndicator = useCallback((key: typeof sortKey) => {
    if (sortKey === key) {
      return sortAsc ? <SFIcon name="chevron.up" size="sm" className="ml-1 opacity-70 group-hover:opacity-100 transition-opacity" /> : <SFIcon name="chevron.down" size="sm" className="ml-1 opacity-70 group-hover:opacity-100 transition-opacity" />;
    }
    return null;
  }, [sortKey, sortAsc]);

  // Framer Motion props for sortable table headers
  const thMotionProps = useMemo(() => ({
    whileHover: { y: -2, boxShadow: "var(--shadow-soft), var(--shadow-glow-cyan)" },
    transition: SPRING_TRANSITION_PROPS,
  }), []);

  // Framer Motion props for table rows
  const trMotionProps = useMemo(() => ({
    whileHover: { y: -2, boxShadow: "var(--shadow-elevated), var(--shadow-glow-cyan)" },
    transition: SPRING_TRANSITION_PROPS,
    variants: PAGE_TRANSITION_VARIANTS_PROPS,
  }), []);

  const stickyHeaderClasses = cn(
    "sticky top-0 bg-card/80 glass-subtle",
    `z-[${Z_INDEX.STICKY_HEADER}]`,
    isScrolledVertically ? "shadow-[0_2px_4px_rgba(0,0,0,0.2)] border-b border-border/20" : "border-b border-border/10",
    "transition-all duration-200"
  );

  const stickyColumnCellClasses = useCallback((isFirstCol: boolean) => cn(
    "sticky",
    isFirstCol ? `left-0 z-[${Z_INDEX.STICKY_ELEMENT + 1}]` : `left-[90px] md:left-[120px] z-[${Z_INDEX.STICKY_ELEMENT}]`,
    "bg-card/70 backdrop-blur-[1px] group-hover:bg-card/90 transition-colors duration-200",
    isScrolledHorizontally ? "shadow-[2px_0_4px_rgba(0,0,0,0.1)]" : "shadow-none",
    "transition-shadow duration-200"
  ), [isScrolledHorizontally]);

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={PAGE_TRANSITION_VARIANTS_PROPS}
      className="apple-card p-4 md:p-6 lg:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold tracking-[-0.03em] text-foreground flex items-center gap-3">
          <SFIcon name={icon} size="lg" className={getTextColorClass('cyan', '400')} /> {title}
        </h2>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <motion.span
            className={cn("text-sm text-muted-foreground font-inter py-2.5 px-2 flex items-center min-h-[44px]")}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.1, ...SPRING_TRANSITION_PROPS } }}
          >
            {isLoading ? "Loading results..." : `${filtered.length} ${filtered.length === 1 ? "result" : "results"}`}
          </motion.span>
          <div className="relative flex items-center">
            <motion.input
              className={cn(
                "pl-4 pr-10 py-2.5 text-sm rounded-[var(--radius-lg)]",
                getBackgroundColorClass('slate', '900', '40'), // Use tokenized background
                "border border-border outline-none min-h-[44px]", // Explicit min-height for touch target
                "w-full md:w-56",
                "font-inter text-foreground placeholder:text-muted-foreground/70",
                "shadow-[var(--shadow-soft)]",
                "focus:shadow-[var(--shadow-elevated),var(--shadow-glow-cyan)]",
                "hover:shadow-[var(--shadow-card)]",
                "glass-subtle",
                "transition-all duration-300 ease-out"
              )}
              placeholder="Search ticker, name or sector…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              whileFocus={{ scale: 1.005 }}
              transition={SPRING_TRANSITION_PROPS}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none">
              <SFIcon name="magnifyingglass" size="md" />
            </span>
          </div>
        </div>
      </div>

      <div ref={scrollContainerRef} className="overflow-x-auto horizontal-scroll-on-mobile relative rounded-[var(--radius-2xl)]">
        <table className="w-full text-sm">
          <thead className={stickyHeaderClasses}>
            <tr className="text-muted-foreground text-xs uppercase tracking-[0.1em] font-medium border-b border-border/10">
              <th className={cn("py-3.5 px-4 text-left font-semibold whitespace-nowrap w-[90px] md:w-[120px]", stickyColumnCellClasses(true))}>
                Ticker
              </th>
              <th className={cn("py-3.5 px-4 text-left font-semibold whitespace-nowrap hidden md:table-cell", stickyColumnCellClasses(false))}>
                Name
              </th>
              <th className="py-3.5 px-4 text-left font-semibold whitespace-nowrap hidden md:table-cell">Sector</th>
              <motion.th
                className="py-3.5 px-4 text-right font-semibold cursor-pointer text-slate-300 group relative touch-action-manipulation select-none"
                onClick={() => handleSort("price")}
                {...thMotionProps}
                role="button"
                aria-sort={sortKey === "price" ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                Price
                {renderSortIndicator("price")}
                <span className="absolute inset-0 rounded-[var(--radius-lg)] group-hover:bg-cyan-500/5 transition-colors duration-200"></span>
              </motion.th>
              <motion.th
                className="py-3.5 px-4 text-right font-semibold cursor-pointer text-slate-300 group relative touch-action-manipulation select-none"
                onClick={() => handleSort("dividend_yield")}
                {...thMotionProps}
                role="button"
                aria-sort={sortKey === "dividend_yield" ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                Yield %
                {renderSortIndicator("dividend_yield")}
                <span className="absolute inset-0 rounded-[var(--radius-lg)] group-hover:bg-cyan-500/5 transition-colors duration-200"></span>
              </motion.th>
              <motion.th
                className="py-3.5 px-4 text-right font-semibold cursor-pointer text-slate-300 group relative touch-action-manipulation select-none"
                onClick={() => handleSort("annual_dividend")}
                {...thMotionProps}
                role="button"
                aria-sort={sortKey === "annual_dividend" ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                Annual $
                {renderSortIndicator("annual_dividend")}
                <span className="absolute inset-0 rounded-[var(--radius-lg)] group-hover:bg-cyan-500/5 transition-colors duration-200"></span>
              </motion.th>
              <motion.th
                className="py-3.5 px-4 text-right font-semibold cursor-pointer text-slate-300 group relative touch-action-manipulation select-none"
                onClick={() => handleSort("composite")}
                {...thMotionProps}
                role="button"
                aria-sort={sortKey === "composite" ? (sortAsc ? "ascending" : "descending") : "none"}
              >
                Momentum
                {renderSortIndicator("composite")}
                <span className="absolute inset-0 rounded-[var(--radius-lg)] group-hover:bg-cyan-500/5 transition-colors duration-200"></span>
              </motion.th>
              <th className="py-3.5 px-4 text-center font-semibold whitespace-nowrap">Sentiment</th>
            </tr>
          </thead>
          <AnimatePresence mode="wait">
            <motion.tbody
              key={isLoading ? "loading" : "loaded"}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={{
                animate: { transition: { staggerChildren: STAGGER_CHILDREN_DELAY_MS } },
                exit: { transition: { staggerChildren: STAGGER_CHILDREN_DELAY_MS, staggerDirection: -1 } }
              }}
            >
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <YieldTableSkeletonRow key={`skeleton-${i}`} />
                ))
              ) : filtered.length > 0 ? (
                filtered.map((s) => (
                  <motion.tr
                    key={s.ticker}
                    className="border-b border-border/5 last:border-b-0 group relative cursor-pointer"
                    onClick={() => onSelectTicker?.(s.ticker)}
                    {...trMotionProps}
                  >
                    <td className={cn("py-4 px-4 pr-2 font-bold font-mono-data text-lg text-primary", stickyColumnCellClasses(true))}>
                      {s.ticker}
                      <span className="block text-xs font-inter text-muted-foreground/70 md:hidden max-w-[120px] truncate" title={s.company_name}>{s.company_name}</span>
                    </td>
                    <td className={cn("py-4 px-4 pr-2 text-sm font-inter text-foreground max-w-[180px] truncate hidden md:table-cell", stickyColumnCellClasses(false))} title={s.company_name}>{s.company_name}</td>
                    <td className="py-4 px-4 pr-2 text-sm font-inter text-muted-foreground max-w-[120px] truncate hidden md:table-cell" title={s.sector}>{s.sector}</td>
                    <td className="py-4 px-4 text-right font-jetbrains-mono text-lg text-foreground">
                      <FlashWrapper value={s.price}>
                        ${s.price.toFixed(2)}
                      </FlashWrapper>
                    </td>
                    <td className="py-4 px-4 text-right font-jetbrains-mono text-lg font-bold">
                      <FlashWrapper value={s.dividend_yield} className={getYieldColorClass(s.dividend_yield)}>
                        {s.dividend_yield > 0 ? `${s.dividend_yield.toFixed(2)}%` : "—"}
                      </FlashWrapper>
                    </td>
                    <td className="py-4 px-4 text-right font-jetbrains-mono text-lg text-foreground">
                      <FlashWrapper value={s.annual_dividend}>
                        {s.annual_dividend > 0 ? `$${s.annual_dividend.toFixed(2)}` : "—"}
                      </FlashWrapper>
                    </td>
                    <td className="py-4 px-4 text-right font-jetbrains-mono text-lg">
                      <FlashWrapper value={s.composite} className={getCompositeColorClass(s.composite)}>
                        {s.composite.toFixed(2)}
                      </FlashWrapper>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <SentimentBadge sentiment={s.sentiment || "Neutral"} />
                    </td>
                  </motion.tr>
                ))
              ) : (
                <motion.tr variants={PAGE_TRANSITION_VARIANTS_PROPS}>
                  <td colSpan={8} className="text-center">
                    <EmptyState message="There are no dividend or yield signals matching your current criteria." />
                  </td>
                </motion.tr>
              )}
            </motion.tbody>
          </AnimatePresence>
        </table>
      </div>
    </motion.div>
  );
});

YieldTable.displayName = "YieldTable";

export { YieldTable };