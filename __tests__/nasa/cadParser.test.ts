import { parseCadResponse } from "@/lib/nasa/cadParser";

const mockCadResponse = {
  signature: { version: "1.5", source: "NASA/JPL" },
  count: 2,
  fields: ["des", "orbit_id", "jd", "cd", "dist", "dist_min", "dist_max", "v_rel", "v_inf", "t_sigma_f", "h", "diameter", "diameter_sigma", "fullname"],
  data: [
    ["2025 YL4", "1", "2461042.0", "2026-Jan-01 15:44", "0.04", "0.039", "0.041", "15.5", "15.4", "00:10", "22.5", null, null, "       (2025 YL4)"],
    ["2015 FS33", "20", "2460777.0", "2025-Apr-12 01:14", "0.0375", "0.0375", "0.0375", "20.7", "20.7", "< 00:01", "22.56", "0.066", "0.013", "       (2015 FS33)"],
  ],
};

describe("parseCadResponse", () => {
  it("returns an array of NeoObjects", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result).toHaveLength(2);
  });

  it("trims fullname whitespace", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].fullname).toBe("(2025 YL4)");
  });

  it("parses closeApproachDate to ISO 8601", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].closeApproachDate).toBe("2026-01-01T15:44:00.000Z");
  });

  it("converts distAu and computes distKm", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].distAu).toBeCloseTo(0.04, 4);
    expect(result[0].distKm).toBeCloseTo(0.04 * 1.496e8, -2);
  });

  it("uses provided diameter when available", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[1].diameterKm).toBeCloseTo(0.066, 3);
  });

  it("estimates diameter from H when diameter is null", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].diameterKm).toBeGreaterThan(0);
  });

  it("computes a riskScore and riskCategory", () => {
    const result = parseCadResponse(mockCadResponse);
    expect(result[0].riskScore).toBeGreaterThan(0);
    expect(["Safe", "Watchlist", "Critical"]).toContain(result[0].riskCategory);
  });

  it("filters out rows with unparseable dates", () => {
    const bad = {
      ...mockCadResponse,
      data: [["X", "1", "0", "garbage date", "0.04", "0.04", "0.04", "10", "10", "00:00", "22", null, null, "X"]],
    };
    const result = parseCadResponse(bad);
    expect(result).toHaveLength(0);
  });
});
