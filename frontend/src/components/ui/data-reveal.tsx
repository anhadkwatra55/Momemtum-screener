"use client";

import React, { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SPRING_PHYSICS_DEFAULT, STAGGER_CHILDREN_DELAY } from "@/lib/constants";

// ── DataReveal: wraps any section, shows skeleton → blur-up reveal ──

interface DataRevealProps {
  loading: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Delay before revealing (ms), useful for staggering multiple sections */
  delay?: number;
}

export const DataReveal = memo(({ loading, skeleton, children, className = "", delay = 0 }: DataRevealProps) => (
  <div className={className}>
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
          transition={{ duration: 0.25 }}
        >
          {skeleton || <DefaultSkeleton />}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{
            ...SPRING_PHYSICS_DEFAULT,
            delay: delay / 1000,
            opacity: { duration: 0.35, delay: delay / 1000 },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
DataReveal.displayName = "DataReveal";

// ── TableReveal: rows slide in with staggered delay ──

interface TableRevealProps {
  loading: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  rowCount?: number; // for skeleton
  className?: string;
}

export const TableReveal = memo(({ loading, skeleton, children, rowCount = 8, className = "" }: TableRevealProps) => (
  <div className={className}>
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="table-skeleton"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
        >
          {skeleton || <TableSkeleton rows={rowCount} />}
        </motion.div>
      ) : (
        <motion.div
          key="table-content"
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: {
                staggerChildren: STAGGER_CHILDREN_DELAY,
                delayChildren: 0.05,
              },
            },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
TableReveal.displayName = "TableReveal";

// ── CardReveal: scale + blur dissolve for cards ──

interface CardRevealProps {
  loading: boolean;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const CardReveal = memo(({ loading, skeleton, children, className = "", delay = 0 }: CardRevealProps) => (
  <div className={className}>
    <AnimatePresence mode="wait">
      {loading ? (
        <motion.div
          key="card-skeleton"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
          transition={{ duration: 0.2 }}
        >
          {skeleton || <CardSkeleton />}
        </motion.div>
      ) : (
        <motion.div
          key="card-content"
          initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{
            ...SPRING_PHYSICS_DEFAULT,
            delay: delay / 1000,
            opacity: { duration: 0.3, delay: delay / 1000 },
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
CardReveal.displayName = "CardReveal";

// ── AnimatedRow: wrap individual table rows for staggered reveal ──

export const AnimatedRow = memo(({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <motion.tr
    className={className}
    variants={{
      hidden: { opacity: 0, y: 8 },
      show: { opacity: 1, y: 0, transition: SPRING_PHYSICS_DEFAULT },
    }}
  >
    {children}
  </motion.tr>
));
AnimatedRow.displayName = "AnimatedRow";

// ── Default Skeletons ──

const DefaultSkeleton = memo(() => (
  <div className="space-y-3">
    <div className="h-5 w-3/4 rounded-lg bg-white/[0.04] animate-pulse" />
    <div className="h-5 w-1/2 rounded-lg bg-white/[0.04] animate-pulse" />
    <div className="h-5 w-2/3 rounded-lg bg-white/[0.04] animate-pulse" />
  </div>
));
DefaultSkeleton.displayName = "DefaultSkeleton";

const TableSkeleton = memo(({ rows }: { rows: number }) => (
  <div className="space-y-2">
    {/* Header */}
    <div className="h-10 w-full rounded-xl bg-white/[0.03] animate-pulse" />
    {/* Rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <motion.div
        key={i}
        className="h-12 w-full rounded-xl bg-white/[0.02] animate-pulse"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: i * 0.04 }}
      />
    ))}
  </div>
));
TableSkeleton.displayName = "TableSkeleton";

const CardSkeleton = memo(() => (
  <div className="rounded-2xl bg-white/[0.03] animate-pulse p-6">
    <div className="h-4 w-1/3 rounded-lg bg-white/[0.05] mb-4" />
    <div className="h-20 w-full rounded-lg bg-white/[0.03]" />
  </div>
));
CardSkeleton.displayName = "CardSkeleton";
