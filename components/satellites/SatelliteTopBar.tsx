// components/satellites/SatelliteTopBar.tsx
import { Satellite, Layers, TrendingUp, Zap } from "lucide-react";
import { StatCard } from "@/components/cards/StatCard";
import type { SatelliteObject } from "@/lib/celestrak/types";

interface Props {
  objects: SatelliteObject[];
  revalidatedAt: string;
}

export function SatelliteTopBar({ objects, revalidatedAt }: Props) {
  const leoCount = objects.filter((o) => o.orbitClass === "LEO").length;
  const geoCount = objects.filter((o) => o.orbitClass === "GEO").length;
  const starlinkCount = objects.filter((o) => o.constellation === "Starlink").length;
  const starlinkPct = objects.length ? Math.round((starlinkCount / objects.length) * 100) : 0;

  return (
    <header className="border-b border-space-600 bg-space-900">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-space-700">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Satellite className="text-neo-accent shrink-0" size={24} />
            <span className="font-mono font-bold text-lg tracking-widest text-neo-accent uppercase">
              Satellite Tracker
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden sm:block">
            N2YO live data · Updates every hour
          </p>
        </div>
        <span className="hidden sm:block text-xs font-mono text-slate-500">
          Updated: {new Date(revalidatedAt).toUTCString()}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 py-3 sm:py-4">
        <StatCard label="Active Satellites" value={objects.length} sub="Currently tracked globally" icon={Satellite} />
        <StatCard
          label="LEO Satellites"
          value={leoCount}
          sub={`${objects.length ? Math.round((leoCount / objects.length) * 100) : 0}% of total — below 2,000 km`}
          icon={Layers}
          iconColor="text-neo-watchlist"
        />
        <StatCard
          label="GEO Satellites"
          value={geoCount}
          sub={`${objects.length ? Math.round((geoCount / objects.length) * 100) : 0}% of total — ~35,786 km`}
          icon={TrendingUp}
          iconColor="text-neo-safe"
        />
        <StatCard
          label="Starlink Share"
          value={`${starlinkPct}%`}
          sub={`${starlinkCount} satellites — SpaceX`}
          icon={Zap}
          iconColor="text-neo-critical"
        />
      </div>
    </header>
  );
}
