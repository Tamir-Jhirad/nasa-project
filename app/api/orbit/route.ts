// app/api/orbit/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { OrbitalElements } from "@/lib/nasa/types";

export const revalidate = 86400; // 24-hour ISR — orbital elements rarely change

const SBDB_BASE = "https://ssd-api.jpl.nasa.gov/sbdb.api";
const TIMEOUT_MS = 15_000;

type SbdbElement = { label: string; value: string };

export async function GET(req: NextRequest) {
  const des = req.nextUrl.searchParams.get("des");
  if (!des) {
    return NextResponse.json({ error: "Missing des parameter" }, { status: 400 });
  }

  const url = `${SBDB_BASE}?sstr=${encodeURIComponent(des)}&cov=0&phys-par=0&full-prec=0`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: Response;
  try {
    raw = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
  } catch (err) {
    clearTimeout(timer);
    console.error("[orbit] SBDB request failed:", err);
    return NextResponse.json({ error: "SBDB request failed" }, { status: 502 });
  }

  if (!raw.ok) {
    console.error(`[orbit] SBDB returned ${raw.status} for des=${des}`);
    return NextResponse.json({ error: "SBDB returned non-200" }, { status: 502 });
  }

  const data = await raw.json();
  const elements: SbdbElement[] = data?.orbit?.elements ?? [];

  const find = (label: string): number | null => {
    const el = elements.find((e) => e.label === label);
    if (!el) return null;
    const n = parseFloat(el.value);
    return Number.isFinite(n) ? n : null;
  };

  const a = find("a");
  const e = find("e");
  const i = find("i");
  const om = find("om");
  const w = find("w");

  if (a == null || e == null || i == null || om == null || w == null) {
    console.error(`[orbit] Incomplete orbital elements for des=${des}`, elements);
    return NextResponse.json({ error: "Incomplete orbital elements from SBDB" }, { status: 502 });
  }

  const result: OrbitalElements = { a, e, i, om, w };
  return NextResponse.json(result);
}
