// lib/celestrak/gpParser.ts
import type { SatelliteObject } from "./types";
import { classifyOrbit } from "./orbitClass";
import { detectConstellation } from "./constellationDetect";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseGpResponse(raw: any[]): SatelliteObject[] {
  const results: SatelliteObject[] = [];

  for (const r of raw) {
    // Only active payloads
    if (r.OBJECT_TYPE !== "PAYLOAD") continue;

    // TLE validation — both lines required, exactly 69 chars each
    const line1: string = r.TLE_LINE1 ?? "";
    const line2: string = r.TLE_LINE2 ?? "";
    if (line1.length !== 69 || line2.length !== 69) continue;

    const intlDesignator: string = r.OBJECT_ID ?? "";
    const launchYear = intlDesignator
      ? parseInt(intlDesignator.slice(0, 4), 10) || 0
      : 0;

    const meanMotion: number = r.MEAN_MOTION ?? 0;
    const periodMin = meanMotion > 0 ? 1440 / meanMotion : 0;

    const apogeeKm: number = r.APOAPSIS ?? 0;
    const perigeeKm: number = r.PERIAPSIS ?? 0;
    const eccentricity: number = r.ECCENTRICITY ?? 0;

    results.push({
      noradId: r.NORAD_CAT_ID,
      name: (r.OBJECT_NAME ?? "").trim(),
      intlDesignator,
      countryCode: r.COUNTRY_CODE ?? "",
      launchDate: r.LAUNCH_DATE ?? "",
      launchYear,
      orbitClass: classifyOrbit(apogeeKm, perigeeKm, eccentricity),
      apogeeKm,
      perigeeKm,
      inclinationDeg: r.INCLINATION ?? 0,
      periodMin,
      eccentricity,
      raanDeg: r.RA_OF_ASC_NODE ?? 0,
      argOfPericenterDeg: r.ARG_OF_PERICENTER ?? 0,
      constellation: detectConstellation(r.OBJECT_NAME ?? ""),
      tleLine1: line1,
      tleLine2: line2,
    });
  }

  return results;
}
