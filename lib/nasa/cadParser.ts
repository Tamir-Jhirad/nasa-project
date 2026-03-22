// lib/nasa/cadParser.ts
import type { NeoObject } from "./types";
import { parseCadDate } from "./dateUtils";
import { estimateDiameterKm } from "./diameterEstimate";
import { computeRiskScore, categorizeRisk } from "./riskScore";

const AU_TO_KM = 1.496e8;

interface RawCadResponse {
  fields: string[];
  data: (string | null)[][];
}

export function parseCadResponse(raw: RawCadResponse): NeoObject[] {
  const { fields, data } = raw;
  const idx = Object.fromEntries(fields.map((f, i) => [f, i]));

  const results: NeoObject[] = [];

  for (const row of data) {
    const get = (field: string) => row[idx[field]] ?? null;

    const cdStr = get("cd") as string | null;
    const closeApproachDate = cdStr ? parseCadDate(cdStr) : null;
    if (!closeApproachDate) continue; // skip unparseable rows

    const distAu = parseFloat(get("dist") as string);
    const velocityKmS = parseFloat(get("v_rel") as string);
    const hMag = parseFloat(get("h") as string);
    const diameterKm = estimateDiameterKm(get("diameter") as string | null, hMag);

    const riskScore = computeRiskScore({ diameterKm, velocityKmS, distAu });
    const riskCategory = categorizeRisk(riskScore);

    results.push({
      des: get("des") as string,
      fullname: ((get("fullname") as string) ?? "").trim(),
      closeApproachDate,
      distAu,
      distKm: distAu * AU_TO_KM,
      velocityKmS,
      diameterKm,
      hMag,
      riskScore,
      riskCategory,
    });
  }

  return results;
}
