import { TopBar } from "@/components/layout/TopBar";
import { DashboardClientWrapper } from "@/components/layout/DashboardClientWrapper";
import type { CloseApproachesResponse } from "@/lib/nasa/types";

// ISR: revalidate every 12 hours
export const revalidate = 43200;

async function getData(): Promise<CloseApproachesResponse> {
  // IMPORTANT: Do NOT use VERCEL_URL here — it is deployment-scoped and changes every deploy,
  // which would cause ISR fetches to hit a stale deployment's API.
  // Instead, import the route handler directly to avoid the HTTP round-trip entirely.
  // This is the recommended App Router pattern for server→server calls within the same project.
  const { GET } = await import("@/app/api/close-approaches/route");
  const response = await GET();
  if (!response.ok) throw new Error("Failed to fetch close approaches");
  return response.json();
}

export default async function HomePage() {
  const data = await getData();

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar objects={data.objects} revalidatedAt={data.revalidatedAt} />
      <DashboardClientWrapper initialObjects={data.objects} />
    </div>
  );
}
