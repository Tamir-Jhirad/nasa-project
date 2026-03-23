// components/satellites/SatelliteDetailPanel.tsx
"use client";

import { X } from "lucide-react";
import type { SatelliteObject, TleDerived } from "@/lib/celestrak/types";

interface Props {
  satellite: SatelliteObject;
  tleDerived: TleDerived | null;
  onClose: () => void;
  liveLatLng: { lat: number; lng: number } | null;
}

const ORBIT_CLASS_COLORS = {
  LEO: "text-neo-accent",
  MEO: "text-neo-watchlist",
  GEO: "text-neo-safe",
  HEO: "text-purple-400",
};

export function SatelliteDetailPanel({ satellite: sat, tleDerived, onClose, liveLatLng }: Props) {
  const position = liveLatLng
    ? {
        lat: `${Math.abs(liveLatLng.lat).toFixed(2)}° ${liveLatLng.lat >= 0 ? "N" : "S"}`,
        lng: `${Math.abs(liveLatLng.lng).toFixed(2)}° ${liveLatLng.lng >= 0 ? "E" : "W"}`,
      }
    : null;

  // Speed estimate from TLE-derived semi-major axis, if available
  const speedKmS = tleDerived
    ? (() => {
        const MU = 398600.4418;
        const T = tleDerived.periodMin * 60;
        const a_km = (MU * (T / (2 * Math.PI)) ** 2) ** (1 / 3);
        return Math.sqrt(MU / a_km);
      })()
    : null;

  return (
    <div className="bg-space-800 border border-neo-accent/40 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-mono text-white leading-snug">{sat.name}</p>
          <p className="text-xs font-mono text-slate-500 mt-0.5">{sat.intlDesignator}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
          aria-label="Deselect satellite"
        >
          <X size={14} />
        </button>
      </div>

      <dl className="space-y-1.5 text-xs font-mono">
        <Row label="NORAD ID" value={sat.noradId.toString()} accent />
        <Row label="Orbit class" value={sat.orbitClass} className={ORBIT_CLASS_COLORS[sat.orbitClass]} />
        <Row label="Constellation" value={sat.constellation} />
        <Row label="Launched" value={sat.launchDate || sat.launchYear.toString() || "—"} />
        <Row label="Altitude" value={`${sat.altitudeKm.toFixed(0)} km`} />

        {tleDerived ? (
          <>
            <Row
              label="Perigee / Apogee"
              value={`${tleDerived.perigeeKm.toFixed(0)}–${tleDerived.apogeeKm.toFixed(0)} km`}
            />
            <Row label="Inclination" value={`${tleDerived.inclinationDeg.toFixed(2)}°`} />
            <Row label="Period" value={`${tleDerived.periodMin.toFixed(1)} min`} />
            {speedKmS !== null && (
              <Row label="Speed" value={`${speedKmS.toFixed(2)} km/s`} />
            )}
          </>
        ) : (
          <div className="text-slate-600 text-xs py-1">Loading orbital data…</div>
        )}
      </dl>

      {position && (
        <div className="mt-3 p-2 bg-space-900/60 rounded border border-space-600">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Live position</p>
          <p className="text-xs font-mono text-neo-accent">
            {position.lat} / {position.lng}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">updates every 2 s</p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  className,
}: {
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className={[className ?? (accent ? "text-neo-accent" : "text-slate-300"), "text-right"].join(" ")}>
        {value}
      </dd>
    </div>
  );
}
