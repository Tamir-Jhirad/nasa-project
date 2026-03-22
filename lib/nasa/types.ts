// lib/nasa/types.ts

export type RiskCategory = "Safe" | "Watchlist" | "Critical";

/** Normalized close-approach object from NASA CAD API */
export interface NeoObject {
  des: string;              // e.g. "2025 YL4"
  fullname: string;         // trimmed, e.g. "(2025 YL4)"
  closeApproachDate: string; // ISO 8601, e.g. "2026-01-01T15:44:00Z"
  distAu: number;           // miss distance in AU
  distKm: number;           // miss distance in km
  velocityKmS: number;      // relative velocity km/s
  diameterKm: number;       // estimated (from H mag)
  hMag: number;             // absolute magnitude H
  riskScore: number;        // log-scale score
  riskCategory: RiskCategory;
}

/** Object from NASA Sentry API (impact-risk objects) */
export interface SentryObject {
  des: string;
  fullname: string;
  diameterKm: number;
  velocityKmS: number;
  impactProbability: number;   // e.g. 0.002743
  palmeroScale: number;        // ps_max as number
  impactYearRange: string;     // e.g. "2056-2113"
  nImpacts: number;
}

/** Response from /api/close-approaches */
export interface CloseApproachesResponse {
  count: number;
  revalidatedAt: string;    // ISO timestamp of server fetch
  objects: NeoObject[];
}

/** Response from /api/sentry */
export interface SentryResponse {
  count: number;
  revalidatedAt: string;
  objects: SentryObject[];
}
