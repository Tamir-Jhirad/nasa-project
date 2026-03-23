import { parseAboveResponse } from "@/lib/n2yo/parser";
import type { N2YOAboveResponse } from "@/lib/n2yo/types";

const MOCK_RESPONSE: N2YOAboveResponse = {
  info: { category: "All", satcount: 2, transactionscount: 1 },
  above: [
    {
      satid: 25544,
      satname: "ISS (ZARYA)",
      intDesignator: "1998-067A",
      launchDate: "1998-11-20",
      satlat: 51.64,
      satlng: -50.12,
      satalt: 408.05,
    },
    {
      satid: 48274,
      satname: "STARLINK-1234",
      intDesignator: "2021-024A",
      launchDate: "2021-03-24",
      satlat: -12.3,
      satlng: 100.0,
      satalt: 550.0,
    },
  ],
};

describe("parseAboveResponse", () => {
  const result = parseAboveResponse(MOCK_RESPONSE);

  it("returns one SatelliteObject per above entry", () => {
    expect(result).toHaveLength(2);
  });

  it("maps satid → noradId", () => {
    expect(result[0].noradId).toBe(25544);
  });

  it("maps satname → name", () => {
    expect(result[0].name).toBe("ISS (ZARYA)");
  });

  it("maps intDesignator → intlDesignator", () => {
    expect(result[0].intlDesignator).toBe("1998-067A");
  });

  it("maps launchDate correctly", () => {
    expect(result[0].launchDate).toBe("1998-11-20");
  });

  it("extracts launchYear from launchDate", () => {
    expect(result[0].launchYear).toBe(1998);
  });

  it("maps satlat → lat", () => {
    expect(result[0].lat).toBeCloseTo(51.64);
  });

  it("maps satlng → lng", () => {
    expect(result[0].lng).toBeCloseTo(-50.12);
  });

  it("maps satalt → altitudeKm", () => {
    expect(result[0].altitudeKm).toBeCloseTo(408.05);
  });

  it("classifies ISS as LEO", () => {
    expect(result[0].orbitClass).toBe("LEO");
  });

  it("detects ISS constellation as Space Station", () => {
    expect(result[0].constellation).toBe("Space Station");
  });

  it("detects Starlink constellation", () => {
    expect(result[1].constellation).toBe("Starlink");
  });

  it("returns empty array for empty above list", () => {
    expect(parseAboveResponse({ ...MOCK_RESPONSE, above: [] })).toHaveLength(0);
  });
});
