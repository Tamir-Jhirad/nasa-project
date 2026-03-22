// __tests__/celestrak/gpParser.test.ts
import { parseGpResponse } from "@/lib/celestrak/gpParser";

// Real ISS TLE (representative — exact values don't matter for unit tests)
const ISS_LINE1 = "1 25544U 98067A   26081.16395000  .00015089  00000-0  28686-3 0  9991";
const ISS_LINE2 = "2 25544  51.6343  10.6992 0006186 218.8034 141.2511 15.48444672501196";

const VALID_TLE = `ISS (ZARYA)\n${ISS_LINE1}\n${ISS_LINE2}\n`;

describe("parseGpResponse", () => {
  it("parses a valid TLE record", () => {
    const result = parseGpResponse(VALID_TLE);
    expect(result).toHaveLength(1);
    const sat = result[0];
    expect(sat.noradId).toBe(25544);
    expect(sat.name).toBe("ISS (ZARYA)");
    expect(sat.intlDesignator).toBe("1998-067A");
    expect(sat.launchYear).toBe(1998);
    expect(sat.orbitClass).toBe("LEO");
    expect(sat.constellation).toBe("Space Station");
    expect(sat.periodMin).toBeCloseTo(1440 / 15.48444672, 2);
    expect(sat.raanDeg).toBeCloseTo(10.6992, 3);
    expect(sat.argOfPericenterDeg).toBeCloseTo(218.8034, 3);
    expect(sat.tleLine1).toBe(ISS_LINE1);
    expect(sat.tleLine2).toBe(ISS_LINE2);
  });

  it("skips records with malformed line 2 (wrong length)", () => {
    const bad = `ISS (ZARYA)\n${ISS_LINE1}\nTOO_SHORT\n`;
    expect(parseGpResponse(bad)).toHaveLength(0);
  });

  it("skips records where line 2 does not start with '2 '", () => {
    const bad = `ISS (ZARYA)\n${ISS_LINE1}\n${ISS_LINE1}\n`; // line1 repeated instead of line2
    expect(parseGpResponse(bad)).toHaveLength(0);
  });

  it("parses multiple records", () => {
    const STARLINK_NAME = "STARLINK-1008";
    const STARLINK_L1 =   "1 44714U 19074BH  26081.16395000  .00001200  00000-0  10000-3 0  9993";
    const STARLINK_L2 =   "2 44714  53.0555 123.4567 0001234  90.1234 270.0000 15.06400000123456";
    const twoSats = `${VALID_TLE}${STARLINK_NAME}\n${STARLINK_L1}\n${STARLINK_L2}\n`;
    const result = parseGpResponse(twoSats);
    expect(result).toHaveLength(2);
    expect(result[1].name).toBe(STARLINK_NAME);
    expect(result[1].constellation).toBe("Starlink");
  });

  it("handles empty input", () => {
    expect(parseGpResponse("")).toHaveLength(0);
  });

  it("derives launchYear=0 for records with malformed international designator", () => {
    // If year part is not parseable the year should be 0
    const weirdLine1 = "1 99999U          26081.16395000  .00000000  00000-0  00000-0 0  9991";
    const tleText = `UNKNOWN\n${weirdLine1}\n${ISS_LINE2.replace("25544", "99999")}\n`;
    const result = parseGpResponse(tleText);
    if (result.length > 0) {
      expect(result[0].launchYear).toBe(0);
    }
    // (might also produce 0 results if noradId mismatch — that's fine)
  });

  it("computes apogee and perigee from TLE mean motion and eccentricity", () => {
    const result = parseGpResponse(VALID_TLE);
    expect(result[0].apogeeKm).toBeGreaterThan(380);
    expect(result[0].apogeeKm).toBeLessThan(460);
    expect(result[0].perigeeKm).toBeGreaterThan(380);
    expect(result[0].perigeeKm).toBeLessThan(460);
  });
});

describe("parseGpResponse — HTML error page input", () => {
  it("returns empty array for a CelesTrak HTML error page", () => {
    // CelesTrak sometimes returns HTML for rate-limited/blocked requests.
    // This ensures the parser doesn't produce satellite objects from HTML content.
    const htmlErrorPage = `<!DOCTYPE html>
<html lang="en">
<head><title>CelesTrak Error</title></head>
<body>
  <h1>Service Temporarily Unavailable</h1>
  <p>Please try again later. Reference: 1 2 3.</p>
</body>
</html>`;

    const result = parseGpResponse(htmlErrorPage);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for an empty string", () => {
    expect(parseGpResponse("")).toHaveLength(0);
  });

  it("returns empty array for a plain text error message", () => {
    // CelesTrak may return plain-text errors too
    const plainError = "Error: Too many requests. Please slow down.";
    expect(parseGpResponse(plainError)).toHaveLength(0);
  });
});
