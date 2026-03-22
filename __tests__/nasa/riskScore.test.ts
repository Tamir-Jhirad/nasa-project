import { computeRiskScore, categorizeRisk } from "@/lib/nasa/riskScore";

describe("computeRiskScore", () => {
  it("returns a positive number", () => {
    const score = computeRiskScore({
      diameterKm: 0.14,
      velocityKmS: 20,
      distAu: 0.02,
    });
    expect(score).toBeGreaterThan(0);
  });

  it("increases with larger diameter", () => {
    const small = computeRiskScore({ diameterKm: 0.1, velocityKmS: 10, distAu: 0.05 });
    const large = computeRiskScore({ diameterKm: 1.0, velocityKmS: 10, distAu: 0.05 });
    expect(large).toBeGreaterThan(small);
  });

  it("increases with higher velocity", () => {
    const slow = computeRiskScore({ diameterKm: 0.5, velocityKmS: 5, distAu: 0.05 });
    const fast = computeRiskScore({ diameterKm: 0.5, velocityKmS: 30, distAu: 0.05 });
    expect(fast).toBeGreaterThan(slow);
  });

  it("decreases with larger miss distance", () => {
    const near = computeRiskScore({ diameterKm: 0.5, velocityKmS: 10, distAu: 0.01 });
    const far  = computeRiskScore({ diameterKm: 0.5, velocityKmS: 10, distAu: 0.05 });
    expect(near).toBeGreaterThan(far);
  });
});

describe("categorizeRisk", () => {
  it("returns Safe for low scores", () => {
    expect(categorizeRisk(0.5)).toBe("Safe");
    expect(categorizeRisk(1.4)).toBe("Safe");
  });

  it("returns Watchlist for mid scores", () => {
    expect(categorizeRisk(1.5)).toBe("Watchlist");
    expect(categorizeRisk(2.9)).toBe("Watchlist");
  });

  it("returns Critical for high scores", () => {
    expect(categorizeRisk(3.0)).toBe("Critical");
    expect(categorizeRisk(5.0)).toBe("Critical");
  });
});
