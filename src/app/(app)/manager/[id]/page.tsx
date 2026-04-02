import { notFound } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { Card } from "@/components/ui/card";
import { getDashboardDataset } from "@/lib/dashboard";
import { formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ManagerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dataset = await getDashboardDataset();
  const managerRecords = dataset.employees.filter((employee) => employee.managerId === id);

  if (!managerRecords.length) {
    notFound();
  }

  const average =
    managerRecords.reduce((sum, record) => sum + record.completionPercentage, 0) /
    managerRecords.length;
  const completeCount = managerRecords.filter((record) => record.status === "Complete").length;
  const nearlyCount = managerRecords.filter(
    (record) => record.status === "Nearly Complete",
  ).length;
  const attentionCount = managerRecords.filter(
    (record) => record.status === "Needs Attention",
  ).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Manager</p>
          <p className="mt-3 font-serif text-3xl font-semibold text-[var(--brand-navy)]">
            {managerRecords[0].managerName}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Team average</p>
          <p className="mt-3 font-serif text-3xl font-semibold text-[var(--brand-navy)]">
            {formatPercent(average)}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Team size</p>
          <p className="mt-3 font-serif text-3xl font-semibold text-[var(--brand-navy)]">
            {managerRecords.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-[var(--muted-foreground)]">Status mix</p>
          <p className="mt-3 text-sm leading-7 text-[var(--brand-navy)]">
            Complete {completeCount} • Nearly Complete {nearlyCount} • Needs Attention{" "}
            {attentionCount}
          </p>
        </Card>
      </section>

      <DashboardClient
        dataset={dataset}
        managerScopedId={id}
      />
    </div>
  );
}
