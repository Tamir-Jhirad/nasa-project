# CelesTrak Fetch Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Satellites Dashboard showing 0 satellites by rewriting the CelesTrak API route to use proper headers, a longer timeout, content-type validation, and a multi-group fallback chain.

**Architecture:** The root causes are four independent bugs in `app/api/satellites/route.ts`: (1) 10-second timeout is too short for the 3–4 MB `GROUP=active` TLE payload, (2) no `User-Agent` or `Accept` headers cause CelesTrak to throttle or serve soft error pages, (3) the `!raw.includes("1 ")` content check passes for HTML error pages (HTML contains `<h1>`, `<link>`, etc.), (4) no `cache: 'no-store'` allows Next.js to cache a 503 response. The fix adds proper headers + a 30-second timeout for the primary fetch, a Content-Type guard that rejects HTML, and a fallback chain that fetches 9 smaller CelesTrak groups in parallel when the `active` group fails or times out.

**Tech Stack:** Next.js 16 App Router, TypeScript, native `fetch` API, Jest/ts-jest for tests

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `app/api/satellites/route.ts` | **Modify** | Add headers, extend timeout, cache:no-store, Content-Type guard, fallback group chain |
| `__tests__/celestrak/gpParser.test.ts` | **Modify** | Add HTML-detection smoke test (isLikelyHtml helper) |

No new files. Two files touched.

---

## Background: Why the current code fails

CelesTrak's `GROUP=active` TLE endpoint returns ~10 000 satellites as plain text (~3–4 MB). The current API route:
- Times out in 10 seconds — too short for a 3-4 MB download under normal internet conditions
- Sends no `User-Agent` header — CelesTrak may serve a rate-limit or error HTML page to unidentified bots
- Checks `!raw.includes("1 ")` — any HTML page passes this check (HTML has `<h1>`, `<br>1`, anchor links, etc.), so an error page produces 0 parsed satellites with no log
- Does not set `cache: 'no-store'` on the inner `fetch()` — Next.js may cache a stale 503 body for the revalidation window

**Fallback strategy:**  When the primary `GROUP=active` fetch fails, the route tries 9 smaller group URLs **in parallel** (each with a 15-second timeout). Each returns 30–7000 satellites. Combined they cover all constellations. Starlink (~7000) is included; if it times out, the other 8 groups still succeed and ~600 satellites are returned — enough for the globe and charts.

---

### Task 1: Fix the primary CelesTrak fetch (headers, timeout, Content-Type guard)

**Files:**
- Modify: `app/api/satellites/route.ts`

**Context for the implementer:**

The file is at `app/api/satellites/route.ts`. Current state:
```typescript
const GP_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle";
const TIMEOUT_MS = 10_000;
...
const res = await fetch(GP_URL, { signal: controller.signal });
...
if (typeof raw !== "string" || !raw.includes("1 ")) {
```

Replace the entire `app/api/satellites/route.ts` with the implementation below. Do NOT change `lib/celestrak/gpParser.ts` or any other file in this task.

- [ ] **Step 1: Replace `app/api/satellites/route.ts` with the full fixed implementation**

```typescript
// app/api/satellites/route.ts
import { NextResponse } from "next/server";
import { parseGpResponse } from "@/lib/celestrak/gpParser";
import type { SatelliteResponse } from "@/lib/celestrak/types";

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
export const revalidate = 3600; // 1 hour

/** Returns true when the string looks like an HTML document (error page). */
function isLikelyHtml(text: string): boolean {
  const head = text.trimStart().substring(0, 100).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html") || head.startsWith("<head");
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
function dedupeByNorad(objects: import("@/lib/celestrak/types").SatelliteObject[]) {
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

  const combined: import("@/lib/celestrak/types").SatelliteObject[] = [];
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
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
npm test
```

Expected: 89 tests pass (or more if any were added).

- [ ] **Step 4: Commit**

```bash
git add app/api/satellites/route.ts
git commit -m "fix(satellites): add User-Agent, 30s timeout, content-type guard, fallback group chain"
```

---

### Task 2: Add HTML-detection unit test to the parser test suite

**Files:**
- Modify: `__tests__/celestrak/gpParser.test.ts`

**Context for the implementer:**

The `isLikelyHtml` helper is an unexported internal function inside `app/api/satellites/route.ts` — we cannot import it in a test. Instead, add a test in `__tests__/celestrak/gpParser.test.ts` that verifies `parseGpResponse()` returns an empty array when fed HTML, ensuring the parser doesn't silently produce garbage from error pages.

The test file already imports `parseGpResponse` from `@/lib/celestrak/gpParser`. Just add a new `describe` block at the end.

- [ ] **Step 1: Open `__tests__/celestrak/gpParser.test.ts` and add the HTML-input test block**

Add the following block at the very end of the file (after all existing `it`/`describe` blocks):

```typescript
describe("parseGpResponse — HTML error page input", () => {
  it("returns empty array for a CelesTrak HTML error page", () => {
    // CelesTrak sometimes returns HTML for rate-limited/blocked requests.
    // This ensures the parser doesn't produce satellite objects from HTML content.
    const htmlErrorPage = `<!DOCTYPE html>
<html lang="en">
<head><title>CelesTrak Error</title></head>
<body>
  <h1>Service Temporarily Unavailable</h1>
  <p>Please try again later. Reference: 1 2 3.</p>
</body>
</html>`;

    const result = parseGpResponse(htmlErrorPage);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for an empty string", () => {
    expect(parseGpResponse("")).toHaveLength(0);
  });

  it("returns empty array for a plain text error message", () => {
    // CelesTrak may return plain-text errors too
    const plainError = "Error: Too many requests. Please slow down.";
    expect(parseGpResponse(plainError)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run just the parser tests to verify they pass**

```bash
npx jest __tests__/celestrak/gpParser.test.ts -v
```

Expected: all tests pass (was 7, now 10).

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: 92 tests pass (89 + 3 new).

- [ ] **Step 4: Commit**

```bash
git add __tests__/celestrak/gpParser.test.ts
git commit -m "test(satellites): verify parser returns empty array for HTML error pages"
```

---

## Verification

After both tasks, manually verify the fix works:

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000/satellites`
3. **Expected**: Satellites load within 30 seconds. KPI cards show non-zero counts. Dots appear on the globe.
4. **If still empty**: Check server logs for `[satellites]` prefixed lines. The new logging will tell you exactly what status/content-type CelesTrak returned and which fallback groups succeeded or failed.

The server logs will now show one of:
- `[satellites] primary fetch OK — 9842 satellites` ← everything works
- `[satellites] primary fetch timed out ... [satellites] fallback group=stations — 48 sats ...` ← fallback kicked in, still works
- `[satellites] all fetches failed — returning 503` ← CelesTrak is fully down (rare)
