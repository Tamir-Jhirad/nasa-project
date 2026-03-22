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
  const nearest = objects.reduce((min, o) => o.distAu < min.distAu ? o : min, objects[0]);
  const fastest = objects.reduce((max, o) => o.velocityKmS > max.velocityKmS ? o : max, objects[0]);

  return (
    <header className="border-b border-space-600 bg-space-900">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-space-700">
        <div className="flex items-center gap-3">
          <Shield className="text-neo-accent" size={24} />
          <span className="font-mono font-bold text-lg tracking-widest text-neo-accent uppercase">
            NEO-Guardian
          </span>
          <span className="text-xs text-slate-500 font-mono">
            Real-time Asteroid Proximity &amp; Risk Dashboard
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
          <Clock size={12} />
          <span>Updated: {new Date(revalidatedAt).toUTCString()}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 py-4">
        <StatCard
          label="Objects Tracked"
          value={objects.length}
          sub="Next 6 months, ≤ 0.05 AU"
          icon={Shield}
        />
        <StatCard
          label="Critical Risk"
          value={criticalCount}
          sub={`${objects.filter(o => o.riskCategory === "Watchlist").length} on watchlist`}
          icon={Zap}
          iconColor="text-neo-critical"
        />
        <StatCard
          label="Nearest Approach"
          value={nearest ? `${nearest.distAu.toFixed(4)} AU` : "N/A"}
          sub={nearest?.fullname}
          icon={Clock}
          iconColor="text-neo-watchlist"
        />
      </div>
    </header>
  );
}
