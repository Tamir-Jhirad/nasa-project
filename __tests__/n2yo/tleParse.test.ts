import { deriveTleElements } from "@/lib/n2yo/tleParse";

// Real ISS TLE (epoch 2021-001)
const ISS_LINE1 = "1 25544U 98067A   21001.00000000  .00001264  00000-0  29734-4 0  9994";
const ISS_LINE2 = "2 25544  51.6442 208.2013 0001960 121.6659 328.2289 15.48919802260337";

describe("deriveTleElements", () => {
  const el = deriveTleElements(ISS_LINE1, ISS_LINE2);

  it("extracts inclination correctly", () => {
    expect(el.inclinationDeg).toBeCloseTo(51.64, 1);
  });

  it("extracts eccentricity correctly", () => {
    expect(el.eccentricity).toBeCloseTo(0.000196, 4);
  });

  it("computes period close to ~92.9 min for ISS", () => {
    expect(el.periodMin).toBeGreaterThan(90);
    expect(el.periodMin).toBeLessThan(96);
  });

  it("computes apogee in LEO range", () => {
    expect(el.apogeeKm).toBeGreaterThan(400);
    expect(el.apogeeKm).toBeLessThan(450);
  });

  it("computes perigee in LEO range", () => {
    expect(el.perigeeKm).toBeGreaterThan(395);
    expect(el.perigeeKm).toBeLessThan(430);
  });

  it("perigee is less than or equal to apogee", () => {
    expect(el.perigeeKm).toBeLessThanOrEqual(el.apogeeKm);
  });

  it("extracts RAAN (right ascension of ascending node)", () => {
    expect(el.raanDeg).toBeCloseTo(208.2, 0);
  });

  it("extracts argument of pericenter", () => {
    expect(el.argOfPericenterDeg).toBeCloseTo(121.67, 0);
  });
});
