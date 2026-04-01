"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FilterX, Search } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { STATUS_COLORS, STATUS_ORDER } from "@/lib/constants";
import type { DashboardEmployeeRecord } from "@/lib/dashboard";
import { downloadTextFile, formatPercent } from "@/lib/utils";

type DashboardFilters = {
  manager: string;
  department: string;
  status: string;
  snapshotDate: string;
  completionBand: string;
  search: string;
};

function getBand(percentage: number) {
  if (percentage === 100) return "100%";
  if (percentage >= 80) return "80-99%";
  return "Below 80%";
}

function toCsv(records: DashboardEmployeeRecord[]) {
  const headers = [
    "Employee name",
    "Manager",
    "Department",
    "Completion %",
    "Status",
    "Remaining modules",
    "Snapshot date",
  ];

  const lines = records.map((record) =>
    [
      record.employeeName,
      record.managerName,
      record.department ?? "",
      record.completionPercentage,
      record.status,
      record.remainingModules ?? "",
      record.snapshotDate ?? "",
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );

  return [headers.join(","), ...lines].join("\n");
}

export function DashboardClient({
  records,
  managerOptions,
  departmentOptions,
  snapshotOptions,
  managerScopedId,
}: {
  records: DashboardEmployeeRecord[];
  managerOptions: { value: string; label: string }[];
  departmentOptions: string[];
  snapshotOptions: { value: string; label: string }[];
  managerScopedId?: string;
}) {
  const [filters, setFilters] = useState<DashboardFilters>({
    manager: managerScopedId ?? "",
    department: "",
    status: "",
    snapshotDate: "",
    completionBand: "",
    search: "",
  });
  const [sortBy, setSortBy] = useState<keyof DashboardEmployeeRecord>("completionPercentage");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const baseRecords = useMemo(() => {
    if (filters.snapshotDate) {
      return records.filter((record) => record.snapshotDate === filters.snapshotDate);
    }

    const latestByEmployee = new Map<string, DashboardEmployeeRecord>();
    records.forEach((record) => {
      const current = latestByEmployee.get(record.employeeId);
      if (!current) {
        latestByEmployee.set(record.employeeId, record);
        return;
      }

      const currentDate = current.snapshotDate ?? "";
      const nextDate = record.snapshotDate ?? "";
      if (nextDate > currentDate) {
        latestByEmployee.set(record.employeeId, record);
      }
    });

    return Array.from(latestByEmployee.values());
  }, [filters.snapshotDate, records]);

  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return baseRecords.filter((record) => {
      if (filters.manager && (record.managerId ?? record.managerName) !== filters.manager) {
        return false;
      }

      if (filters.department && record.department !== filters.department) {
        return false;
      }

      if (filters.status && record.status !== filters.status) {
        return false;
      }

      if (filters.completionBand && getBand(record.completionPercentage) !== filters.completionBand) {
        return false;
      }

      if (
        search &&
        ![
          record.employeeName,
          record.managerName,
          record.department ?? "",
          record.employeeEmail ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      ) {
        return false;
      }

      return true;
    });
  }, [baseRecords, filters]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const completeCount = filtered.filter((item) => item.status === "Complete").length;
    const needsAttentionCount = filtered.filter(
      (item) => item.status === "Needs Attention",
    ).length;
    const overallCompletionRate =
      total === 0
        ? 0
        : filtered.reduce((sum, item) => sum + item.completionPercentage, 0) / total;

    const managerAverages = Array.from(
      filtered.reduce((map, item) => {
        const current = map.get(item.managerName) ?? {
          managerId: item.managerId ?? item.managerName,
          managerName: item.managerName,
          total: 0,
          count: 0,
          complete: 0,
          nearly: 0,
          attention: 0,
        };
        current.total += item.completionPercentage;
        current.count += 1;
        if (item.status === "Complete") current.complete += 1;
        if (item.status === "Nearly Complete") current.nearly += 1;
        if (item.status === "Needs Attention") current.attention += 1;
        map.set(item.managerName, current);
        return map;
      }, new Map<string, {
        managerId: string;
        managerName: string;
        total: number;
        count: number;
        complete: number;
        nearly: number;
        attention: number;
      }>())
        .values(),
    )
      .map((item) => ({
        ...item,
        averageCompletion: item.count ? item.total / item.count : 0,
      }))
      .sort((a, b) => b.averageCompletion - a.averageCompletion);

    const averageCompletionByManager =
      managerAverages.length === 0
        ? 0
        : managerAverages.reduce((sum, item) => sum + item.averageCompletion, 0) /
          managerAverages.length;

    return {
      total,
      completeCount,
      needsAttentionCount,
      overallCompletionRate,
      averageCompletionByManager,
      managerAverages,
    };
  }, [filtered]);

  const sortedRecords = useMemo(() => {
    const next = [...filtered].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }

      const normalizedA = String(aValue ?? "").toLowerCase();
      const normalizedB = String(bValue ?? "").toLowerCase();
      if (normalizedA < normalizedB) return sortDirection === "asc" ? -1 : 1;
      if (normalizedA > normalizedB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return next;
  }, [filtered, sortBy, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / pageSize));
  const pagedRecords = sortedRecords.slice((page - 1) * pageSize, page * pageSize);

  const kpis = [
    {
      label: "Overall completion rate",
      value: formatPercent(metrics.overallCompletionRate),
    },
    {
      label: "Total employees",
      value: String(metrics.total),
    },
    {
      label: "Marked Complete",
      value: String(metrics.completeCount),
    },
    {
      label: "Needs Attention",
      value: String(metrics.needsAttentionCount),
    },
    {
      label: "Average completion by manager",
      value: formatPercent(metrics.averageCompletionByManager),
    },
  ];

  function handleManagerChartClick(state: {
    activePayload?: Array<{ payload?: { managerId?: string } }>;
  }) {
    const managerId = state.activePayload?.[0]?.payload?.managerId;
    if (managerId) {
      updateFilter("manager", managerId);
    }
  }

  function updateFilter<Key extends keyof DashboardFilters>(key: Key, value: DashboardFilters[Key]) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setPage(1);
    setFilters({
      manager: managerScopedId ?? "",
      department: "",
      status: "",
      snapshotDate: "",
      completionBand: "",
      search: "",
    });
  }

  function toggleSort(field: keyof DashboardEmployeeRecord) {
    if (sortBy === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(field);
    setSortDirection(field === "employeeName" ? "asc" : "desc");
  }

  if (!records.length) {
    return (
      <EmptyState
        title="No completion data yet"
        description="An admin can upload the Trainual completion CSV and manager mapping CSV from the Admin Imports page. Once data is imported, the dashboard, charts, filters, and manager drilldowns will populate automatically."
      />
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-5 md:grid-cols-2">
        {kpis.map((card) => (
          <Card key={card.label}>
            <p className="text-sm text-[var(--muted-foreground)]">{card.label}</p>
            <p className="mt-3 font-serif text-4xl font-semibold text-[var(--brand-navy)]">
              {card.value}
            </p>
          </Card>
        ))}
      </section>

      <Card className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Filters</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Filter updates KPI cards, charts, and the employee table in sync.
            </p>
          </div>
          <Button variant="ghost" onClick={resetFilters}>
            <FilterX className="mr-2 h-4 w-4" />
            Clear filters
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label className="mb-2 block text-sm font-medium">Search</label>
            <div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-3">
              <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
              <input
                className="w-full bg-transparent outline-none"
                placeholder="Employee, manager, department"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
              />
            </div>
          </div>
          <FilterSelect
            label="Manager"
            value={filters.manager}
            onChange={(value) => updateFilter("manager", value)}
            options={managerOptions}
            disabled={Boolean(managerScopedId)}
          />
          <FilterSelect
            label="Department"
            value={filters.department}
            onChange={(value) => updateFilter("department", value)}
            options={departmentOptions.map((option) => ({ value: option, label: option }))}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) => updateFilter("status", value)}
            options={STATUS_ORDER.map((option) => ({ value: option, label: option }))}
          />
          <FilterSelect
            label="Completion band"
            value={filters.completionBand}
            onChange={(value) => updateFilter("completionBand", value)}
            options={[
              { value: "100%", label: "100%" },
              { value: "80-99%", label: "80% to 99%" },
              { value: "Below 80%", label: "Below 80%" },
            ]}
          />
          <FilterSelect
            label="Snapshot date"
            value={filters.snapshotDate}
            onChange={(value) => updateFilter("snapshotDate", value)}
            options={snapshotOptions}
          />
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="h-[420px]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-semibold">Average by manager</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                Click a bar to filter the rest of the dashboard.
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="88%">
            <BarChart
              data={metrics.managerAverages}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 16, bottom: 8 }}
              onClick={(state) =>
                handleManagerChartClick(
                  state as { activePayload?: Array<{ payload?: { managerId?: string } }> },
                )
              }
            >
              <CartesianGrid horizontal={false} strokeDasharray="4 4" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={formatPercent} />
              <YAxis
                type="category"
                width={130}
                dataKey="managerName"
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? formatPercent(value) : value ?? ""
                }
              />
              <Bar dataKey="averageCompletion" radius={[0, 14, 14, 0]}>
                {metrics.managerAverages.map((entry) => (
                  <Cell
                    key={entry.managerId}
                    fill={
                      filters.manager === entry.managerId
                        ? "var(--brand-navy)"
                        : "var(--brand-seafoam)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="h-[420px]">
          <div className="mb-4">
            <h2 className="font-serif text-2xl font-semibold">Team mix by manager</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Completion bands stay aligned with the filtered view.
            </p>
          </div>
          <ResponsiveContainer width="100%" height="88%">
            <BarChart data={metrics.managerAverages} margin={{ top: 8, right: 12, left: 12, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" />
              <XAxis
                dataKey="managerName"
                angle={-30}
                textAnchor="end"
                height={80}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="complete" stackId="status" fill={STATUS_COLORS.Complete} name="Complete" />
              <Bar
                dataKey="nearly"
                stackId="status"
                fill={STATUS_COLORS["Nearly Complete"]}
                name="Nearly Complete"
              />
              <Bar
                dataKey="attention"
                stackId="status"
                fill={STATUS_COLORS["Needs Attention"]}
                name="Needs Attention"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      <Card className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Employee drilldown</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Search, sort, paginate, and export the filtered results.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              downloadTextFile(
                `trainual-completion-${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(sortedRecords),
              )
            }
          >
            <Download className="mr-2 h-4 w-4" />
            Export filtered CSV
          </Button>
        </div>

        <div className="overflow-x-auto rounded-[24px] border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-[var(--muted-foreground)]">
              <tr>
                <SortableHeader label="Employee name" onClick={() => toggleSort("employeeName")} />
                <SortableHeader label="Manager" onClick={() => toggleSort("managerName")} />
                <SortableHeader label="Department" onClick={() => toggleSort("department")} />
                <SortableHeader label="Completion %" onClick={() => toggleSort("completionPercentage")} />
                <th className="px-4 py-3 font-medium">Status</th>
                <SortableHeader label="Remaining modules" onClick={() => toggleSort("remainingModules")} />
                <SortableHeader label="Snapshot date" onClick={() => toggleSort("snapshotDate")} />
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr key={record.completionId} className="border-t border-[var(--border)]">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold text-[var(--brand-navy)]">{record.employeeName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {record.employeeEmail ?? "No email on file"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {record.managerId ? (
                      <Link
                        className="font-medium text-[var(--brand-navy)] underline-offset-4 hover:underline"
                        href={`/manager/${record.managerId}`}
                      >
                        {record.managerName}
                      </Link>
                    ) : (
                      <span>{record.managerName}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">{record.department ?? "—"}</td>
                  <td className="px-4 py-4 font-semibold">{formatPercent(record.completionPercentage)}</td>
                  <td className="px-4 py-4">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-4">{record.remainingModules ?? "—"}</td>
                  <td className="px-4 py-4">{record.snapshotDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!pagedRecords.length ? (
          <div className="rounded-[24px] border border-dashed px-5 py-12 text-center text-sm text-[var(--muted-foreground)]">
            No rows match the current filters.
          </div>
        ) : null}

        <div className="flex flex-col gap-3 text-sm text-[var(--muted-foreground)] md:flex-row md:items-center md:justify-between">
          <p>
            Showing {pagedRecords.length} of {sortedRecords.length} filtered results
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <span className="px-3">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="ghost"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium">{label}</span>
      <select
        className="w-full rounded-2xl border bg-white px-4 py-3 outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
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

function SortableHeader({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button className="cursor-pointer" type="button" onClick={onClick}>
        {label}
      </button>
    </th>
  );
}
