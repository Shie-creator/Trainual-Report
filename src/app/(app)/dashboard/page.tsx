import { DashboardClient } from "@/components/dashboard/dashboard-client";
import {
  getDashboardDataset,
  getDepartmentOptions,
  getManagerOptions,
  getSnapshotDateOptions,
} from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dataset = await getDashboardDataset();

  return (
    <DashboardClient
      records={dataset.employees}
      managerOptions={getManagerOptions(dataset.employees)}
      departmentOptions={getDepartmentOptions(dataset.employees)}
      snapshotOptions={getSnapshotDateOptions(dataset.employees)}
      managerScopedId={undefined}
    />
  );
}
