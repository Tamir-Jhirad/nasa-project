// components/layout/TopBar.tsx
import { Shield, Zap, Clock } from "lucide-react";
import { StatCard } from "@/components/cards/StatCard";
import type { NeoObject } from "@/lib/nasa/types";

interface Props {
  objects: NeoObject[];
  revalidatedAt: string;
}

export function TopBar({ objects, revalidatedAt }: Props) {
  const criticalCount = objects.filter(o => o.riskCategory === "Critical").length;
  const nearest = objects.length
    ? objects.reduce((min, o) => o.distAu < min.distAu ? o : min)
    : null;

  return (
    <header className="border-b border-space-600 bg-space-900">
      {/* Title bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-space-700">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3">
            <Shield className="text-neo-accent shrink-0" size={24} />
            <span className="font-mono font-bold text-lg tracking-widest text-neo-accent uppercase shrink-0">
              NEO-Guardian
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
            Live NASA data · Near-Earth asteroid tracker · Updates every 12 hours
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-500 shrink-0">
          <Clock size={12} />
          <span>Updated: {new Date(revalidatedAt).toUTCString()}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-4 sm:px-6 py-3 sm:py-4">
        <StatCard
          label="Objects Tracked"
          value={objects.length}
          sub="Next 6 months, ≤ 0.05 AU"
          icon={Shield}
        />
        <StatCard
          label="High-Risk Objects"
          value={criticalCount}
          sub={`${objects.filter(o => o.riskCategory === "Watchlist").length} on watchlist`}
          icon={Zap}
          iconColor="text-neo-critical"
        />
        <StatCard
          label="Nearest Approach"
          value={nearest ? `${nearest.distAu.toFixed(4)} AU` : "N/A"}
          sub={nearest ? `${nearest.fullname || nearest.des} · ${(nearest.distAu * 389).toFixed(0)}× Moon` : undefined}
          icon={Clock}
          iconColor="text-neo-watchlist"
        />
      </div>
    </header>
  );
}
