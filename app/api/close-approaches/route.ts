// app/api/close-approaches/route.ts
import { NextResponse } from "next/server";
import { parseCadResponse } from "@/lib/nasa/cadParser";
import type { CloseApproachesResponse } from "@/lib/nasa/types";

const CAD_BASE = "https://ssd-api.jpl.nasa.gov/cad.api";
const TIMEOUT_MS = 15_000;

export const revalidate = 43200; // 12 hours

export async function GET() {
  // Query the next 6 months of close approaches within 0.05 AU
  const today = new Date();
  const sixMonths = new Date(today);
  sixMonths.setMonth(sixMonths.getMonth() + 6);

  const params = new URLSearchParams({
    "date-min": today.toISOString().split("T")[0],
    "date-max": sixMonths.toISOString().split("T")[0],
    "dist-max": "0.05",
    "diameter": "true",
    "fullname": "true",
    "sort": "date",
  });

  const url = `${CAD_BASE}?${params.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json(
        { error: `NASA API error: ${res.status}` },
        { status: 502 }
      );
    }

    const raw = await res.json();
    const objects = parseCadResponse(raw);

    const body: CloseApproachesResponse = {
      count: objects.length,
      revalidatedAt: new Date().toISOString(),
      objects,
    };

    return NextResponse.json(body);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "NASA API timeout" }, { status: 504 });
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
