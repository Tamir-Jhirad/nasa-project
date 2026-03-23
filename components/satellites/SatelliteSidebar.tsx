"use client";
// components/satellites/SatelliteSidebar.tsx
import { X } from "lucide-react";
import type { SatelliteObject, Constellation, OrbitClass } from "@/lib/celestrak/types";

export interface SatelliteFilterState {
  search: string;
  constellations: Set<Constellation>;  // empty = show all
  orbitClasses: Set<OrbitClass>;        // empty = show all
}

export const DEFAULT_SATELLITE_FILTERS: SatelliteFilterState = {
  search: "",
  constellations: new Set(),
  orbitClasses: new Set(),
};

interface Props {
  filters: SatelliteFilterState;
  onChange: (f: SatelliteFilterState) => void;
  allObjects: SatelliteObject[];
  onClose?: () => void;
}

const CONSTELLATION_COLORS: Record<Constellation, string> = {
  Starlink: "#0ea5e9",
  OneWeb: "#a78bfa",
  GPS: "#22c55e",
  Galileo: "#f59e0b",
  GLONASS: "#ef4444",
  "Space Station": "#ec4899",
  Weather: "#06b6d4",
  Science: "#8b5cf6",
  Other: "#475569",
};

const ORBIT_CLASS_COLORS: Record<OrbitClass, string> = {
  LEO: "#38bdf8",
  MEO: "#f59e0b",
  GEO: "#22c55e",
  HEO: "#a78bfa",
};

const CONSTELLATIONS: Constellation[] = [
  "Starlink", "OneWeb", "GPS", "Galileo", "GLONASS",
  "Space Station", "Weather", "Science", "Other",
];
const ORBIT_CLASSES: OrbitClass[] = ["LEO", "MEO", "GEO", "HEO"];

export function SatelliteSidebar({ filters, onChange, allObjects, onClose }: Props) {
  const countFor = (c: Constellation) => allObjects.filter((o) => o.constellation === c).length;
  const countOrbit = (o: OrbitClass) => allObjects.filter((s) => s.orbitClass === o).length;

  const toggleConstellation = (c: Constellation) => {
    const next = new Set(filters.constellations);
    next.has(c) ? next.delete(c) : next.add(c);
    onChange({ ...filters, constellations: next });
  };

  const toggleOrbit = (o: OrbitClass) => {
    const next = new Set(filters.orbitClasses);
    next.has(o) ? next.delete(o) : next.add(o);
    onChange({ ...filters, orbitClasses: next });
  };

  const clearAll = () => onChange(DEFAULT_SATELLITE_FILTERS);

  return (
    <aside className="w-52 shrink-0 bg-space-900 border-r border-space-700 flex flex-col overflow-y-auto h-full">
      <div className="p-3 border-b border-space-700 flex items-center justify-between">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Filters</span>
        <div className="flex items-center gap-2">
          <button onClick={clearAll} className="text-xs text-slate-500 hover:text-neo-accent font-mono">
            Clear all
          </button>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close filters"
              className="p-1 rounded hover:bg-space-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-space-700">
        <input
          type="text"
          placeholder="Search name / NORAD ID…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full bg-space-800 border border-space-600 text-slate-300 placeholder-slate-600 font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-neo-accent"
        />
      </div>

      {/* Constellations */}
      <div className="p-3 border-b border-space-700">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Constellation</p>
        {CONSTELLATIONS.map((c) => {
          const active = filters.constellations.has(c);
          return (
            <button
              key={c}
              onClick={() => toggleConstellation(c)}
              className={`w-full flex items-center gap-2 px-2 py-1 text-left rounded transition-colors ${active ? "bg-space-800" : "hover:bg-space-800/50"}`}
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: CONSTELLATION_COLORS[c] }}
              />
              <span className={`flex-1 text-xs font-mono ${active ? "text-white" : "text-slate-400"}`}>{c}</span>
              <span className="text-xs text-slate-600 font-mono">{countFor(c)}</span>
            </button>
          );
        })}
      </div>

      {/* Orbit class */}
      <div className="p-3">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Orbit Class</p>
        {ORBIT_CLASSES.map((o) => {
          const active = filters.orbitClasses.has(o);
          return (
            <button
              key={o}
              onClick={() => toggleOrbit(o)}
              className={`w-full flex items-center gap-2 px-2 py-1 text-left rounded transition-colors ${active ? "bg-space-800" : "hover:bg-space-800/50"}`}
            >
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ background: ORBIT_CLASS_COLORS[o] }}
              />
              <span className={`flex-1 text-xs font-mono ${active ? "text-white" : "text-slate-400"}`}>{o}</span>
              <span className="text-xs text-slate-600 font-mono">{countOrbit(o)}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
