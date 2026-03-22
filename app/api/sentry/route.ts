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
      return NextResponse.json({ error: `NASA Sentry API error: ${res.status}` }, { status: 502 });
    }

    const raw = await res.json();

    // Sort by impact probability descending and take top 50
    const sorted = [...raw.data].sort(
      (a: any, b: any) => parseFloat(b.ip) - parseFloat(a.ip)
    );

    const objects: SentryObject[] = sorted.slice(0, 50).map((item: any) => ({
      des: item.des,
      fullname: (item.fullname ?? item.des ?? "").trim(),
      diameterKm: parseFloat(item.diameter),
      velocityKmS: parseFloat(item.v_inf),
      impactProbability: parseFloat(item.ip),
      palmeroScale: parseFloat(item.ps_max),
      impactYearRange: item.range,
      nImpacts: item.n_imp,
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
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
