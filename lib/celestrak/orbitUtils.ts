// lib/celestrak/orbitUtils.ts
import type { SatelliteOrbitalElements } from "./types";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Computes nPoints+1 positions along a Keplerian orbit in geocentric
 * equatorial (ECI) J2000 coordinates (Earth radii). The last point
 * equals the first, producing a closed ring for THREE.js BufferGeometry.
 *
 * Input elements must be in the ECI frame (as provided by CelesTrak GP data):
 *   a  — semi-major axis in Earth radii
 *   e  — eccentricity
 *   i  — inclination (degrees)
 *   om — RAAN, right ascension of ascending node (degrees)
 *   w  — argument of pericenter (degrees)
 *
 * This is NOT the same as lib/nasa/orbitUtils.ts, which uses heliocentric
 * ecliptic coordinates for asteroid orbits. Do not merge these files.
 */
export function computeOrbitPointsGeo(
  elements: SatelliteOrbitalElements,
  nPoints = 120
): Array<{ x: number; y: number; z: number }> {
  const { a, e, i, om, w } = elements;

  const iRad  = i  * DEG_TO_RAD;
  const omRad = om * DEG_TO_RAD;
  const wRad  = w  * DEG_TO_RAD;

  const cosOm = Math.cos(omRad), sinOm = Math.sin(omRad);
  const cosI  = Math.cos(iRad),  sinI  = Math.sin(iRad);
  const cosW  = Math.cos(wRad),  sinW  = Math.sin(wRad);

  // P and Q unit vectors — rotate orbital plane into ECI frame
  const Px =  cosOm * cosW - sinOm * sinW * cosI;
  const Py =  sinOm * cosW + cosOm * sinW * cosI;
  const Pz =  sinW * sinI;

  const Qx = -cosOm * sinW - sinOm * cosW * cosI;
  const Qy = -sinOm * sinW + cosOm * cosW * cosI;
  const Qz =  cosW * sinI;

  const semiLatus = a * (1 - e * e);
  const points: Array<{ x: number; y: number; z: number }> = [];

  for (let k = 0; k <= nPoints; k++) {
    const theta = (2 * Math.PI * k) / nPoints;
    const r = semiLatus / (1 + e * Math.cos(theta));
    const X = r * Math.cos(theta);
    const Y = r * Math.sin(theta);
    points.push({
      x: Px * X + Qx * Y,
      y: Py * X + Qy * Y,
      z: Pz * X + Qz * Y,
    });
  }

  return points;
}
