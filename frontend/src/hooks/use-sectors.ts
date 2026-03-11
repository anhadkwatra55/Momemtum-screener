"use client";

import { useMemo } from "react";
import type { DashboardData, SectorRegime, SectorSentiment } from "@/types/momentum";
import { STRONG_TRENDING_COMPOSITE_THRESHOLD } from "@/lib/constants";

interface SectorData {
  name: string;
  regime: SectorRegime;
  sentiment: SectorSentiment;
  bullPct: number;
  bearPct: number;
  neutPct: number;
  isStronglyTrending: boolean;
}

interface UseSectorsReturn {
  sectors: SectorData[];
  trendingCount: number;
  topStronglyTrendingSector: string | null;
}

export function useSectors(dashboardData: DashboardData | null): UseSectorsReturn {
  return useMemo(() => {
    if (!dashboardData?.sector_regimes) {
      return { sectors: [], trendingCount: 0, topStronglyTrendingSector: null };
    }

    const { sector_regimes, sector_sentiment } = dashboardData;

    const processedSectors: SectorData[] = Object.entries(sector_regimes).map(
      ([sectorName, regime]) => {
        const sentiment: SectorSentiment = sector_sentiment?.[sectorName] || {
          bullish: 0,
          bearish: 0,
          neutral: 0,
        };

        const totalSentiment = sentiment.bullish + sentiment.bearish + sentiment.neutral;
        const safeTotal = totalSentiment || 1;

        const isStronglyTrending =
          regime.regime === "Trending" && regime.avg_composite > STRONG_TRENDING_COMPOSITE_THRESHOLD;

        return {
          name: sectorName,
          regime,
          sentiment,
          bullPct: (sentiment.bullish / safeTotal) * 100,
          bearPct: (sentiment.bearish / safeTotal) * 100,
          neutPct: (sentiment.neutral / safeTotal) * 100,
          isStronglyTrending,
        };
      },
    );

    const trendingCount = processedSectors.filter((s) => s.regime.regime === "Trending").length;
    const topStronglyTrending = processedSectors.find((s) => s.isStronglyTrending);

    return {
      sectors: processedSectors,
      trendingCount,
      topStronglyTrendingSector: topStronglyTrending?.name || null,
    };
  }, [dashboardData]);
}