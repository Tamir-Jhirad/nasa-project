// app/satellites/page.tsx
import { SatelliteTopBar } from "@/components/satellites/SatelliteTopBar";
import { SatelliteDashboardClientWrapper } from "@/components/satellites/SatelliteDashboardClientWrapper";
import type { SatelliteResponse } from "@/lib/celestrak/types";

export const revalidate = 3600;

const EMPTY_RESPONSE: SatelliteResponse = {
  count: 0,
  revalidatedAt: new Date().toISOString(),
  objects: [],
};

async function getData(): Promise<SatelliteResponse> {
  try {
    const { GET } = await import("@/app/api/satellites/route");
    const response = await GET();
    if (!response.ok) {
      console.error("[satellites] API route returned", response.status, "— using empty fallback");
      return EMPTY_RESPONSE;
    }
    return response.json();
  } catch (err) {
    console.error("[satellites] getData failed — using empty fallback:", err);
    return EMPTY_RESPONSE;
  }
}

export default async function SatellitesPage() {
  const data = await getData();

  return (
    <div className="min-h-screen flex flex-col">
      <SatelliteTopBar objects={data.objects} revalidatedAt={data.revalidatedAt} />
      <SatelliteDashboardClientWrapper initialObjects={data.objects} />
    </div>
  );
}
