"use client";

import { useState, useMemo } from "react";
import type { NeoObject } from "@/lib/nasa/types";
import { Sidebar, type FilterState } from "@/components/layout/Sidebar";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { HeroIntro } from "@/components/layout/HeroIntro";
import { NeoTable } from "@/components/table/NeoTable";
import { ApproachTimeline } from "@/components/charts/ApproachTimeline";
import { SizeDistribution } from "@/components/charts/SizeDistribution";
import { RiskRadar } from "@/components/charts/RiskRadar";
import { MethodologySection } from "@/components/methodology/MethodologySection";
import { Filter } from "lucide-react";
import { EarthGlobeWrapper } from "@/components/globe/EarthGlobeWrapper";

interface Props {
  initialObjects: NeoObject[];
}

const DEFAULT_FILTERS: FilterState = {
  minDiameterM: 0,
  riskCategories: ["Safe", "Watchlist", "Critical"],
};

export function DashboardClient({ initialObjects }: Props) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* Mobile drawer — portaled to document.body to escape overflow-hidden */}
      <MobileDrawer open={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <Sidebar
          filters={filters}
          onChange={setFilters}
          onClose={() => setSidebarOpen(false)}
        />
      </MobileDrawer>

      {/* Desktop sidebar — inline in flex layout, hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <HeroIntro />

        {/* Mobile filter button — hidden on desktop */}
        <div className="flex items-center md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-space-600 bg-space-800 text-neo-accent font-mono text-xs uppercase tracking-widest hover:bg-space-700 transition-colors"
          >
            <Filter size={14} />
            Filters
          </button>
          <span className="ml-3 text-xs font-mono text-slate-500">
            {filtered.length} objects
          </span>
        </div>

        {/* Globe section */}
        <section className="bg-space-900 border border-space-700 rounded-xl p-4 sm:p-6">
          <h2 className="text-sm font-mono text-slate-400 uppercase tracking-widest mb-1">
            Approach Trajectories
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Animated arcs show each asteroid&apos;s path relative to Earth. Arc height = miss distance.{" "}
            <span className="text-slate-600 italic">
              Arc positions are approximate — NASA does not publish the exact direction each
              asteroid approaches from, so positions are derived from the asteroid&apos;s name.
            </span>
          </p>
          <EarthGlobeWrapper objects={filtered} />
        </section>

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
