const MU_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6371;

export interface TleElements {
  inclinationDeg: number;
  eccentricity: number;
  periodMin: number;
  raanDeg: number;
  argOfPericenterDeg: number;
  apogeeKm: number;
  perigeeKm: number;
}

/** Parses TLE Line 1 and Line 2 into derived orbital elements. */
export function deriveTleElements(line1: string, line2: string): TleElements {
  const inclinationDeg = parseFloat(line2.substring(8, 16));
  const raanDeg = parseFloat(line2.substring(17, 25));
  const eccentricity = parseFloat("0." + line2.substring(26, 33));
  const argOfPericenterDeg = parseFloat(line2.substring(34, 42));
  const meanMotion = parseFloat(line2.substring(52, 63)); // rev/day

  const periodMin = 1440 / meanMotion;
  const periodSec = periodMin * 60;
  const a_km = (MU_KM3_S2 * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);

  return {
    inclinationDeg,
    eccentricity,
    periodMin,
    raanDeg,
    argOfPericenterDeg,
    apogeeKm: a_km * (1 + eccentricity) - EARTH_RADIUS_KM,
    perigeeKm: a_km * (1 - eccentricity) - EARTH_RADIUS_KM,
  };
}
