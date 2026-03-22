// lib/celestrak/gpParser.ts
import type { SatelliteObject } from "./types";
import { classifyOrbit } from "./orbitClass";
import { detectConstellation } from "./constellationDetect";

const MU_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6371;

/**
 * Parses CelesTrak TLE text format (3-line element sets) into SatelliteObject[].
 *
 * Format per satellite:
 *   Line 0: name (up to 24 chars)
 *   Line 1: "1 NNNNNC XXXXXXXX YYDDD.DDDDDDDD ..." (69 chars)
 *   Line 2: "2 NNNNN III.IIII RRR.RRRR EEEEEEE ..." (69 chars)
 */
export function parseGpResponse(tleText: string): SatelliteObject[] {
  const lines = tleText
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  const results: SatelliteObject[] = [];

  let i = 0;
  while (i < lines.length) {
    // TLE line 1 always starts with "1 " and line 2 with "2 "
    // Name line is everything before two consecutive TLE lines
    const line1Index = lines.findIndex((l, idx) => idx >= i && l.startsWith("1 ") && l.length === 69);
    if (line1Index === -1) break;

    const name = lines.slice(i, line1Index).join(" ").trim() || `SAT-${i}`;
    const line1 = lines[line1Index];
    const line2 = lines[line1Index + 1] ?? "";

    i = line1Index + 2;

    // Validate line 2
    if (!line2.startsWith("2 ") || line2.length !== 69) continue;

    try {
      const sat = parseTleLines(name, line1, line2);
      if (sat) results.push(sat);
    } catch {
      // skip malformed records
    }
  }

  return results;
}

function parseTleLines(
  name: string,
  line1: string,
  line2: string
): SatelliteObject | null {
  // --- Line 1 fields (0-indexed columns) ---
  // Col 2-6: NORAD catalog number
  const noradId = parseInt(line1.substring(2, 7).trim(), 10);
  if (isNaN(noradId)) return null;

  // Col 9-16: International designator (YYLLLPPP, e.g. "98067A  ")
  const intlRaw = line1.substring(9, 17).trim();
  // Convert 2-digit year to 4-digit: 57-99 → 1957-1999, 00-56 → 2000-2056
  let intlDesignator = intlRaw;
  let launchYear = 0;
  if (intlRaw.length >= 2) {
    const yy = parseInt(intlRaw.substring(0, 2), 10);
    const fullYear = yy >= 57 ? 1900 + yy : 2000 + yy;
    launchYear = fullYear;
    // Reconstruct to YYYY-LLL format for display
    intlDesignator = `${fullYear}-${intlRaw.substring(2)}`.trim();
  }

  // --- Line 2 fields ---
  // Col 8-15: Inclination (degrees)
  const inclinationDeg = parseFloat(line2.substring(8, 16));
  // Col 17-24: RAAN (degrees)
  const raanDeg = parseFloat(line2.substring(17, 25));
  // Col 26-32: Eccentricity (implied leading 0.)
  const eccentricity = parseFloat("0." + line2.substring(26, 33));
  // Col 34-41: Argument of pericenter (degrees)
  const argOfPericenterDeg = parseFloat(line2.substring(34, 42));
  // Col 52-62: Mean motion (rev/day)
  const meanMotion = parseFloat(line2.substring(52, 63));

  if (isNaN(meanMotion) || meanMotion <= 0) return null;

  const periodMin = 1440 / meanMotion;

  // Compute semi-major axis from mean motion (Kepler's 3rd law)
  const periodSec = periodMin * 60;
  const a_km = (MU_KM3_S2 * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);

  // Apogee and perigee above Earth's surface
  const apogeeKm = a_km * (1 + eccentricity) - EARTH_RADIUS_KM;
  const perigeeKm = a_km * (1 - eccentricity) - EARTH_RADIUS_KM;

  const cleanName = name.trim();

  return {
    noradId,
    name: cleanName,
    intlDesignator,
    countryCode: "",    // not available in TLE format
    launchDate: "",     // not available in TLE format
    launchYear,
    orbitClass: classifyOrbit(apogeeKm, perigeeKm, eccentricity),
    apogeeKm,
    perigeeKm,
    inclinationDeg,
    periodMin,
    eccentricity,
    raanDeg,
    argOfPericenterDeg,
    constellation: detectConstellation(cleanName),
    tleLine1: line1,
    tleLine2: line2,
  };
}
