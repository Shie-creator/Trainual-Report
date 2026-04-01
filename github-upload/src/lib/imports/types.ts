export const completionCanonicalFields = [
  "employee_name",
  "employee_email",
  "employee_external_id",
  "job_title",
  "completion_percentage",
  "completed_modules",
  "total_modules",
  "remaining_modules",
  "snapshot_date",
  "manager_name",
  "department",
] as const;

export const managerCanonicalFields = [
  "employee_name",
  "employee_email",
  "employee_external_id",
  "manager_name",
  "manager_email",
  "department",
  "role",
  "status",
] as const;

export type CompletionCanonicalField = (typeof completionCanonicalFields)[number];
export type ManagerCanonicalField = (typeof managerCanonicalFields)[number];
export type ImportType = "completion" | "manager_mapping";

export type FieldMapping<T extends string> = Partial<Record<T, string>>;

export type ParsedFlatFile = {
  headers: string[];
  rows: Record<string, string>[];
  issues: string[];
  inferredSnapshotDate?: string | null;
};

export type ImportPreview = {
  type: ImportType;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  issues: string[];
  previewRows: Record<string, string>[];
};

export type NormalizedCompletionRow = {
  employeeName: string;
  employeeEmail: string | null;
  employeeExternalId: string | null;
  jobTitle: string | null;
  completionPercentage: number;
  completedModules: number | null;
  totalModules: number | null;
  remainingModules: number | null;
  snapshotDate: string | null;
  managerName: string | null;
  department: string | null;
};

export type NormalizedManagerRow = {
  employeeName: string;
  employeeEmail: string | null;
  employeeExternalId: string | null;
  managerName: string;
  managerEmail: string | null;
  department: string | null;
  role: string | null;
  status: string | null;
};
