// app/api/satellites/tle/[noradId]/route.ts
import { NextResponse } from "next/server";
import type { TleDerived } from "@/lib/celestrak/types";
import type { N2YOTleResponse } from "@/lib/n2yo/types";

export const runtime = "nodejs";
// Cache TLE for 6 hours — orbital elements change slowly
export const revalidate = 21600;

const N2YO_BASE = "https://api.n2yo.com/rest/v1/satellite";
const TIMEOUT_MS = 10_000;
const MU_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6371;

/** Parses two TLE lines and returns derived orbital elements. */
function deriveTleElements(line1: string, line2: string): Omit<TleDerived, "tleLine1" | "tleLine2"> {
  const inclinationDeg = parseFloat(line2.substring(8, 16));
  const raanDeg = parseFloat(line2.substring(17, 25));
  const eccentricity = parseFloat("0." + line2.substring(26, 33));
  const argOfPericenterDeg = parseFloat(line2.substring(34, 42));
  const meanMotion = parseFloat(line2.substring(52, 63)); // rev/day

  const periodMin = 1440 / meanMotion;
  const periodSec = periodMin * 60;
  const a_km = (MU_KM3_S2 * (periodSec / (2 * Math.PI)) ** 2) ** (1 / 3);

  return {
    inclinationDeg,
    eccentricity,
    periodMin,
    raanDeg,
    argOfPericenterDeg,
    apogeeKm: a_km * (1 + eccentricity) - EARTH_RADIUS_KM,
    perigeeKm: a_km * (1 - eccentricity) - EARTH_RADIUS_KM,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ noradId: string }> }
) {
  const { noradId } = await params;
  const apiKey = process.env.N2YO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "N2YO_API_KEY not configured" }, { status: 503 });
  }

  const url = `${N2YO_BASE}/tle/${noradId}?apiKey=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json({ error: `N2YO returned ${res.status}` }, { status: 502 });
    }

    const data: N2YOTleResponse = await res.json();
    // N2YO returns TLE as "LINE1\r\nLINE2" in a single string
    const [line1, line2] = data.tle.replace(/\r/g, "").split("\n").map((l) => l.trim());

    if (!line1 || !line2 || !line1.startsWith("1 ") || !line2.startsWith("2 ")) {
      return NextResponse.json({ error: "Invalid TLE data from N2YO" }, { status: 502 });
    }

    const derived = deriveTleElements(line1, line2);
    const body: TleDerived = { tleLine1: line1, tleLine2: line2, ...derived };
    return NextResponse.json(body);
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    console.error(`[tle] ${isTimeout ? "timeout" : "error"} for NORAD ${noradId}`, err);
    return NextResponse.json({ error: "TLE fetch failed" }, { status: 502 });
  }
}
