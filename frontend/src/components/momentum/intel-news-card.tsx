"use client";

import React from "react";
import { motion } from "framer-motion";

import { IntelImage } from "@/types/momentum";

interface IntelNewsCardProps {
  image: IntelImage;
  onTickerSelect: (ticker: string) => void;
  featured?: boolean;
}

/**
 * Resolves intel image URL — handles both relative (/intel/aapl.png) and absolute URLs.
 * Relative paths are served by Next.js from the public/ directory.
 */
function resolveImageUrl(url: string): string {
  if (!url) return "";
  // Already absolute URL (e.g. from Together API)
  if (url.startsWith("http")) return url;
  // Relative path — served by Next.js from public/ (e.g. /intel/aapl.png)
  return url;
}

// ── Featured Card (Moby-style hero) ──
function FeaturedIntelCard({ image, onTickerSelect }: IntelNewsCardProps) {
  const imgSrc = resolveImageUrl(image.image_url);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative grid grid-cols-1 overflow-hidden rounded-2xl bg-[#1a1a1a] border border-[#2A2A2A] lg:grid-cols-2"
    >
      {/* Left: Content */}
      <div className="flex flex-col justify-between p-7 lg:p-10">
        <div>
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-400">
              ● News
            </span>
            <span className="text-[10px] text-white/30 font-mono-data">
              {new Date(image.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>

          <h2 className="mb-5 font-serif text-2xl leading-tight text-white lg:text-4xl">
            {image.headline}
          </h2>

          {/* Summary paragraph */}
          {image.summary && (
            <p className="mb-6 text-[14px] leading-relaxed text-white/60">
              {image.summary}
            </p>
          )}

        </div>


        <div className="mt-8 flex items-center gap-4">
          <div
            onClick={() => onTickerSelect(image.ticker)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-white/5 font-mono-data text-sm font-bold text-white transition-colors hover:bg-white/10"
          >
            {image.ticker}
          </div>
        </div>
      </div>

      {/* Right: Image */}
      <div className="relative aspect-square overflow-hidden lg:aspect-auto lg:min-h-[320px]">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={image.headline}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement?.classList.add('bg-white/5');
              const placeholder = document.createElement('div');
              placeholder.className = "flex h-full w-full items-center justify-center text-xs text-white/20 font-mono-data";
              placeholder.innerText = "No image";
              (e.target as HTMLImageElement).parentElement?.appendChild(placeholder);
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white/5">
            <span className="text-xs text-white/20 font-mono-data">No image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-transparent to-transparent hidden lg:block" />
      </div>
    </motion.div>
  );
}

// ── Compact List Card (sidebar "Stock Picks" style) ──
function CompactIntelCard({ image, onTickerSelect }: IntelNewsCardProps) {
  const imgSrc = resolveImageUrl(image.image_url);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => onTickerSelect(image.ticker)}
      className="group flex cursor-pointer items-start gap-4 rounded-2xl bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06] border border-transparent hover:border-[#2A2A2A]"
    >
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <h4 className="text-sm font-bold text-white transition-colors group-hover:text-cyan-400">
            {image.ticker}
          </h4>
          <span className="text-[10px] text-white/25 font-mono-data">
            {new Date(image.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
        <p className="line-clamp-2 text-xs text-white/60 leading-relaxed">
          {image.headline}
        </p>
        {image.summary && (
          <p className="mt-1.5 line-clamp-1 text-[11px] text-white/35 italic">
            {image.summary}
          </p>
        )}
      </div>
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-white/5">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={image.ticker}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement?.classList.add('flex', 'items-center', 'justify-center');
              const placeholder = document.createElement('span');
              placeholder.className = "text-[8px] text-white/20";
              placeholder.innerText = "—";
              (e.target as HTMLImageElement).parentElement?.appendChild(placeholder);
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-[8px] text-white/20">—</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Export ──
export function IntelNewsCard({ image, onTickerSelect, featured = false }: IntelNewsCardProps) {
  if (featured) {
    return <FeaturedIntelCard image={image} onTickerSelect={onTickerSelect} />;
  }
  return <CompactIntelCard image={image} onTickerSelect={onTickerSelect} />;
}

// ── Skeleton ──
export function IntelNewsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Featured skeleton */}
      <div className="lg:col-span-2 h-[340px] rounded-2xl bg-white/[0.02] animate-pulse border border-[#2A2A2A]" />
      {/* Sidebar skeletons */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/[0.02] animate-pulse border border-[#2A2A2A]" />
        ))}
      </div>
    </div>
  );
}
