import type { RiskCategory } from "./types";

const AU_IN_METERS = 1.496e11;      // meters per AU
const DENSITY_KG_M3 = 2000;         // typical S-type asteroid density

interface ScoreInput {
  diameterKm: number;
  velocityKmS: number;
  distAu: number;
}

/**
 * Computes log10(Impact Hazard Score + 1).
 * Formula: log10( (mass_kg × velocity_m/s) / dist_m² + 1 )
 */
export function computeRiskScore({ diameterKm, velocityKmS, distAu }: ScoreInput): number {
  const radiusM = (diameterKm * 1000) / 2;
  const massKg = (4 / 3) * Math.PI * Math.pow(radiusM, 3) * DENSITY_KG_M3;
  const velocityMs = velocityKmS * 1000;
  const distM = distAu * AU_IN_METERS;
  const rawScore = (massKg * velocityMs) / Math.pow(distM, 2);
  return Math.log10(rawScore + 1);
}

/** Maps a log-scale risk score to a human-readable risk category. */
export function categorizeRisk(logScore: number): RiskCategory {
  if (logScore >= 3.0) return "Critical";
  if (logScore >= 1.5) return "Watchlist";
  return "Safe";
}
