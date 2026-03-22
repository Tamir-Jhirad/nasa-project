// __tests__/globe/globeUtils.test.ts
import { toGlobeArcs, toGlobePoints, limitGlobeObjects } from "@/components/globe/globeUtils";
import type { NeoObject } from "@/lib/nasa/types";

const makeNeo = (overrides: Partial<NeoObject> = {}): NeoObject => ({
  des: "2025 AA1",
  fullname: "(2025 AA1)",
  closeApproachDate: "2026-04-01T00:00:00Z",
  distAu: 0.02,
  distKm: 2992000,
  velocityKmS: 12,
  diameterKm: 0.05,
  hMag: 22,
  riskScore: 1.2,
  riskCategory: "Safe",
  ...overrides,
});

describe("toGlobeArcs", () => {
  it("returns one arc per object", () => {
    const neos = [makeNeo(), makeNeo({ des: "2025 BB2" })];
    expect(toGlobeArcs(neos, null)).toHaveLength(2);
  });

  it("arc color reflects risk category when nothing selected", () => {
    const safe = toGlobeArcs([makeNeo({ riskCategory: "Safe" })], null)[0];
    const critical = toGlobeArcs([makeNeo({ riskCategory: "Critical" })], null)[0];
    expect(safe.color).not.toEqual(critical.color);
  });

  it("non-selected arcs are dimmed when a selection is active", () => {
    const neos = [makeNeo({ des: "A" }), makeNeo({ des: "B" })];
    const arcs = toGlobeArcs(neos, "A");
    // arc for "A" should be full opacity, arc for "B" should be dimmed
    expect(arcs[0].color).not.toEqual(arcs[1].color);
    expect(arcs[1].color).toContain("0.2"); // dimmed to 20% opacity
  });

  it("arc altitude is proportional to miss distance", () => {
    const near = toGlobeArcs([makeNeo({ distAu: 0.005 })], null)[0];
    const far = toGlobeArcs([makeNeo({ distAu: 0.04 })], null)[0];
    expect(far.altitude).toBeGreaterThan(near.altitude);
  });
});

describe("toGlobePoints", () => {
  it("returns one point per Critical or Watchlist object", () => {
    const neos = [
      makeNeo({ riskCategory: "Critical" }),
      makeNeo({ des: "X", riskCategory: "Watchlist" }),
      makeNeo({ des: "Y", riskCategory: "Safe" }),
    ];
    expect(toGlobePoints(neos)).toHaveLength(2);
  });
});

describe("limitGlobeObjects", () => {
  it("returns at most max objects", () => {
    const neos = Array.from({ length: 80 }, (_, i) =>
      makeNeo({ des: `${i}`, riskScore: i * 0.05 })
    );
    expect(limitGlobeObjects(neos, 50)).toHaveLength(50);
  });

  it("prioritises Critical > Watchlist > Safe", () => {
    const safe = makeNeo({ des: "S", riskCategory: "Safe", riskScore: 0.5 });
    const watchlist = makeNeo({ des: "W", riskCategory: "Watchlist", riskScore: 2.0 });
    const critical = makeNeo({ des: "C", riskCategory: "Critical", riskScore: 3.5 });
    // With max=2, should keep critical and watchlist, drop safe
    const result = limitGlobeObjects([safe, watchlist, critical], 2);
    expect(result.map(o => o.des)).toEqual(expect.arrayContaining(["C", "W"]));
    expect(result.map(o => o.des)).not.toContain("S");
  });

  it("returns all objects when count is below max", () => {
    const neos = [makeNeo(), makeNeo({ des: "B" })];
    expect(limitGlobeObjects(neos, 50)).toHaveLength(2);
  });
});
