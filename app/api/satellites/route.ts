// app/api/satellites/route.ts
import { NextResponse } from "next/server";
import { parseGpResponse } from "@/lib/celestrak/gpParser";
import type { SatelliteResponse } from "@/lib/celestrak/types";

const GP_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";
const TIMEOUT_MS = 10_000;

// Node.js runtime (NOT edge) — response can be 3-4 MB, edge limit is 4 MB
export const revalidate = 3600; // 1 hour

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(GP_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[satellites] CelesTrak error ${res.status}:`, text);
      return NextResponse.json(
        { error: `CelesTrak API error: ${res.status}` },
        { status: 503 }
      );
    }

    const raw = await res.text();

    if (typeof raw !== "string" || !raw.includes("1 ")) {
      console.error("[satellites] CelesTrak returned unexpected shape");
      return NextResponse.json(
        { error: "CelesTrak returned unexpected shape" },
        { status: 503 }
      );
    }

    const objects = parseGpResponse(raw);

    const body: SatelliteResponse = {
      count: objects.length,
      revalidatedAt: new Date().toISOString(),
      objects,
    };

    return NextResponse.json(body);
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json({ error: "CelesTrak timeout" }, { status: 503 });
    }
    console.error("[satellites] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
