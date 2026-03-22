// components/globe/EarthGlobeWrapper.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { NeoObject } from "@/lib/nasa/types";
import { RiskBadge } from "@/components/cards/RiskBadge";
import { limitGlobeObjects } from "./globeUtils";

const EarthGlobe = dynamic(
  () => import("./EarthGlobe").then((m) => m.EarthGlobe),
  { ssr: false, loading: () => <GlobePlaceholder /> }
);

function GlobePlaceholder() {
  return (
    <div className="w-full flex items-center justify-center h-[480px]">
      <div className="w-48 h-48 rounded-full bg-space-800 border border-space-600 animate-pulse" />
    </div>
  );
}

interface Props {
  objects: NeoObject[];
}

export function EarthGlobeWrapper({ objects }: Props) {
  const [selectedDes, setSelectedDes] = useState<string | null>(null);

  // Cap at 50 objects, prioritising highest-risk first
  const limited = limitGlobeObjects(objects, 50);
  const selected = selectedDes ? limited.find(o => o.des === selectedDes) ?? null : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="shrink-0">
        <EarthGlobe
          objects={limited}
          selectedDes={selectedDes}
          onSelectDes={setSelectedDes}
          width={480}
          height={480}
        />
        <p className="text-center text-xs text-slate-600 mt-1 font-mono">
          Showing top {limited.length} objects · Click an arc to select
        </p>
      </div>

      {/* Detail panel — shown when an asteroid is selected */}
      <div className="flex-1 min-w-[220px]">
        {selected ? (
          <div className="bg-space-800 border border-space-600 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-mono text-white leading-snug">
                {selected.fullname || selected.des}
              </p>
              <button
                onClick={() => setSelectedDes(null)}
                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                aria-label="Deselect asteroid"
              >
                <X size={14} />
              </button>
            </div>
            <RiskBadge category={selected.riskCategory} />
            <dl className="space-y-1.5 text-xs font-mono">
              <Row label="Miss distance" value={`${(selected.distAu * 384400).toFixed(0)} × Moon`} />
              <Row label="Speed" value={`${selected.velocityKmS.toFixed(1)} km/s`} />
              <Row label="Diameter" value={`~${(selected.diameterKm * 1000).toFixed(0)} m`} />
              <Row label="Risk score" value={selected.riskScore.toFixed(2)} />
              <Row
                label="Close approach"
                value={new Date(selected.closeApproachDate).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              />
            </dl>
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-xs text-slate-500 font-mono pt-2">
            <p className="text-slate-400">Click any arc on the globe to see details.</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neo-safe inline-block shrink-0" />
              Safe
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neo-watchlist inline-block shrink-0" />
              Watchlist
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neo-critical inline-block shrink-0" />
              Critical
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-300 text-right">{value}</dd>
    </div>
  );
}
