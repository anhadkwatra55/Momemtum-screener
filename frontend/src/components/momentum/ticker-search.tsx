"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { searchTicker, addTicker, type TickerSearchResult } from "@/services/api";
import { cn, getBackgroundColorClass, getTextColorClass, getBorderColorClass } from "@/lib/utils";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  SPRING_TRANSITION_PROPS,
  STAGGER_CHILDREN_DELAY,
  ITEM_HOVER_Y,
  MIN_TOUCH_TARGET_SIZE_PX,
  INPUT_DEFAULT_SHADOW,
  INPUT_FOCUS_GLOW_SHADOW,
  ITEM_ACTIVE_BG,
  ITEM_FOCUS_GLOW_SHADOW,
  Z_INDEX_DROPDOWN_OVERLAY,
} from "@/lib/constants";
import { SFIcon } from "@/components/ui/SFIcon"; // Moved SFIcon to a shared UI component

interface TickerSearchProps {
  onSelectTicker?: (ticker: string) => void;
  onDataRefresh?: () => void;
}

const dropdownVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { delayChildren: 0.1, staggerChildren: STAGGER_CHILDREN_DELAY, ...SPRING_TRANSITION_PROPS } },
  exit: { opacity: 0, y: 10, transition: { duration: 0.2, ...SPRING_TRANSITION_PROPS } },
};

const itemVariants: Variants = {
  initial: { opacity: 0, y: 10, boxShadow: "none" },
  animate: { opacity: 1, y: 0, transition: SPRING_TRANSITION_PROPS },
  focused: {
    translateY: ITEM_HOVER_Y,
    boxShadow: ITEM_FOCUS_GLOW_SHADOW,
    backgroundColor: ITEM_ACTIVE_BG,
    transition: SPRING_TRANSITION_PROPS,
  },
  hover: {
    translateY: ITEM_HOVER_Y,
    boxShadow: ITEM_FOCUS_GLOW_SHADOW,
    backgroundColor: ITEM_ACTIVE_BG,
    transition: SPRING_TRANSITION_PROPS,
  }
};

const LoadingSpinner = React.memo(() => (
  <motion.div
    className={cn(
      "w-4 h-4 rounded-full border-2",
      getBorderColorClass('slate', '600', '100'),
      `border-t-cyan-500` // Corrected Tailwind class for top border color
    )}
    animate={{ rotate: 360 }}
    transition={{ duration: 1, ease: "linear", repeat: Infinity }}
  />
));

const TickerSearchResultSkeleton = React.memo(() => (
  <motion.div
    className={cn(
      "flex justify-between items-center px-4 py-3 rounded-xl relative",
      `min-h-[${MIN_TOUCH_TARGET_SIZE_PX}]`,
      getBackgroundColorClass('slate', '900', '20')
    )}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex flex-col gap-1 w-3/4">
      <div className={cn("h-4 w-1/2 rounded", getBackgroundColorClass('slate', '700', '50'))}></div>
      <div className={cn("h-3 w-3/4 rounded", getBackgroundColorClass('slate', '800', '40'))}></div>
    </div>
    <div className={cn("h-5 w-1/4 rounded-full", getBackgroundColorClass('slate', '800', '40'))}></div>
  </motion.div>
));

const EmptySearchState = React.memo(({ query }: { query: string }) => (
  <motion.div
    key="no-results"
    className="px-4 py-3 text-muted-foreground text-center rounded-xl flex flex-col items-center justify-center gap-2"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 10 }}
    transition={SPRING_TRANSITION_PROPS}
  >
    <SFIcon name="exclamationmark.circle" size={12} className="text-slate-600 mb-4" strokeWidth={1.5} />
    <h3 className="text-lg font-semibold text-slate-300 tracking-tight mb-1">No results for "{query}"</h3>
    <p className="text-sm text-slate-500 font-inter max-w-xs">
      We couldn't find any tickers matching your search. Try adjusting your query or searching for a company name.
    </p>
  </motion.div>
));

export function TickerSearch({ onSelectTicker, onDataRefresh }: TickerSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q || q.length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    setFocusedIndex(-1);
    try {
      const res = await searchTicker(q);
      setResults(res);
      setOpen(res.length > 0 || (isInputFocused && q.length > 0));
    } catch (error) {
      console.error("Search error:", error); // Adhering to existing pattern; ideally would use a dedicated logging module
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [isInputFocused]);

  const handleInput = useCallback((val: string) => {
    setQuery(val);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setFocusedIndex(-1);
    setOpen(true);
    timerRef.current = setTimeout(() => doSearch(val), 300);
  }, [doSearch]);

  const handleSelect = useCallback(async (ticker: string, source: string) => {
    setQuery(ticker);
    setOpen(false);
    setIsInputFocused(false);
    inputRef.current?.blur();
    if (source === "yfinance") {
      setLoading(true);
      try {
        await addTicker([ticker]);
        onDataRefresh?.();
      } catch (error) {
        console.error("Add ticker error:", error); // Adhering to existing pattern; ideally would use a dedicated logging module
      } finally {
        setLoading(false);
      }
    }
    onSelectTicker?.(ticker);
  }, [onDataRefresh, onSelectTicker]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
        setIsInputFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setFocusedIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!open && query && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      if (results.length > 0) {
        setOpen(true);
        setFocusedIndex(0);
      } else {
        doSearch(query);
      }
      return;
    }

    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prevIndex) => (prevIndex + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prevIndex) => (prevIndex - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex !== -1) {
        const { ticker, source } = results[focusedIndex];
        handleSelect(ticker, source);
      } else if (results.length > 0) {
        // No item focused — select the first result
        const { ticker, source } = results[0];
        handleSelect(ticker, source);
      } else if (query.trim().length > 0) {
        // No results yet — navigate directly with typed text as ticker
        handleSelect(query.trim().toUpperCase(), "db");
      }
    }
  }, [open, results, focusedIndex, query, doSearch, handleSelect]);

  useEffect(() => {
    if (focusedIndex !== -1 && resultsRef.current) {
      const focusedItem = resultsRef.current.children[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [focusedIndex]);


  const renderResults = useMemo(() => {
    if (loading) {
      return (
        <AnimatePresence mode="wait">
          <motion.div
            key="loading-skeletons"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={{
              initial: { opacity: 0 },
              animate: { opacity: 1, transition: { staggerChildren: STAGGER_CHILDREN_DELAY } },
              exit: { opacity: 0 },
            }}
            className="space-y-2 py-1"
          >
            <TickerSearchResultSkeleton key="skeleton-1" />
            <TickerSearchResultSkeleton key="skeleton-2" />
            <TickerSearchResultSkeleton key="skeleton-3" />
          </motion.div>
        </AnimatePresence>
      );
    }

    if (results.length === 0 && query.length > 0) {
      return <EmptySearchState query={query} />;
    }

    if (results.length > 0) {
      return (
        <motion.div
          key="search-results-list"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={{
            initial: { opacity: 0 },
            animate: { opacity: 1, transition: { staggerChildren: STAGGER_CHILDREN_DELAY } },
            exit: { opacity: 0 },
          }}
          className="space-y-2 py-1"
        >
          {results.map((r, index) => (
            <motion.div
              key={r.ticker}
              id={`search-item-${index}`}
              role="option"
              aria-selected={index === focusedIndex}
              onClick={() => handleSelect(r.ticker, r.source)}
              variants={itemVariants}
              initial="initial"
              animate={index === focusedIndex ? "focused" : "animate"}
              whileHover="hover"
              className={cn(
                "flex justify-between items-center",
                "px-4 py-3 cursor-pointer",
                "rounded-xl",
                "relative group",
                `min-h-[${MIN_TOUCH_TARGET_SIZE_PX}]`,
                index !== focusedIndex && getBackgroundColorClass('slate', '900', '30') // Using utility for tonal surface
              )}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-mono-data text-cyan-400 text-lg font-bold tracking-tight">
                  {r.ticker}
                </span>
                <span className="text-slate-400 text-xs font-inter max-w-[150px] truncate">
                  {r.name}
                </span>
              </div>
              <motion.span
                className={cn(
                  "px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.1em]",
                  r.source === "db"
                    ? `${getBackgroundColorClass('emerald', '500', '15')} ${getTextColorClass('emerald', '400')}`
                    : `${getBackgroundColorClass('amber', '500', '15')} ${getTextColorClass('amber', '400')}`
                )}
                whileHover={{ scale: 1.05 }}
                transition={SPRING_TRANSITION_PROPS}
              >
                {r.source === "db" ? "Local" : "Live"}
              </motion.span>
            </motion.div>
          ))}
        </motion.div>
      );
    }

    return null;
  }, [loading, results, query, focusedIndex, handleSelect]);


  return (
    <div className="relative w-full" ref={containerRef}>
      <label htmlFor="ticker-search-input" className="sr-only">Search ticker</label>
      <motion.div
        initial={false}
        animate={isInputFocused ? { boxShadow: INPUT_FOCUS_GLOW_SHADOW } : { boxShadow: INPUT_DEFAULT_SHADOW }}
        transition={SPRING_TRANSITION_PROPS}
        className="relative rounded-2xl flex items-center shadow-card"
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
          <SFIcon name="magnifyingglass" size={5} strokeWidth={1.5} />
        </span>
        <input
          id="ticker-search-input"
          ref={inputRef}
          type="text"
          placeholder="Search ticker…"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => {
            setIsInputFocused(true);
            if (query && results.length > 0) {
              setOpen(true);
            } else if (query) {
              doSearch(query);
            }
          }}
          onBlur={() => {
            setTimeout(() => {
              if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
                setOpen(false);
                setFocusedIndex(-1);
                setIsInputFocused(false);
              }
            }, 100);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls="ticker-search-list"
          aria-autocomplete="list"
          aria-activedescendant={focusedIndex !== -1 ? `search-item-${focusedIndex}` : undefined}
          className={cn(
            "bg-[var(--card)] glass-subtle",
            "rounded-2xl",
            "pl-10 pr-4 py-2.5",
            "text-base font-inter text-foreground placeholder:text-slate-500",
            "w-full md:max-w-sm",
            "outline-none",
            `min-h-[${MIN_TOUCH_TARGET_SIZE_PX}]`,
            "flex-grow"
          )}
        />
        <AnimatePresence mode="wait">
          {loading && (
            <motion.div
              key="loading-spinner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <LoadingSpinner />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence>
        {open && (loading || results.length > 0 || (query.length > 0 && results.length === 0)) && (
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={dropdownVariants}
            className={cn(
              "absolute top-[calc(100%+1rem)] left-0 right-0",
              "bg-[var(--card)] glass-heavy",
              "rounded-2xl",
              "max-h-72 overflow-y-auto",
              `z-[${Z_INDEX_DROPDOWN_OVERLAY}]`, // Using semantic z-index constant
              "shadow-elevated",
              "p-2"
            )}
            role="listbox"
            id="ticker-search-list"
            ref={resultsRef}
          >
            {renderResults}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}