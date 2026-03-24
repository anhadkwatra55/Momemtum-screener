"use client";

import { AlphaCallsBlotter } from "@/components/momentum/alpha-calls-blotter";

export default function AlphaCallsPage() {
  return (
    <div className="min-h-screen bg-[#000000] text-[#E8E8E8]">
      <div className="max-w-[1600px] mx-auto px-4 md:px-6">
        <AlphaCallsBlotter />
      </div>
    </div>
  );
}
