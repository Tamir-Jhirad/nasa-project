// app/api/satellites/route.ts
import { NextResponse } from "next/server";
import { parseAboveResponse } from "@/lib/n2yo/parser";
import type { N2YOAboveResponse } from "@/lib/n2yo/types";
import type { SatelliteObject, SatelliteResponse } from "@/lib/celestrak/types";

export const runtime = "nodejs";
// ISR: cache the route response for 1 hour — N2YO positions are live but
// for a dashboard census (total counts, orbit class breakdown) hourly is enough.
export const revalidate = 3600;

const N2YO_BASE = "https://api.n2yo.com/rest/v1/satellite";
const CATEGORY_ALL = 0;
const RADIUS_DEG = 90; // degrees — covers one full hemisphere per observer
const TIMEOUT_MS = 15_000;

// Two observers 180° apart → global coverage after dedup
const OBSERVERS = [
  { lat: 0, lng: 0 },    // Gulf of Guinea — covers Africa/Europe/Asia hemisphere
  { lat: 0, lng: 180 },  // Pacific — covers Americas/Pacific hemisphere
];

function aboveUrl(lat: number, lng: number, apiKey: string): string {
  // N2YO path: /above/{lat}/{lng}/{alt}/{radius}/{category} — apiKey is a query param
  return `${N2YO_BASE}/above/${lat}/${lng}/0/${RADIUS_DEG}/${CATEGORY_ALL}?apiKey=${apiKey}`;
}

async function fetchHemisphere(
  lat: number,
  lng: number,
  apiKey: string
): Promise<SatelliteObject[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(aboveUrl(lat, lng, apiKey), {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.error(`[satellites] N2YO error — status=${res.status} lat=${lat} lng=${lng}`);
      return [];
    }
    const data: N2YOAboveResponse = await res.json();
    const objects = parseAboveResponse(data);
    console.log(`[satellites] N2YO above(${lat},${lng}) → ${objects.length} satellites`);
    return objects;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[satellites] N2YO fetch timed out after ${TIMEOUT_MS}ms lat=${lat} lng=${lng}`);
    } else {
      console.error(`[satellites] N2YO fetch threw lat=${lat} lng=${lng}`, err);
    }
    return [];
  }
}

function dedupeByNorad(objects: SatelliteObject[]): SatelliteObject[] {
  const seen = new Set<number>();
  return objects.filter((o) => {
    if (seen.has(o.noradId)) return false;
    seen.add(o.noradId);
    return true;
  });
}

export async function GET() {
  const apiKey = process.env.N2YO_API_KEY;
  if (!apiKey) {
    console.error("[satellites] N2YO_API_KEY is not set");
    return NextResponse.json(
      { error: "N2YO_API_KEY environment variable is not configured" },
      { status: 503 }
    );
  }

  const results = await Promise.allSettled(
    OBSERVERS.map(({ lat, lng }) => fetchHemisphere(lat, lng, apiKey))
  );

  const combined: SatelliteObject[] = [];
  results.forEach((r) => {
    if (r.status === "fulfilled") combined.push(...r.value);
  });

  const objects = dedupeByNorad(combined);

  if (objects.length === 0) {
    console.error("[satellites] both hemisphere fetches returned 0 satellites");
    return NextResponse.json(
      { error: "N2YO API unavailable — try again later" },
      { status: 503 }
    );
  }

  console.log(`[satellites] total unique satellites: ${objects.length}`);
  const body: SatelliteResponse = {
    count: objects.length,
    revalidatedAt: new Date().toISOString(),
    objects,
  };
  return NextResponse.json(body);
}
