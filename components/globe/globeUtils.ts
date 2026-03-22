// components/globe/globeUtils.ts
import type { NeoObject, RiskCategory } from "@/lib/nasa/types";

export interface GlobeArc {
  des: string;       // used by EarthGlobe to identify which arc was clicked
  startLat: number;
  startLng: number;
  endLat: number;    // Earth centre (0, 0)
  endLng: number;
  altitude: number;  // relative arc height above globe
  color: string;
  label: string;
}

export interface GlobePoint {
  lat: number;
  lng: number;
  size: number;
  color: string;
  label: string;
}

const RISK_COLOR: Record<RiskCategory, string> = {
  Safe: "rgba(74,222,128,0.75)",       // neo-safe
  Watchlist: "rgba(251,191,36,0.85)",  // neo-watchlist
  Critical: "rgba(248,113,113,0.95)",  // neo-critical
};

const DIMMED_COLOR = "rgba(148,163,184,0.2)"; // slate-400 at 20% — fades non-selected arcs

/** Integer hash of a string — deterministic, platform-independent */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

/** Derives a consistent lat/lng from an asteroid's designation */
function designationToLatLng(des: string): { lat: number; lng: number } {
  const h = hashString(des);
  const lat = ((h % 140) - 70);          // -70° … +70° (avoids polar extremes)
  const lng = (((h >> 7) % 360) - 180);  // -180° … +180°
  return { lat, lng };
}

/**
 * Maps miss distance in AU to a globe arc altitude (0.1 – 0.7).
 * Closer approaches produce lower arcs; farther ones arc higher.
 * Clamped to 0.7 so objects right at the 0.05 AU limit don't overflow.
 */
function distToAltitude(distAu: number): number {
  const MAX_DIST_AU = 0.05;
  return Math.min(0.7, 0.1 + (distAu / MAX_DIST_AU) * 0.6);
}

/**
 * Returns the top N objects by risk score, prioritising Critical > Watchlist > Safe.
 * Used to cap the number of arcs on the globe and prevent visual overload.
 */
export function limitGlobeObjects(objects: NeoObject[], max: number = 50): NeoObject[] {
  const TIER: Record<RiskCategory, number> = { Critical: 0, Watchlist: 1, Safe: 2 };
  return [...objects]
    .sort((a, b) => {
      const tierDiff = TIER[a.riskCategory] - TIER[b.riskCategory];
      if (tierDiff !== 0) return tierDiff;
      return b.riskScore - a.riskScore; // within same tier, higher score first
    })
    .slice(0, max);
}

/**
 * Converts NeoObject[] to arc data for react-globe.gl.
 * @param selectedDes — designation of the currently selected asteroid, or null for none.
 *   When a selection is active, non-selected arcs are dimmed to 20% opacity.
 */
export function toGlobeArcs(objects: NeoObject[], selectedDes: string | null): GlobeArc[] {
  const hasSelection = selectedDes !== null;
  return objects.map((o) => {
    const { lat, lng } = designationToLatLng(o.des);
    const isSelected = o.des === selectedDes;
    return {
      des: o.des,
      startLat: lat,
      startLng: lng,
      endLat: 0,
      endLng: 0,
      altitude: distToAltitude(o.distAu),
      color: hasSelection && !isSelected ? DIMMED_COLOR : RISK_COLOR[o.riskCategory],
      label: `${o.fullname || o.des} — ${(o.distKm / 1_000_000).toFixed(2)} M km`,
    };
  });
}

/** Returns glowing surface points for Watchlist and Critical objects only */
export function toGlobePoints(objects: NeoObject[]): GlobePoint[] {
  return objects
    .filter((o) => o.riskCategory !== "Safe")
    .map((o) => {
      const { lat, lng } = designationToLatLng(o.des);
      const sizePx = o.riskCategory === "Critical" ? 0.6 : 0.35;
      return {
        lat,
        lng,
        size: sizePx,
        color: RISK_COLOR[o.riskCategory],
        label: o.fullname || o.des,
      };
    });
}
