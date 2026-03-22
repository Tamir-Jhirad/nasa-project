// app/api/satellites/route.ts
import { NextResponse } from "next/server";
import { parseGpResponse } from "@/lib/celestrak/gpParser";
import type { SatelliteResponse, SatelliteObject } from "@/lib/celestrak/types";

// Primary URL — all active payloads (~10 000 satellites, 3–4 MB TLE text)
const PRIMARY_URL =
  "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";

// Fallback groups fetched in parallel when the primary URL fails/times out.
// Smaller payloads (30–7000 sats each) that collectively cover all constellations.
const FALLBACK_GROUPS = [
  "stations",   // ISS, Tiangong, crewed craft (~50)
  "starlink",   // SpaceX Starlink (~7000, may still timeout — that's OK)
  "oneweb",     // OneWeb constellation (~600)
  "weather",    // NOAA, Meteosat, GOES, etc. (~80)
  "gps-ops",    // GPS operational block (~31)
  "glo-ops",    // GLONASS operational (~24)
  "galileo",    // Galileo navigation (~27)
  "science",    // Scientific/research satellites (~150)
  "amateur",    // Amateur radio sats (~100)
];

const FETCH_HEADERS = {
  "User-Agent": "nasa-dashboard/1.0 (educational project)",
  Accept: "text/plain",
};

const PRIMARY_TIMEOUT_MS = 30_000;   // 30 s — plenty for a 4 MB download
const FALLBACK_TIMEOUT_MS = 15_000;  // 15 s per group

// Node.js runtime (NOT edge) — response can be 3–4 MB
export const runtime = "nodejs";
// ISR caches the route response for 1 hour. The inner fetch() uses cache:"no-store"
// to prevent Next.js from separately caching a stale CelesTrak error response — these
// two settings operate at different layers and are intentionally complementary.
export const revalidate = 3600; // 1 hour

/** Returns true when the string looks like an HTML document (error page). */
function isLikelyHtml(text: string): boolean {
  const head = text.trimStart().substring(0, 100).toLowerCase();
  return (
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<head") ||
    head.startsWith("<body")
  );
}

/** Fetches a single CelesTrak TLE URL with the given timeout. Returns the raw text or null. */
async function fetchTle(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: FETCH_HEADERS,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error(
        `[satellites] fetch error — status=${res.status} url=${url}`
      );
      return null;
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("html")) {
      const snippet = (await res.text()).substring(0, 300);
      console.error(
        `[satellites] CelesTrak returned HTML (likely error page). url=${url} content-type=${contentType} snippet=${snippet}`
      );
      return null;
    }

    const text = await res.text();
    if (isLikelyHtml(text)) {
      console.error(
        `[satellites] CelesTrak body looks like HTML despite content-type=${contentType}. url=${url} snippet=${text.substring(0, 300)}`
      );
      return null;
    }

    return text;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[satellites] fetch timed out after ${timeoutMs}ms — url=${url}`);
    } else {
      console.error(`[satellites] fetch threw — url=${url}`, err);
    }
    return null;
  }
}

/** Deduplicates SatelliteObjects by NORAD ID. First occurrence wins. */
function dedupeByNorad(objects: SatelliteObject[]) {
  const seen = new Set<number>();
  return objects.filter((o) => {
    if (seen.has(o.noradId)) return false;
    seen.add(o.noradId);
    return true;
  });
}

export async function GET() {
  // ── Primary fetch ──────────────────────────────────────────────────────────
  const primaryText = await fetchTle(PRIMARY_URL, PRIMARY_TIMEOUT_MS);

  if (primaryText) {
    const objects = parseGpResponse(primaryText);
    if (objects.length > 0) {
      console.log(`[satellites] primary fetch OK — ${objects.length} satellites`);
      const body: SatelliteResponse = {
        count: objects.length,
        revalidatedAt: new Date().toISOString(),
        objects,
      };
      return NextResponse.json(body);
    }
    console.error("[satellites] primary fetch returned text but parser produced 0 objects");
  }

  // ── Fallback: fetch all smaller groups in parallel ─────────────────────────
  console.warn("[satellites] primary fetch failed — trying fallback groups");
  const groupUrls = FALLBACK_GROUPS.map(
    (g) => `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g}&FORMAT=tle`
  );
  const results = await Promise.allSettled(
    groupUrls.map((url) => fetchTle(url, FALLBACK_TIMEOUT_MS))
  );

  const combined: SatelliteObject[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) {
      const parsed = parseGpResponse(r.value);
      combined.push(...parsed);
      console.log(`[satellites] fallback group=${FALLBACK_GROUPS[i]} — ${parsed.length} sats`);
    }
  });

  const objects = dedupeByNorad(combined);

  if (objects.length === 0) {
    console.error("[satellites] all fetches failed — returning 503");
    return NextResponse.json({ error: "CelesTrak unavailable" }, { status: 503 });
  }

  console.log(`[satellites] fallback OK — ${objects.length} satellites total`);
  const body: SatelliteResponse = {
    count: objects.length,
    revalidatedAt: new Date().toISOString(),
    objects,
  };
  return NextResponse.json(body);
}
