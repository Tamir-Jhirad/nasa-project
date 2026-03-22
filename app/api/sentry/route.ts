// app/api/sentry/route.ts
import { NextResponse } from "next/server";
import type { SentryResponse, SentryObject } from "@/lib/nasa/types";

const SENTRY_URL = "https://ssd-api.jpl.nasa.gov/sentry.api";
const TIMEOUT_MS = 15_000;

export const revalidate = 43200; // 12 hours

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(SENTRY_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[sentry] NASA Sentry API error ${res.status}:`, text);
      return NextResponse.json({ error: `NASA Sentry API error: ${res.status}` }, { status: 502 });
    }

    const raw = await res.json();

    if (!Array.isArray(raw.data)) {
      const detail = raw.message ?? "Unexpected response shape";
      console.error("[sentry] NASA Sentry API unexpected shape:", detail);
      return NextResponse.json(
        { error: `NASA Sentry API returned unexpected shape: ${detail}` },
        { status: 502 }
      );
    }

    // Sort by impact probability descending and take top 50
    const sorted = [...raw.data].sort(
      (a: any, b: any) => parseFloat(b.ip) - parseFloat(a.ip)
    );

    const objects: SentryObject[] = sorted.slice(0, 50).map((item: any) => ({
      des: item.des,
      fullname: (item.fullname ?? item.des ?? "").trim(),
      diameterKm: parseFloat(item.diameter),
      velocityKmS: item.v_inf != null ? parseFloat(item.v_inf) : null,
      impactProbability: parseFloat(item.ip),
      palmeroScale: item.ps_max != null ? parseFloat(item.ps_max) : null,
      impactYearRange: item.range,
      nImpacts: parseInt(item.n_imp, 10),
    }));

    const body: SentryResponse = {
      count: objects.length,
      revalidatedAt: new Date().toISOString(),
      objects,
    };

    return NextResponse.json(body);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "Sentry API timeout" }, { status: 504 });
    }
    console.error("[sentry] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
