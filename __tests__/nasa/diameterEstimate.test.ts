import { estimateDiameterKm } from "@/lib/nasa/diameterEstimate";

describe("estimateDiameterKm", () => {
  it("returns provided diameter string as a number (ignores H)", () => {
    expect(estimateDiameterKm("0.5", 18)).toBeCloseTo(0.5, 4);
    expect(estimateDiameterKm("0.066", 22)).toBeCloseTo(0.066, 4);
  });

  it("estimates diameter from H magnitude when diameter is null", () => {
    // H=17.75 → ~1 km asteroid (standard result)
    const d = estimateDiameterKm(null, 17.75);
    expect(d).toBeGreaterThan(0.8);
    expect(d).toBeLessThan(1.2);
  });

  it("returns a smaller diameter for fainter (higher H) objects", () => {
    const small = estimateDiameterKm(null, 25);
    const large = estimateDiameterKm(null, 18);
    expect(small).toBeLessThan(large);
  });

  it("handles H = 0", () => {
    const d = estimateDiameterKm(null, 0);
    expect(d).toBeGreaterThan(100); // very bright = very large
  });
});
