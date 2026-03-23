// components/satellites/SatelliteDashboardClient.tsx
"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import useSWR from "swr";
import type { SatelliteObject, TleDerived } from "@/lib/celestrak/types";
import {
  SatelliteSidebar,
  DEFAULT_SATELLITE_FILTERS,
  type SatelliteFilterState,
} from "@/components/satellites/SatelliteSidebar";
import { SatelliteDetailPanel } from "@/components/satellites/SatelliteDetailPanel";
import { OrbitClassDonut } from "@/components/satellites/OrbitClassDonut";
import { LaunchTimeline } from "@/components/satellites/LaunchTimeline";
import { ConstellationBar } from "@/components/satellites/ConstellationBar";

const SatelliteGlobe = dynamic(
  () => import("@/components/satellites/SatelliteGlobe").then((m) => m.SatelliteGlobe),
  { ssr: false, loading: () => <GlobePlaceholder /> }
);

function GlobePlaceholder() {
  return (
    <div className="w-full flex items-center justify-center h-[480px]">
      <div className="w-48 h-48 rounded-full bg-space-800 border border-space-600 animate-pulse" />
    </div>
  );
}

const tleFetcher = (url: string): Promise<TleDerived> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`TLE fetch failed: ${r.status}`);
    return r.json();
  });

interface Props {
  initialObjects: SatelliteObject[];
}

export function SatelliteDashboardClient({ initialObjects }: Props) {
  const [filters, setFilters] = useState<SatelliteFilterState>(DEFAULT_SATELLITE_FILTERS);
  const [selectedNoradId, setSelectedNoradId] = useState<number | null>(null);
  const [liveLatLng, setLiveLatLng] = useState<{ lat: number; lng: number } | null>(null);

  // SWR fetches TLE only when a satellite is selected (null key = skip).
  // Results are cached — clicking the same satellite twice re-uses the cached TLE.
  const { data: selectedTle } = useSWR<TleDerived>(
    selectedNoradId !== null ? `/api/satellites/tle/${selectedNoradId}` : null,
    tleFetcher,
    { revalidateOnFocus: false }
  );

  const filtered = useMemo(() => {
    let result = initialObjects;
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      result = result.filter(
        (o) => o.name.toLowerCase().includes(q) || o.noradId.toString().includes(q)
      );
    }
    if (filters.constellations.size > 0) {
      result = result.filter((o) => filters.constellations.has(o.constellation));
    }
    if (filters.orbitClasses.size > 0) {
      result = result.filter((o) => filters.orbitClasses.has(o.orbitClass));
    }
    return result;
  }, [initialObjects, filters]);

  const selected = selectedNoradId
    ? initialObjects.find((o) => o.noradId === selectedNoradId) ?? null
    : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <SatelliteSidebar
        filters={filters}
        onChange={setFilters}
        allObjects={initialObjects}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <section className="lg:col-span-2 bg-space-900 border border-space-700 rounded-xl p-4">
            <h2 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-1">
              Live Orbital Positions
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Dots are color-coded by orbit class. Select a satellite to see its orbit ring
              and live SGP4-propagated position (updated every 2 s).
            </p>
            <SatelliteGlobe
              objects={filtered}
              selectedNoradId={selectedNoradId}
              selectedTle={selectedTle ?? null}
              onSelectNoradId={(id) => {
                setSelectedNoradId(id);
                if (id === null) setLiveLatLng(null);
              }}
              onLivePosition={(lat, lng) => setLiveLatLng({ lat, lng })}
              width={600}
              height={480}
            />
          </section>

          <div className="flex flex-col gap-4">
            <OrbitClassDonut objects={initialObjects} />
            <LaunchTimeline objects={initialObjects} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ConstellationBar objects={initialObjects} />
          </div>
          <div>
            {selected ? (
              <SatelliteDetailPanel
                satellite={selected}
                tleDerived={selectedTle ?? null}
                onClose={() => { setSelectedNoradId(null); setLiveLatLng(null); }}
                liveLatLng={liveLatLng}
              />
            ) : (
              <div className="bg-space-900 border border-space-700 rounded-xl p-4 flex items-center justify-center h-full min-h-[120px]">
                <p className="text-xs font-mono text-slate-600 text-center">
                  Select a satellite on the globe to see details and live position.
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-xs font-mono text-slate-600">
          Showing {filtered.length.toLocaleString()} of {initialObjects.length.toLocaleString()} active satellites
        </p>
      </main>
    </div>
  );
}
