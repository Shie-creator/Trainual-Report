import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getDashboardDataset } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dataset = await getDashboardDataset();

  return (
    <DashboardClient
      dataset={dataset}
      managerScopedId={undefined}
    />
  );
}
