// components/globe/EarthGlobeWrapper.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { NeoObject } from "@/lib/nasa/types";
import { RiskBadge } from "@/components/cards/RiskBadge";
import { limitGlobeObjects } from "./globeUtils";
import { AsteroidList } from "./AsteroidList";

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
  const limited = useMemo(() => limitGlobeObjects(objects, 50), [objects]);
  const selected = selectedDes ? limited.find(o => o.des === selectedDes) ?? null : null;

  // Clear selectedDes when the selected asteroid is filtered out
  useEffect(() => {
    if (selectedDes && !limited.some(o => o.des === selectedDes)) {
      setSelectedDes(null);
    }
  }, [limited, selectedDes]);

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
          Showing top {limited.length} objects · Select from the list or click an arc
        </p>
      </div>

      {/* Right panel — asteroid list + detail card */}
      <div className="flex-1 min-w-[220px] flex flex-col gap-3">
        <AsteroidList
          objects={limited}
          selectedDes={selectedDes}
          onSelectDes={setSelectedDes}
        />
        {selected ? (
          <div className="bg-space-800 border border-space-600 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-mono text-white leading-snug">
                {selected.fullname || selected.des}
              </p>
              <button
                type="button"
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
              <Row label="Speed" value={selected.velocityKmS != null ? `${selected.velocityKmS.toFixed(1)} km/s` : "N/A"} />
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
          <p className="text-xs font-mono text-slate-500 px-1">
            Select an asteroid above to see details.
          </p>
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
