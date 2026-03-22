// app/api/orbit/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { OrbitalElements } from "@/lib/nasa/types";

export const revalidate = 86400; // 24-hour ISR — orbital elements rarely change

const SBDB_BASE = "https://ssd-api.jpl.nasa.gov/sbdb.api";

type SbdbElement = { label: string; value: string };

export async function GET(req: NextRequest) {
  const des = req.nextUrl.searchParams.get("des");
  if (!des) {
    return NextResponse.json({ error: "Missing des parameter" }, { status: 400 });
  }

  const url = `${SBDB_BASE}?sstr=${encodeURIComponent(des)}&cov=0&phys-par=0&full-prec=0`;
  let raw: Response;
  try {
    raw = await fetch(url);
  } catch {
    return NextResponse.json({ error: "SBDB request failed" }, { status: 502 });
  }

  if (!raw.ok) {
    return NextResponse.json({ error: "SBDB returned non-200" }, { status: 502 });
  }

  const data = await raw.json();
  const elements: SbdbElement[] = data?.orbit?.elements ?? [];

  const find = (label: string) => {
    const el = elements.find((e) => e.label === label);
    return el ? parseFloat(el.value) : null;
  };

  const a = find("a");
  const e = find("e");
  const i = find("i");
  const om = find("om");
  const w = find("w");

  if (a == null || e == null || i == null || om == null || w == null) {
    return NextResponse.json({ error: "Incomplete orbital elements from SBDB" }, { status: 502 });
  }

  const result: OrbitalElements = { a, e, i, om, w };
  return NextResponse.json(result);
}
