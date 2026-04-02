"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";

import { DashboardUploadPanel } from "@/components/dashboard/dashboard-upload-panel";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_COLORS, STATUS_ORDER } from "@/lib/constants";
import type { DashboardDataset, DashboardEmployeeRecord } from "@/lib/dashboard";
import { downloadTextFile, formatPercent } from "@/lib/utils";

type DashboardFilters = {
  manager: string;
  title: string;
  status: string;
  snapshotDate: string;
  completionBand: string;
  workLocation: string;
  search: string;
};

function getBand(percentage: number) {
  if (percentage === 100) return "Complete";
  if (percentage >= 80) return "Nearly Complete";
  return "Needs Attention";
}

function toCsv(records: DashboardEmployeeRecord[]) {
  const headers = [
    "Employee",
    "Email",
    "Manager",
    "Title",
    "Work Location",
    "Completion %",
    "Status",
    "Last Active",
  ];

  const lines = records.map((record) =>
    [
      record.employeeName,
      record.employeeEmail ?? "",
      record.managerName,
      record.jobTitle ?? "",
      record.workLocation ?? "",
      record.completionPercentage,
      record.status,
      record.lastActive ?? "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export function DashboardClient({
  dataset,
  managerScopedId,
}: {
  dataset: DashboardDataset;
  managerScopedId?: string;
}) {
  const records = dataset.employees;
  const [filters, setFilters] = useState<DashboardFilters>({
    manager: managerScopedId ?? "",
    title: "",
    status: "",
    snapshotDate: "",
    completionBand: "",
    workLocation: "",
    search: "",
  });

  const latestRecords = useMemo(() => {
    if (filters.snapshotDate) {
      return records.filter((record) => record.snapshotDate === filters.snapshotDate);
    }

    const latestByEmployee = new Map<string, DashboardEmployeeRecord>();
    records.forEach((record) => {
      const current = latestByEmployee.get(record.employeeId);
      if (!current || (record.snapshotDate ?? "") > (current.snapshotDate ?? "")) {
        latestByEmployee.set(record.employeeId, record);
      }
    });
    return Array.from(latestByEmployee.values());
  }, [filters.snapshotDate, records]);

  const filtered = useMemo(() => {
    const query = filters.search.toLowerCase().trim();
    return latestRecords.filter((record) => {
      if (filters.manager && (record.managerId ?? record.managerName) !== filters.manager) return false;
      if (filters.title && record.jobTitle !== filters.title) return false;
      if (filters.status && record.status !== filters.status) return false;
      if (filters.completionBand && getBand(record.completionPercentage) !== filters.completionBand) return false;
      if (filters.workLocation && record.workLocation !== filters.workLocation) return false;
      if (
        query &&
        ![
          record.employeeName,
          record.employeeEmail ?? "",
          record.jobTitle ?? "",
          record.managerName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [filters, latestRecords]);

  const managers = useMemo(
    () =>
      Array.from(
        new Map(records.map((record) => [record.managerId ?? record.managerName, record.managerName])).entries(),
      )
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [records],
  );

  const titles = useMemo(
    () =>
      Array.from(
        new Set(records.map((record) => record.jobTitle).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b)),
    [records],
  );

  const snapshots = useMemo(
    () =>
      Array.from(
        new Set(records.map((record) => record.snapshotDate).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => (a > b ? -1 : 1)),
    [records],
  );

  const metrics = useMemo(() => {
    const total = filtered.length;
    const average = total ? filtered.reduce((sum, row) => sum + row.completionPercentage, 0) / total : 0;
    const complete = filtered.filter((row) => row.status === "Complete").length;
    const nearly = filtered.filter((row) => row.status === "Nearly Complete").length;
    const attention = filtered.filter((row) => row.status === "Needs Attention").length;
    const onshore = filtered.filter((row) => row.workLocation === "Onshore");
    const offshore = filtered.filter((row) => row.workLocation === "Offshore");

    const byManager = Array.from(
      filtered.reduce((map, row) => {
        const current = map.get(row.managerName) ?? {
          managerId: row.managerId ?? row.managerName,
          managerName: row.managerName,
          total: 0,
          count: 0,
          complete: 0,
          nearly: 0,
          attention: 0,
        };
        current.total += row.completionPercentage;
        current.count += 1;
        if (row.status === "Complete") current.complete += 1;
        if (row.status === "Nearly Complete") current.nearly += 1;
        if (row.status === "Needs Attention") current.attention += 1;
        map.set(row.managerName, current);
        return map;
      }, new Map<string, {
        managerId: string;
        managerName: string;
        total: number;
        count: number;
        complete: number;
        nearly: number;
        attention: number;
      }>()),
    )
      .map(([, row]) => ({
        ...row,
        average: row.count ? row.total / row.count : 0,
      }))
      .sort((a, b) => b.average - a.average);

    return {
      total,
      managers: new Set(filtered.map((row) => row.managerName)).size,
      average,
      complete,
      nearly,
      attention,
      onshoreAverage: onshore.length
        ? onshore.reduce((sum, row) => sum + row.completionPercentage, 0) / onshore.length
        : 0,
      offshoreAverage: offshore.length
        ? offshore.reduce((sum, row) => sum + row.completionPercentage, 0) / offshore.length
        : 0,
      onshoreCount: onshore.length,
      offshoreCount: offshore.length,
      byManager,
    };
  }, [filtered]);

  const rows = [...filtered].sort((a, b) => a.completionPercentage - b.completionPercentage);

  if (!records.length) {
    return (
      <EmptyState
        title="No data loaded yet"
        description="Upload the Offshore roster, Onshore roster, and Trainual completion file to populate the public dashboard."
      />
    );
  }

  const lastImportLabel = dataset.latestImportAt
    ? new Date(dataset.latestImportAt).toLocaleString()
    : "No uploads yet";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Card className="rounded-[32px] bg-white">
          <div className="space-y-5">
            <div className="inline-flex rounded-full bg-[var(--surface-muted)] px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-navy)]">
              Leadership View
            </div>
            <div className="space-y-3">
              <h2 className="max-w-3xl font-serif text-6xl leading-none text-[var(--brand-navy)]">
                Trainual Completion Dashboard
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
                Which managers have the healthiest team completion rates, which employees
                need follow-up now, and how onshore versus offshore progress compares.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="rounded-full border px-4 py-2 text-[var(--muted-foreground)]">
                Last update: {lastImportLabel}
              </div>
              <div className="rounded-full border px-4 py-2 text-[var(--muted-foreground)]">
                Source: Onshore + Offshore roster mapping and Trainual completion
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          <MiniMetric label="Total Employees" value={String(metrics.total)} />
          <MiniMetric label="Managers" value={String(metrics.managers)} />
          <MiniMetric label="Complete" value={String(metrics.complete)} />
          <MiniMetric label="Needs Attention" value={String(metrics.attention)} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard
          label="Overall Completion Rate"
          value={formatPercent(metrics.average)}
          helper="Weighted across all filtered employees."
        />
        <MetricCard label="Complete" value={String(metrics.complete)} helper="Employees fully done." />
        <MetricCard label="Nearly Complete" value={String(metrics.nearly)} helper="Employees between 80% and 99%." />
        <MetricCard label="Needs Attention" value={String(metrics.attention)} helper="Employees below 80%." />
        <MetricCard
          label="Onshore vs Offshore"
          value={`${formatPercent(metrics.onshoreAverage)} / ${formatPercent(metrics.offshoreAverage)}`}
          helper={`${metrics.onshoreCount} onshore • ${metrics.offshoreCount} offshore`}
        />
      </section>

      <Card className="rounded-[30px]">
        <div className="grid gap-4 lg:grid-cols-4">
          <FilterSelect
            label="Manager"
            value={filters.manager}
            options={managers}
            onChange={(value) => setFilters((current) => ({ ...current, manager: value }))}
          />
          <FilterSelect
            label="Title"
            value={filters.title}
            options={titles.map((value) => ({ value, label: value }))}
            onChange={(value) => setFilters((current) => ({ ...current, title: value }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            options={STATUS_ORDER.map((value) => ({ value, label: value }))}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
          />
          <FilterSelect
            label="Completion Band"
            value={filters.completionBand}
            options={["Complete", "Nearly Complete", "Needs Attention"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) => setFilters((current) => ({ ...current, completionBand: value }))}
          />
          <FilterSelect
            label="Work Location"
            value={filters.workLocation}
            options={["Onshore", "Offshore"].map((value) => ({ value, label: value }))}
            onChange={(value) => setFilters((current) => ({ ...current, workLocation: value }))}
          />
          <FilterSelect
            label="Data History"
            value={filters.snapshotDate}
            options={snapshots.map((value) => ({ value, label: value === snapshots[0] ? "Latest Upload" : value }))}
            onChange={(value) => setFilters((current) => ({ ...current, snapshotDate: value }))}
          />
          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-medium text-[var(--brand-navy)]">
              Search Employee
            </span>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                className="w-full bg-transparent outline-none"
                placeholder="Name, email, or title"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              />
            </div>
          </label>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-[30px]">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                Manager Summary
              </p>
              <h3 className="mt-2 font-serif text-4xl text-[var(--brand-navy)]">
                Completion Rate by Manager
              </h3>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">Ranked highest to lowest</p>
          </div>
          <div className="space-y-4">
            {metrics.byManager.slice(0, 8).map((item) => (
              <button
                key={item.managerId}
                className="grid w-full grid-cols-[160px_1fr_56px] items-center gap-4 text-left"
                onClick={() => setFilters((current) => ({ ...current, manager: item.managerId }))}
                type="button"
              >
                <span className="font-semibold text-[var(--brand-navy)]">{item.managerName}</span>
                <span className="h-5 rounded-full bg-[var(--surface-muted)]">
                  <span
                    className="block h-5 rounded-full bg-[#93ccc4]"
                    style={{ width: `${item.average}%` }}
                  />
                </span>
                <span className="text-right font-semibold text-[var(--brand-navy)]">
                  {formatPercent(item.average)}
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="rounded-[30px]">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Team Mix
            </p>
            <h3 className="mt-2 font-serif text-4xl text-[var(--brand-navy)]">
              Status Distribution by Manager
            </h3>
          </div>
          <div className="space-y-4">
            {metrics.byManager.slice(0, 8).map((item) => {
              const total = item.count || 1;
              return (
                <div key={item.managerId} className="grid grid-cols-[110px_1fr] items-center gap-4">
                  <span className="font-semibold text-[var(--brand-navy)]">{item.managerName}</span>
                  <div className="flex h-5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <span style={{ width: `${(item.complete / total) * 100}%`, backgroundColor: STATUS_COLORS.Complete }} />
                    <span style={{ width: `${(item.nearly / total) * 100}%`, backgroundColor: STATUS_COLORS["Nearly Complete"] }} />
                    <span style={{ width: `${(item.attention / total) * 100}%`, backgroundColor: STATUS_COLORS["Needs Attention"] }} />
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-4 pt-3 text-sm">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="flex items-center gap-2 text-[var(--muted-foreground)]">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                  {status}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </section>

      <Card className="rounded-[30px]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Employee Drilldown
            </p>
            <h3 className="mt-2 font-serif text-4xl text-[var(--brand-navy)]">
              Completion by Employee
            </h3>
          </div>
          <Button variant="ghost" onClick={() => downloadTextFile("trainual-dashboard.csv", toCsv(rows))}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left">
            <thead className="border-b text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Manager</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Work Type</th>
                <th className="px-4 py-3">Completion %</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 16).map((record) => (
                <tr key={record.completionId} className="border-b last:border-b-0">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold text-[var(--brand-navy)]">{record.employeeName}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">{record.employeeEmail ?? "No email"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {record.managerId ? (
                      <Link className="font-semibold text-[var(--brand-navy)]" href={`/manager/${record.managerId}`}>
                        {record.managerName}
                      </Link>
                    ) : (
                      record.managerName
                    )}
                  </td>
                  <td className="px-4 py-4 font-medium text-[var(--brand-navy)]">{record.jobTitle ?? "—"}</td>
                  <td className="px-4 py-4 text-[var(--muted-foreground)]">{record.workLocation ?? "Unmapped"}</td>
                  <td className="px-4 py-4">
                    <span className="inline-flex min-w-24 justify-center rounded-full bg-[var(--surface-muted)] px-4 py-2 font-semibold text-[var(--brand-navy)]">
                      {formatPercent(record.completionPercentage)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-4 font-medium text-[var(--brand-navy)]">{record.lastActive ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <DashboardUploadPanel />
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[28px]">
      <div className="inline-flex rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-navy)]">
        {label}
      </div>
      <p className="mt-6 text-5xl font-bold text-[var(--brand-navy)]">{value}</p>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="rounded-[28px]">
      <div className="inline-flex rounded-full bg-[var(--surface-muted)] px-3 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--brand-navy)]">
        {label}
      </div>
      <p className="mt-6 font-serif text-5xl text-[var(--brand-navy)]">{value}</p>
      <p className="mt-3 text-sm text-[var(--muted-foreground)]">{helper}</p>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--brand-navy)]">{label}</span>
      <select
        className="w-full rounded-2xl border bg-white px-4 py-3 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
