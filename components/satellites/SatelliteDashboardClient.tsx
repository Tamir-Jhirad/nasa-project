// components/satellites/SatelliteDashboardClient.tsx
"use client";

import type { SatelliteObject } from "@/lib/celestrak/types";

interface Props {
  initialObjects: SatelliteObject[];
}

export function SatelliteDashboardClient({ initialObjects }: Props) {
  return (
    <div className="p-6 font-mono text-slate-400">
      Satellites loaded: {initialObjects.length}
    </div>
  );
}
