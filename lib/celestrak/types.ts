// lib/celestrak/types.ts

export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO";

/**
 * Constellation values produced by detectConstellation().
 * Detection is name-based — see constellationDetect.ts.
 */
export type Constellation =
  | "Starlink"
  | "OneWeb"
  | "GPS"
  | "Galileo"
  | "GLONASS"
  | "Space Station"
  | "Weather"
  | "Science"
  | "Other";

/** Keplerian elements for orbit ring computation in SatelliteGlobe. */
export interface SatelliteOrbitalElements {
  a: number;   // semi-major axis in Earth radii
  e: number;   // eccentricity
  i: number;   // inclination in degrees
  om: number;  // RAAN in degrees
  w: number;   // argument of pericenter in degrees
}

/** Active satellite from N2YO /above endpoint. */
export interface SatelliteObject {
  noradId: number;
  name: string;
  intlDesignator: string;    // e.g. "1998-067A"
  launchDate: string;        // ISO date string from N2YO, e.g. "1998-11-20"
  launchYear: number;        // parsed from launchDate
  orbitClass: OrbitClass;
  altitudeKm: number;        // current altitude above Earth surface (km)
  lat: number;               // current geodetic latitude (degrees)
  lng: number;               // current geodetic longitude (degrees)
  constellation: Constellation;
  // Optional — populated only when TLE is fetched on selection
  tleLine1?: string;
  tleLine2?: string;
  inclinationDeg?: number;
  eccentricity?: number;
  periodMin?: number;
  raanDeg?: number;
  argOfPericenterDeg?: number;
}

/** Orbital data derived from TLE — fetched on-demand when a satellite is selected. */
export interface TleDerived {
  tleLine1: string;
  tleLine2: string;
  inclinationDeg: number;
  eccentricity: number;
  periodMin: number;
  raanDeg: number;
  argOfPericenterDeg: number;
  apogeeKm: number;
  perigeeKm: number;
}

export interface SatelliteResponse {
  count: number;
  revalidatedAt: string;
  objects: SatelliteObject[];
}
