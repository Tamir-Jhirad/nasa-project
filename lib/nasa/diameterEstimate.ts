const ALBEDO = 0.14; // geometric albedo for typical S-type asteroid

/**
 * Returns diameter in km.
 * Uses provided diameter string if non-null, otherwise estimates from H magnitude.
 * Formula: D = (1329 / sqrt(p)) × 10^(-H/5)
 */
export function estimateDiameterKm(
  diameterStr: string | null | undefined,
  hMag: number
): number {
  if (diameterStr != null && diameterStr !== "") {
    const parsed = parseFloat(diameterStr);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return (1329 / Math.sqrt(ALBEDO)) * Math.pow(10, -hMag / 5);
}
