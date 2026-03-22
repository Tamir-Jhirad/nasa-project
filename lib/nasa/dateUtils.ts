const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  May: "05", Jun: "06", Jul: "07", Aug: "08",
  Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/**
 * Parses NASA CAD close-approach date format: "2026-Jan-01 15:44"
 * Returns ISO 8601 string or null if invalid.
 */
export function parseCadDate(cd: string): string | null {
  if (!cd) return null;
  const match = cd.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})\s(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, monAbbr, day, hour, min] = match;
  const month = MONTH_MAP[monAbbr];
  if (!month) return null;
  return new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`).toISOString();
}
