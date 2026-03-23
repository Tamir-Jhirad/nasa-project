// lib/celestrak/orbitClass.ts
import type { OrbitClass } from "./types";

/**
 * Classifies a satellite's orbit from its current altitude (km above Earth surface).
 * Using a single altitude point is approximate for HEO satellites,
 * but sufficient for this educational dashboard.
 */
export function classifyOrbit(altitudeKm: number): OrbitClass {
  if (altitudeKm >= 35_000 && altitudeKm <= 36_500) return "GEO";
  if (altitudeKm > 36_500) return "HEO";
  if (altitudeKm < 2_000) return "LEO";
  return "MEO";
}
