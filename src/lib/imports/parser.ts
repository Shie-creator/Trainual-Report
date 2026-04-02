import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
  completionCanonicalFields,
  managerCanonicalFields,
  type CompletionCanonicalField,
  type FieldMapping,
  type ImportType,
  type ManagerCanonicalField,
  type ParsedFlatFile,
} from "@/lib/imports/types";
import { parsePercent } from "@/lib/utils";

type RawCsvRow = Record<string, string>;

function cleanHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseCsvRows(rawText: string) {
  const parsed = Papa.parse(rawText, {
    skipEmptyLines: false,
  });

  return parsed.data as string[][];
}

function parseCsvObjects(rawText: string) {
  const parsed = Papa.parse(rawText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim(),
  });

  return {
    headers: parsed.meta.fields ?? [],
    rows: (parsed.data as RawCsvRow[]).filter((row: RawCsvRow) =>
      Object.values(row).some((value) => String(value ?? "").trim() !== ""),
    ),
  };
}

function inferSnapshotDateFromFilename(filename: string) {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function extractDepartmentFromGroups(groups: string | undefined) {
  if (!groups) {
    return null;
  }

  const values = groups
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const department = values.find((value) => /department$/i.test(value));
  return department ?? null;
}

export function parseCompletionFile(rawText: string, filename: string): ParsedFlatFile {
  const parsed = parseCsvObjects(rawText);
  const issues: string[] = [];

  if (!parsed.headers.length) {
    issues.push("The completion file does not include a header row.");
  }

  return {
    headers: parsed.headers,
    rows: parsed.rows.map((row: RawCsvRow) => ({
      ...row,
      "__derived_department": extractDepartmentFromGroups(row.Groups) ?? "",
    })),
    issues,
    inferredSnapshotDate: inferSnapshotDateFromFilename(filename),
  };
}

export function parseManagerMappingFile(rawText: string): ParsedFlatFile {
  const rows = parseCsvRows(rawText);
  const issues: string[] = [];
  const headers = [
    "Employee Name",
    "Role",
    "Status",
    "Employment Length",
    "Hourly Pay",
    "Pay Type",
    "Employee EIN",
    "Manager Name",
  ];

  let currentManager = "";
  const flattenedRows: Record<string, string>[] = [];
  let started = false;

  for (const row of rows) {
    const [first = "", second = "", third = "", , fifth = "", sixth = "", seventh = "", eighth = "", ninth = ""] =
      row.map((cell: string) => String(cell ?? "").trim());

    if (!started && second === "Employee Name") {
      started = true;
      continue;
    }

    if (!started) {
      continue;
    }

    if (first === "Manager") {
      currentManager = second || "Unassigned";
      continue;
    }

    if (first === "Subtotal" || (first === "" && second === "")) {
      continue;
    }

    if (!second) {
      continue;
    }

    flattenedRows.push({
      "Employee Name": second,
      Role: third,
      Status: fifth,
      "Employment Length": sixth,
      "Hourly Pay": seventh,
      "Pay Type": eighth,
      "Employee EIN": ninth,
      "Manager Name": currentManager,
    });
  }

  if (!flattenedRows.length) {
    issues.push("No employee rows were found in the manager mapping file.");
  }

  return {
    headers,
    rows: flattenedRows,
    issues,
  };
}

export function parseManagerWorkbook(buffer: ArrayBuffer): ParsedFlatFile {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, {
    defval: "",
  });

  const headers = Object.keys(rows[0] ?? {});
  const issues: string[] = [];

  if (!rows.length) {
    issues.push("No employee rows were found in the manager workbook.");
  }

  return {
    headers,
    rows: rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? "").trim()]),
      ),
    ),
    issues,
  };
}

const completionSynonyms: Record<CompletionCanonicalField, string[]> = {
  employee_name: ["name", "employee name"],
  employee_email: ["email", "work email"],
  employee_external_id: ["employee id", "employee external id", "employee number"],
  job_title: ["job title", "role"],
  completion_percentage: ["completion score", "completion percentage", "completion"],
  completed_modules: ["completed modules"],
  total_modules: ["total modules"],
  remaining_modules: ["remaining modules"],
  snapshot_date: ["snapshot date", "report date", "date"],
  manager_name: ["reports to", "manager", "manager name"],
  department: ["department", "__derived_department"],
};

const managerSynonyms: Record<ManagerCanonicalField, string[]> = {
  employee_name: ["employee name", "name"],
  employee_email: ["employee email", "email"],
  employee_external_id: ["employee id", "employee external id", "employee ein"],
  manager_name: ["manager name", "manager"],
  manager_email: ["manager email"],
  department: ["department"],
  role: ["role", "job title", "jobs title", "jobs  title"],
  status: ["status"],
  work_location: ["work location"],
};

export function suggestMapping<T extends string>(
  headers: string[],
  synonyms: Record<T, string[]>,
): Record<string, string> {
  const normalizedHeaders = new Map(headers.map((header) => [cleanHeader(header), header]));
  const mapping: Record<string, string> = {};

  (Object.entries(synonyms) as Array<[T, string[]]>).forEach(([field, values]) => {
    const matched = values.find((value) => normalizedHeaders.has(cleanHeader(value)));
    if (matched) {
      mapping[field] = normalizedHeaders.get(cleanHeader(matched))!;
    }
  });

  return mapping;
}

export function getDefaultCompletionMapping(headers: string[]) {
  return suggestMapping(headers, completionSynonyms);
}

export function getDefaultManagerMapping(headers: string[]) {
  return suggestMapping(headers, managerSynonyms);
}

export function getDuplicateKeys(
  rows: Record<string, string>[],
  keys: string[],
) {
  const filteredKeys = keys.filter(Boolean);
  const seen = new Map<string, number>();
  const duplicates: string[] = [];

  rows.forEach((row) => {
    const joined = filteredKeys
      .map((key) => row[key]?.trim().toLowerCase())
      .filter(Boolean)
      .join("|");
    if (!joined) {
      return;
    }

    const count = (seen.get(joined) ?? 0) + 1;
    seen.set(joined, count);
    if (count === 2) {
      duplicates.push(joined);
    }
  });

  return duplicates;
}

export function validateCompletionMapping(
  rows: Record<string, string>[],
  mapping: FieldMapping<CompletionCanonicalField>,
) {
  const issues: string[] = [];
  const requiredFields: CompletionCanonicalField[] = [
    "employee_name",
    "completion_percentage",
  ];

  requiredFields.forEach((field) => {
    if (!mapping[field]) {
      issues.push(`Completion mapping requires a column for ${field}.`);
    }
  });

  const completionHeader = mapping.completion_percentage;
  if (completionHeader) {
    const invalid = rows.find((row) => parsePercent(row[completionHeader]) === null);
    if (invalid) {
      issues.push("Completion percentage contains at least one unreadable value.");
    }
  }

  return issues;
}

export function validateManagerMapping(
  mapping: FieldMapping<ManagerCanonicalField>,
) {
  const issues: string[] = [];
  const requiredFields: ManagerCanonicalField[] = ["employee_name", "manager_name"];

  requiredFields.forEach((field) => {
    if (!mapping[field]) {
      issues.push(`Manager mapping requires a column for ${field}.`);
    }
  });

  return issues;
}

export function listCanonicalLabels(type: ImportType) {
  return type === "completion" ? completionCanonicalFields : managerCanonicalFields;
}
