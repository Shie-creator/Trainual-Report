import { ImportWorkbench } from "@/components/imports/import-workbench";
import { requireAdmin } from "@/lib/auth";
import { getDashboardDataset } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminImportsPage() {
  await requireAdmin();
  const dataset = await getDashboardDataset();

  return <ImportWorkbench history={dataset.importHistory} />;
}
