import { ImportWorkbench } from "@/components/imports/import-workbench";
import { getDashboardDataset } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminImportsPage() {
  const dataset = await getDashboardDataset();

  return <ImportWorkbench history={dataset.importHistory} />;
}
