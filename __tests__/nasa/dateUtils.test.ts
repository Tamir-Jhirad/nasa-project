import { parseCadDate } from "@/lib/nasa/dateUtils";

describe("parseCadDate", () => {
  it("converts NASA cd format to ISO 8601", () => {
    expect(parseCadDate("2026-Jan-01 15:44")).toBe("2026-01-01T15:44:00.000Z");
  });

  it("handles all month abbreviations", () => {
    expect(parseCadDate("2025-Dec-31 00:00")).toBe("2025-12-31T00:00:00.000Z");
    expect(parseCadDate("2026-Mar-15 09:30")).toBe("2026-03-15T09:30:00.000Z");
    expect(parseCadDate("2026-Sep-07 22:10")).toBe("2026-09-07T22:10:00.000Z");
  });

  it("returns null for invalid input", () => {
    expect(parseCadDate("")).toBeNull();
    expect(parseCadDate("garbage")).toBeNull();
  });
});
