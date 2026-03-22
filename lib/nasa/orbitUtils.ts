// lib/nasa/orbitUtils.ts
import type { OrbitalElements } from "@/lib/nasa/types";

const DEG_TO_RAD = Math.PI / 180;

/**
 * Computes `nPoints + 1` positions along a Keplerian orbit in heliocentric
 * ecliptic J2000 coordinates (AU). The last point equals the first so that
 * THREE.js BufferGeometry renders a closed ring.
 *
 * Rotation convention: R_z(Ω) · R_x(i) · R_z(ω) applied to orbital-plane coords.
 */
export function computeOrbitPoints(
  elements: OrbitalElements,
  nPoints = 120
): Array<{ x: number; y: number; z: number }> {
  const { a, e, i, om, w } = elements;

  const iRad  = i  * DEG_TO_RAD;
  const omRad = om * DEG_TO_RAD;
  const wRad  = w  * DEG_TO_RAD;

  const cosOm = Math.cos(omRad), sinOm = Math.sin(omRad);
  const cosI  = Math.cos(iRad),  sinI  = Math.sin(iRad);
  const cosW  = Math.cos(wRad),  sinW  = Math.sin(wRad);

  // P-vector and Q-vector: rotate orbital plane to ecliptic frame
  // r_ecl = P * X + Q * Y  where X = r·cos θ, Y = r·sin θ
  const Px =  cosOm * cosW - sinOm * sinW * cosI;
  const Py =  sinOm * cosW + cosOm * sinW * cosI;
  const Pz =  sinW * sinI;

  const Qx = -cosOm * sinW - sinOm * cosW * cosI;
  const Qy = -sinOm * sinW + cosOm * cosW * cosI;
  const Qz =  cosW * sinI;

  const points: Array<{ x: number; y: number; z: number }> = [];
  const semiLatus = a * (1 - e * e);

  for (let k = 0; k <= nPoints; k++) {
    const theta = (2 * Math.PI * k) / nPoints;
    const r = semiLatus / (1 + e * Math.cos(theta));

    const X = r * Math.cos(theta); // position in orbital plane
    const Y = r * Math.sin(theta);

    points.push({
      x: Px * X + Qx * Y,
      y: Py * X + Qy * Y,
      z: Pz * X + Qz * Y,
    });
  }

  return points;
}
