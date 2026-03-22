// __tests__/celestrak/orbitClass.test.ts
import { classifyOrbit } from "@/lib/celestrak/orbitClass";

describe("classifyOrbit", () => {
  // GEO: apogee in [35500,36200], eccentricity < 0.01 — checked FIRST
  it("classifies GEO correctly", () => {
    expect(classifyOrbit(35786, 35786, 0.0001)).toBe("GEO");
  });
  it("classifies upper-edge GEO correctly", () => {
    expect(classifyOrbit(36200, 35900, 0.005)).toBe("GEO");
  });
  it("does not classify GEO when eccentricity >= 0.01", () => {
    expect(classifyOrbit(35786, 35000, 0.01)).not.toBe("GEO");
  });

  // HEO: eccentricity > 0.25 (and not GEO)
  it("classifies HEO correctly", () => {
    expect(classifyOrbit(40000, 500, 0.8)).toBe("HEO");
  });

  // LEO: perigee < 2000 (and not GEO or HEO)
  it("classifies ISS as LEO", () => {
    expect(classifyOrbit(423, 418, 0.0004)).toBe("LEO");
  });
  it("classifies LEO at boundary (perigee=1999)", () => {
    expect(classifyOrbit(2100, 1999, 0.001)).toBe("LEO");
  });

  // MEO: everything else
  it("classifies GPS as MEO", () => {
    expect(classifyOrbit(20200, 20180, 0.001)).toBe("MEO");
  });
});
