// app/satellites/page.tsx
import { SatelliteTopBar } from "@/components/satellites/SatelliteTopBar";
import { SatelliteDashboardClientWrapper } from "@/components/satellites/SatelliteDashboardClientWrapper";
import type { SatelliteResponse } from "@/lib/celestrak/types";

export const revalidate = 3600;

async function getData(): Promise<SatelliteResponse> {
  const { GET } = await import("@/app/api/satellites/route");
  const response = await GET();
  if (!response.ok) throw new Error("Failed to fetch satellites");
  return response.json();
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
