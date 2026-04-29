"use client";

import React from "react";
import { motion } from "framer-motion";
import { IntelImage } from "@/types/momentum";
import { IntelNewsCard } from "@/components/momentum/intel-news-card";
import { SFIcon } from "@/components/ui/sf-icon";
import { cn } from "@/lib/utils";
import { TRACKING_HEADING_CLASS, PAGE_MOTION_VARIANTS } from "@/lib/constants";
import { useProgressiveData } from "@/hooks/use-progressive-data";

export function IntelFeedView({ onTickerSelect }: { onTickerSelect: (ticker: string) => void }) {
  const { data } = useProgressiveData();
  const intelImages: IntelImage[] = data?.intel_images || [];

  return (
    <motion.div
      key="intel-feed"
      {...PAGE_MOTION_VARIANTS}
      className="pt-4 md:pt-6 pb-8 md:pb-12"
    >
      <div className="mb-8">
        <h1 className={cn("text-2xl font-extrabold md:text-3xl mb-2 flex items-center gap-3", TRACKING_HEADING_CLASS)}>
          <SFIcon name="newspaper.fill" size="text-3xl md:text-4xl" className="text-cyan-400" />
          Intelligence Feed
        </h1>
        <p className="text-sm text-muted-foreground/60">
          The complete archive of daily AI-generated intelligence briefings, fundamental analysis, and visual metaphors.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {intelImages.map((img) => (
          <IntelNewsCard
            key={`${img.ticker}-${img.created_at}`}
            image={img}
            onTickerSelect={onTickerSelect}
            featured={false}
          />
        ))}
        {intelImages.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No intelligence briefings found.
          </div>
        )}
      </div>
    </motion.div>
  );
}
