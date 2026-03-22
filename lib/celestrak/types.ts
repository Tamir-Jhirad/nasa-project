// lib/celestrak/types.ts

export type OrbitClass = "LEO" | "MEO" | "GEO" | "HEO";

/**
 * Constellation values produced by detectConstellation().
 * Detection is name-based — see constellationDetect.ts.
 */
export type Constellation =
  | "Starlink"       // name starts with "STARLINK"
  | "OneWeb"         // name starts with "ONEWEB"
  | "GPS"            // name includes "GPS" or "NAVSTAR"
  | "Galileo"        // name starts with "GALILEO"
  | "GLONASS"        // name starts with "GLONASS"
  | "Space Station"  // name includes "ISS", "TIANGONG", or "CSS"
  | "Weather"        // name includes "NOAA", "GOES", "METEOSAT", or "METEOR"
  | "Science"        // name includes "HUBBLE" or "CHANDRA"
  | "Other";

/** Keplerian elements for a geocentric ECI orbit (NOT heliocentric ecliptic). */
export interface SatelliteOrbitalElements {
  a: number;   // semi-major axis in Earth radii (dimensionless)
  e: number;   // eccentricity (dimensionless)
  i: number;   // inclination in degrees
  om: number;  // RAAN (right ascension of ascending node) in degrees
  w: number;   // argument of pericenter in degrees
}

/** Normalised active satellite from CelesTrak GP JSON. */
export interface SatelliteObject {
  noradId: number;
  name: string;
  intlDesignator: string;    // e.g. "1998-067A"
  countryCode: string;       // may be "" if absent from GP response
  launchDate: string;        // may be "" if absent from GP response
  launchYear: number;        // parseInt(intlDesignator.slice(0,4)) || 0
  orbitClass: OrbitClass;
  apogeeKm: number;
  perigeeKm: number;
  inclinationDeg: number;
  periodMin: number;         // 1440 / MEAN_MOTION (MEAN_MOTION in rev/day)
  eccentricity: number;
  raanDeg: number;           // RA_OF_ASC_NODE
  argOfPericenterDeg: number; // ARG_OF_PERICENTER
  constellation: Constellation;
  tleLine1: string;
  tleLine2: string;
}

export interface SatelliteResponse {
  count: number;
  revalidatedAt: string;
  objects: SatelliteObject[];
}
