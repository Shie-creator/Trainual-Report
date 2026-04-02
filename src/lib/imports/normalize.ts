import { parseISO } from "date-fns";

import type {
  CompletionCanonicalField,
  FieldMapping,
  ManagerCanonicalField,
  NormalizedCompletionRow,
  NormalizedManagerRow,
} from "@/lib/imports/types";
import { parsePercent } from "@/lib/utils";

function getValue<T extends string>(
  row: Record<string, string>,
  mapping: FieldMapping<T>,
  field: T,
) {
  const source = mapping[field];
  return source ? row[source]?.trim() : "";
}

function parseOptionalNumber(value: string) {
  if (!value) {
    return null;
  }

  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeDate(value: string) {
  if (!value) {
    return null;
  }

  try {
    const parsed = parseISO(value);
    if (!Number.isNaN(parsed.getTime())) {
      return value.slice(0, 10);
    }
  } catch {
    return null;
  }

  const match = value.match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!match) {
    return null;
  }

  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

export function normalizeCompletionRows(
  rows: Record<string, string>[],
  mapping: FieldMapping<CompletionCanonicalField>,
  inferredSnapshotDate?: string | null,
) {
  return rows
    .map<NormalizedCompletionRow | null>((row) => {
      const employeeName = getValue(row, mapping, "employee_name");
      const completionPercentage = parsePercent(
        getValue(row, mapping, "completion_percentage"),
      );

      if (!employeeName || completionPercentage === null) {
        return null;
      }

      return {
        employeeName,
        employeeEmail: getValue(row, mapping, "employee_email") || null,
        employeeExternalId: getValue(row, mapping, "employee_external_id") || null,
        jobTitle: getValue(row, mapping, "job_title") || null,
        completionPercentage,
        completedModules: parseOptionalNumber(getValue(row, mapping, "completed_modules")),
        totalModules: parseOptionalNumber(getValue(row, mapping, "total_modules")),
        remainingModules: parseOptionalNumber(getValue(row, mapping, "remaining_modules")),
        snapshotDate:
          normalizeDate(getValue(row, mapping, "snapshot_date")) ??
          inferredSnapshotDate ??
          null,
        managerName: getValue(row, mapping, "manager_name") || null,
        department: getValue(row, mapping, "department") || null,
        lastActive: getValue(row, mapping, "snapshot_date") || row["Last active"]?.trim() || null,
      };
    })
    .filter((row): row is NormalizedCompletionRow => Boolean(row));
}

export function normalizeManagerRows(
  rows: Record<string, string>[],
  mapping: FieldMapping<ManagerCanonicalField>,
  workLocation: "Onshore" | "Offshore",
) {
  return rows
    .map<NormalizedManagerRow | null>((row) => {
      const employeeName = getValue(row, mapping, "employee_name");
      const managerName = getValue(row, mapping, "manager_name");

      if (!employeeName || !managerName) {
        return null;
      }

      return {
        employeeName,
        employeeEmail: getValue(row, mapping, "employee_email") || null,
        employeeExternalId: getValue(row, mapping, "employee_external_id") || null,
        managerName,
        managerEmail: getValue(row, mapping, "manager_email") || null,
        department: getValue(row, mapping, "department") || null,
        role: getValue(row, mapping, "role") || null,
        status: getValue(row, mapping, "status") || null,
        workLocation,
      };
    })
    .filter((row): row is NormalizedManagerRow => Boolean(row));
}
