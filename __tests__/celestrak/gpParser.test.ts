// __tests__/celestrak/gpParser.test.ts
import { parseGpResponse } from "@/lib/celestrak/gpParser";

// Minimal valid ISS-like GP record
const validRecord = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  NORAD_CAT_ID: 25544,
  OBJECT_TYPE: "PAYLOAD",
  MEAN_MOTION: 15.49,
  ECCENTRICITY: 0.0004,
  INCLINATION: 51.6421,
  RA_OF_ASC_NODE: 45.2,
  ARG_OF_PERICENTER: 60.3,
  APOAPSIS: 423.0,
  PERIAPSIS: 418.0,
  COUNTRY_CODE: "ISS",
  LAUNCH_DATE: "1998-11-20",
  TLE_LINE1: "1 25544U 98067A   26081.25000000  .00006000  00000-0  11111-3 0  9990",
  TLE_LINE2: "2 25544  51.6421  45.2000 0004000  60.3000 300.0000 15.49000000999990",
};

describe("parseGpResponse", () => {
  it("normalises a valid record correctly", () => {
    const result = parseGpResponse([validRecord]);
    expect(result).toHaveLength(1);
    const sat = result[0];
    expect(sat.noradId).toBe(25544);
    expect(sat.name).toBe("ISS (ZARYA)");
    expect(sat.intlDesignator).toBe("1998-067A");
    expect(sat.launchYear).toBe(1998);
    expect(sat.orbitClass).toBe("LEO");
    expect(sat.constellation).toBe("Space Station");
    expect(sat.periodMin).toBeCloseTo(92.96, 1);
    expect(sat.raanDeg).toBe(45.2);
    expect(sat.argOfPericenterDeg).toBe(60.3);
  });

  it("filters records with missing TLE_LINE1", () => {
    const bad = { ...validRecord, TLE_LINE1: null };
    expect(parseGpResponse([bad])).toHaveLength(0);
  });

  it("filters records with TLE_LINE1 length != 69", () => {
    const bad = { ...validRecord, TLE_LINE1: "short" };
    expect(parseGpResponse([bad])).toHaveLength(0);
  });

  it("filters non-PAYLOAD object types", () => {
    const debris = { ...validRecord, OBJECT_TYPE: "DEBRIS" };
    expect(parseGpResponse([debris])).toHaveLength(0);
  });

  it("handles absent OBJECT_ID — launchYear = 0", () => {
    const no_id = { ...validRecord, OBJECT_ID: null };
    const result = parseGpResponse([no_id]);
    expect(result[0].launchYear).toBe(0);
  });

  it("handles absent COUNTRY_CODE — countryCode = ''", () => {
    const no_cc = { ...validRecord, COUNTRY_CODE: null };
    const result = parseGpResponse([no_cc]);
    expect(result[0].countryCode).toBe("");
  });
});
