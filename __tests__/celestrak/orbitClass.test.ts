// __tests__/celestrak/orbitClass.test.ts
import { classifyOrbit } from "@/lib/celestrak/orbitClass";

describe("classifyOrbit(altitudeKm)", () => {
  it("classifies ISS (408 km) as LEO", () => {
    expect(classifyOrbit(408)).toBe("LEO");
  });
  it("classifies upper LEO boundary (1999 km) as LEO", () => {
    expect(classifyOrbit(1999)).toBe("LEO");
  });
  it("classifies GPS (20200 km) as MEO", () => {
    expect(classifyOrbit(20200)).toBe("MEO");
  });
  it("classifies GEO (35786 km) as GEO", () => {
    expect(classifyOrbit(35786)).toBe("GEO");
  });
  it("classifies upper GEO edge (36500 km) as GEO", () => {
    expect(classifyOrbit(36500)).toBe("GEO");
  });
  it("classifies altitude above GEO band (40000 km) as HEO", () => {
    expect(classifyOrbit(40000)).toBe("HEO");
  });
  it("classifies LEO/MEO boundary (2000 km) as MEO", () => {
    expect(classifyOrbit(2000)).toBe("MEO");
  });
});
