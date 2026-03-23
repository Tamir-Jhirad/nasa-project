// __tests__/celestrak/orbitUtils.test.ts
import { computeOrbitPointsGeo } from "@/lib/celestrak/orbitUtils";

// ISS orbital elements (approximate)
const ISS_ELEMENTS = {
  a: 1.067,         // Earth radii (~6798 km / 6371 km)
  e: 0.0004,
  i: 51.6421,
  om: 45.2,
  w: 60.3,
};

describe("computeOrbitPointsGeo", () => {
  it("returns nPoints+1 points (closed ring)", () => {
    const pts = computeOrbitPointsGeo(ISS_ELEMENTS, 120);
    expect(pts).toHaveLength(121);
  });

  it("first point approximately equals last point (closed)", () => {
    const pts = computeOrbitPointsGeo(ISS_ELEMENTS, 120);
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(Math.abs(first.x - last.x)).toBeLessThan(1e-10);
    expect(Math.abs(first.y - last.y)).toBeLessThan(1e-10);
    expect(Math.abs(first.z - last.z)).toBeLessThan(1e-10);
  });

  it("all points are at approximately the right distance from origin for circular orbit", () => {
    // For a near-circular orbit (e≈0), all points should be ≈ a from origin
    const circular = { a: 1.067, e: 0.0001, i: 51.6, om: 0, w: 0 };
    const pts = computeOrbitPointsGeo(circular, 60);
    for (const p of pts) {
      const r = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
      expect(r).toBeCloseTo(1.067, 3);
    }
  });

  it("semi-major axis from MEAN_MOTION=15.49 is approximately 1.067 ER", () => {
    const MU = 398600.4418;          // km³/s²
    const EARTH_RADIUS_KM = 6371;
    const meanMotion = 15.49;        // rev/day
    const periodSec = (1440 / meanMotion) * 60;
    const a_km = (MU * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);
    const a_ER = a_km / EARTH_RADIUS_KM;
    expect(a_ER).toBeCloseTo(1.067, 2);
  });
});
