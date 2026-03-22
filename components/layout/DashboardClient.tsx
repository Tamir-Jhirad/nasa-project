"use client";

import { useState, useMemo } from "react";
import type { NeoObject } from "@/lib/nasa/types";
import { Sidebar, type FilterState } from "@/components/layout/Sidebar";
import { NeoTable } from "@/components/table/NeoTable";
import { ApproachTimeline } from "@/components/charts/ApproachTimeline";
import { SizeDistribution } from "@/components/charts/SizeDistribution";
import { RiskRadar } from "@/components/charts/RiskRadar";
import { MethodologySection } from "@/components/methodology/MethodologySection";

interface Props {
  initialObjects: NeoObject[];
}

const DEFAULT_FILTERS: FilterState = {
  minDiameterM: 0,
  riskCategories: ["Safe", "Watchlist", "Critical"],
};

export function DashboardClient({ initialObjects }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filtered = useMemo(() => {
    return initialObjects.filter(o => {
      const diamM = o.diameterKm * 1000;
      if (diamM < filters.minDiameterM) return false;
      if (!filters.riskCategories.includes(o.riskCategory)) return false;
      return true;
    });
  }, [initialObjects, filters]);

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar filters={filters} onChange={setFilters} />

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ApproachTimeline objects={filtered} />
          </div>
          <SizeDistribution objects={filtered} />
        </div>

        <RiskRadar objects={filtered} />

        {/* Data table */}
        <div>
          <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">
            All Tracked Objects ({filtered.length})
          </h2>
          <NeoTable objects={filtered} />
        </div>

        <MethodologySection />
      </main>
    </div>
  );
}
