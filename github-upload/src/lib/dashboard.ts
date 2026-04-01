import { format } from "date-fns";

import { getCompletionStatus, STATUS_ORDER, type CompletionStatus } from "@/lib/constants";
import fallbackSeed from "@/data/nao-seed.json";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardEmployeeRecord = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  employeeExternalId: string | null;
  department: string | null;
  managerId: string | null;
  managerName: string;
  managerEmail: string | null;
  completionId: string;
  completionPercentage: number;
  completedModules: number | null;
  totalModules: number | null;
  remainingModules: number | null;
  snapshotDate: string | null;
  status: CompletionStatus;
  active: boolean;
};

export type DashboardDataset = {
  employees: DashboardEmployeeRecord[];
  latestImportAt: string | null;
  importHistory: {
    id: string;
    importType: string;
    sourceName: string;
    status: string;
    rowCount: number;
    importedAt: string;
    notes: string | null;
  }[];
};

type CompletionJoinRow = {
  id: string;
  completion_percentage: number;
  completed_modules: number | null;
  total_modules: number | null;
  remaining_modules: number | null;
  snapshot_date: string | null;
  employee: {
    active: boolean;
    department: string | null;
    employee_email: string | null;
    employee_external_id: string | null;
    employee_name: string;
    id: string;
    manager: {
      id: string;
      manager_email: string | null;
      manager_name: string;
    } | null;
  } | null;
};

export async function getDashboardDataset(): Promise<DashboardDataset> {
  const supabase = await createSupabaseServerClient();

  const [{ data: completionRows, error: completionError }, { data: imports, error: importError }] =
    await Promise.all([
      supabase
        .from("trainual_completions")
        .select(
          `
            id,
            completion_percentage,
            completed_modules,
            total_modules,
            remaining_modules,
            snapshot_date,
            employee:employees!inner(
              id,
              employee_name,
              employee_email,
              employee_external_id,
              department,
              active,
              manager:managers(
                id,
                manager_name,
                manager_email
              )
            )
          `,
        )
        .order("snapshot_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("imports")
        .select("id, import_type, source_name, status, row_count, imported_at, notes")
        .order("imported_at", { ascending: false })
        .limit(10),
    ]);

  if (completionError) {
    throw new Error(completionError.message);
  }

  if (importError) {
    throw new Error(importError.message);
  }

  const employees = ((completionRows ?? []) as CompletionJoinRow[])
    .filter((row) => row.employee)
    .map((row) => ({
      employeeId: row.employee!.id,
      employeeName: row.employee!.employee_name,
      employeeEmail: row.employee!.employee_email,
      employeeExternalId: row.employee!.employee_external_id,
      department: row.employee!.department,
      managerId: row.employee!.manager?.id ?? null,
      managerName: row.employee!.manager?.manager_name ?? "Unassigned",
      managerEmail: row.employee!.manager?.manager_email ?? null,
      completionId: row.id,
      completionPercentage: Number(row.completion_percentage),
      completedModules: row.completed_modules,
      totalModules: row.total_modules,
      remainingModules: row.remaining_modules,
      snapshotDate: row.snapshot_date,
      status: getCompletionStatus(Number(row.completion_percentage)),
      active: row.employee!.active,
    }));

  if (!employees.length) {
    return fallbackSeed as DashboardDataset;
  }

  return {
    employees,
    latestImportAt: imports?.[0]?.imported_at ?? null,
    importHistory:
      imports?.map((item) => ({
        id: item.id,
        importType: item.import_type,
        sourceName: item.source_name,
        status: item.status,
        rowCount: item.row_count,
        importedAt: item.imported_at,
        notes: item.notes,
      })) ?? [],
  };
}

export function getSnapshotDateOptions(records: DashboardEmployeeRecord[]) {
  return Array.from(
    new Set(records.map((record) => record.snapshotDate).filter(Boolean)),
  )
    .sort((a, b) => (a! > b! ? -1 : 1))
    .map((value) => ({
      value: value!,
      label: format(new Date(value!), "MMM d, yyyy"),
    }));
}

export function getDepartmentOptions(records: DashboardEmployeeRecord[]) {
  return Array.from(
    new Set(
      records
        .map((record) => record.department)
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

export function getManagerOptions(records: DashboardEmployeeRecord[]) {
  return Array.from(
    new Map(records.map((record) => [record.managerId ?? record.managerName, record.managerName])).entries(),
  )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getStatusCounts(records: DashboardEmployeeRecord[]) {
  return STATUS_ORDER.map((status) => ({
    status,
    count: records.filter((record) => record.status === status).length,
  }));
}
