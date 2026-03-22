// lib/celestrak/orbitClass.ts
import type { OrbitClass } from "./types";

/**
 * Classifies a satellite's orbit. Priority order matters:
 * GEO first, then HEO, then LEO, then MEO as the catch-all.
 */
export function classifyOrbit(
  apogeeKm: number,
  perigeeKm: number,
  eccentricity: number
): OrbitClass {
  // GEO: geostationary band, near-circular
  if (apogeeKm >= 35_500 && apogeeKm <= 36_200 && eccentricity < 0.01) {
    return "GEO";
  }
  // HEO: highly elliptical (Molniya-type)
  if (eccentricity > 0.25) {
    return "HEO";
  }
  // LEO: low Earth orbit
  if (perigeeKm < 2_000) {
    return "LEO";
  }
  // MEO: everything else (GPS, Galileo, GLONASS altitudes)
  return "MEO";
}
