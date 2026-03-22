// __tests__/nasa/orbitUtils.test.ts
import { computeOrbitPoints } from "@/lib/nasa/orbitUtils";
import type { OrbitalElements } from "@/lib/nasa/types";

/** Circular orbit in the ecliptic plane — simplest case */
const CIRCULAR_ECLIPTIC: OrbitalElements = { a: 1, e: 0, i: 0, om: 0, w: 0 };

/** High-eccentricity inclined orbit — exercises all rotation angles */
const INCLINED: OrbitalElements = { a: 1.5, e: 0.5, i: 30, om: 45, w: 90 };

describe("computeOrbitPoints", () => {
  it("returns the requested number of points", () => {
    const pts = computeOrbitPoints(CIRCULAR_ECLIPTIC, 60);
    expect(pts).toHaveLength(61); // 60 segments = 61 points (first repeated at end to close loop)
  });

  it("circular ecliptic orbit lies entirely in z=0 plane", () => {
    const pts = computeOrbitPoints(CIRCULAR_ECLIPTIC, 120);
    pts.forEach((p) => expect(Math.abs(p.z)).toBeLessThan(1e-9));
  });

  it("circular orbit has constant distance from origin equal to semi-major axis", () => {
    const pts = computeOrbitPoints(CIRCULAR_ECLIPTIC, 120);
    pts.forEach((p) => {
      const r = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
      expect(r).toBeCloseTo(1, 5); // a = 1 AU
    });
  });

  it("inclined orbit has non-zero z components", () => {
    const pts = computeOrbitPoints(INCLINED, 120);
    const maxZ = Math.max(...pts.map((p) => Math.abs(p.z)));
    expect(maxZ).toBeGreaterThan(0.1);
  });

  it("orbit closes — first and last point are identical", () => {
    const pts = computeOrbitPoints(INCLINED, 120);
    expect(pts[0].x).toBeCloseTo(pts[pts.length - 1].x, 10);
    expect(pts[0].y).toBeCloseTo(pts[pts.length - 1].y, 10);
    expect(pts[0].z).toBeCloseTo(pts[pts.length - 1].z, 10);
  });

  it("default nPoints is 120", () => {
    expect(computeOrbitPoints(CIRCULAR_ECLIPTIC)).toHaveLength(121);
  });
});
