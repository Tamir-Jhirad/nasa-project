import { detectConstellation } from "@/lib/celestrak/constellationDetect";

describe("detectConstellation", () => {
  it("detects Starlink", () => {
    expect(detectConstellation("STARLINK-1234")).toBe("Starlink");
  });
  it("detects OneWeb", () => {
    expect(detectConstellation("ONEWEB-0100")).toBe("OneWeb");
  });
  it("detects GPS via GPS keyword", () => {
    expect(detectConstellation("GPS BIIR-2 (PRN 13)")).toBe("GPS");
  });
  it("detects GPS via NAVSTAR", () => {
    expect(detectConstellation("NAVSTAR 43 (PRN 13)")).toBe("GPS");
  });
  it("detects Galileo", () => {
    expect(detectConstellation("GALILEO-FOC FM3")).toBe("Galileo");
  });
  it("detects GLONASS", () => {
    expect(detectConstellation("GLONASS-M")).toBe("GLONASS");
  });
  it("detects ISS", () => {
    expect(detectConstellation("ISS (ZARYA)")).toBe("Space Station");
  });
  it("detects Tiangong", () => {
    expect(detectConstellation("TIANHE (CSS)")).toBe("Space Station");
  });
  it("detects NOAA weather sat", () => {
    expect(detectConstellation("NOAA 19")).toBe("Weather");
  });
  it("detects GOES weather sat", () => {
    expect(detectConstellation("GOES 16")).toBe("Weather");
  });
  it("detects Hubble", () => {
    expect(detectConstellation("HST (HUBBLE SPACE TELESCOPE)")).toBe("Science");
  });
  it("falls back to Other", () => {
    expect(detectConstellation("ASTRA 2E")).toBe("Other");
  });
  it("is case-insensitive", () => {
    expect(detectConstellation("starlink-9999")).toBe("Starlink");
  });
});
