// lib/n2yo/parser.ts
import type { N2YOAboveResponse } from "./types";
import type { SatelliteObject } from "@/lib/celestrak/types";
import { classifyOrbit } from "@/lib/celestrak/orbitClass";
import { detectConstellation } from "@/lib/celestrak/constellationDetect";

export function parseAboveResponse(data: N2YOAboveResponse): SatelliteObject[] {
  return data.above.map((sat) => {
    const launchYear = sat.launchDate
      ? parseInt(sat.launchDate.substring(0, 4), 10) || 0
      : 0;

    return {
      noradId: sat.satid,
      name: sat.satname,
      intlDesignator: sat.intDesignator,
      launchDate: sat.launchDate,
      launchYear,
      orbitClass: classifyOrbit(sat.satalt),
      altitudeKm: sat.satalt,
      lat: sat.satlat,
      lng: sat.satlng,
      constellation: detectConstellation(sat.satname),
    };
  });
}
