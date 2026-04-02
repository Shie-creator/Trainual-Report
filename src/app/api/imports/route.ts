import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { normalizeCompletionRows, normalizeManagerRows } from "@/lib/imports/normalize";
import {
  getDefaultCompletionMapping,
  getDefaultManagerMapping,
  parseCompletionFile,
  parseManagerWorkbook,
  validateCompletionMapping,
  validateManagerMapping,
} from "@/lib/imports/parser";
import { resolveCanonicalManagerName } from "@/lib/name-matching";
import type {
  CompletionCanonicalField,
  FieldMapping,
  NormalizedCompletionRow,
  NormalizedManagerRow,
} from "@/lib/imports/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

type ExistingManager = {
  id: string;
  manager_name: string;
  manager_email: string | null;
  department: string | null;
};

type ExistingEmployee = {
  id: string;
  employee_name: string;
  employee_email: string | null;
  employee_external_id: string | null;
  manager_id: string | null;
  department: string | null;
  work_location: "Onshore" | "Offshore" | null;
  job_title: string | null;
  last_active: string | null;
};

function normalizeKey(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

async function upsertManagers(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: NormalizedManagerRow[],
) {
  const { data: existingManagers } = await supabase
    .from("managers")
    .select("id, manager_name, manager_email, department");

  const managerMap = new Map<string, ExistingManager>();
  (existingManagers ?? []).forEach((manager) => {
    managerMap.set(`name:${normalizeKey(manager.manager_name)}`, manager);
    if (manager.manager_email) {
      managerMap.set(`email:${normalizeKey(manager.manager_email)}`, manager);
    }
  });

  const upsertPayload = Array.from(
    rows.reduce((map, row) => {
      const key = row.managerEmail
        ? `email:${normalizeKey(row.managerEmail)}`
        : `name:${normalizeKey(row.managerName)}`;
      if (!map.has(key)) {
        map.set(key, {
          manager_name: row.managerName,
          manager_email: row.managerEmail,
          department: row.department,
        });
      }
      return map;
    }, new Map<string, { manager_name: string; manager_email: string | null; department: string | null }>())
      .values(),
  );

  if (upsertPayload.length) {
    const { error } = await supabase.from("managers").upsert(upsertPayload, {
      onConflict: "manager_name",
    });
    if (error) {
      throw new Error(`Failed to upsert managers: ${error.message}`);
    }
  }

  const { data: refreshedManagers, error: refreshError } = await supabase
    .from("managers")
    .select("id, manager_name, manager_email, department");

  if (refreshError) {
    throw new Error(refreshError.message);
  }

  return (refreshedManagers ?? []).reduce((map, manager) => {
    map.set(`name:${normalizeKey(manager.manager_name)}`, manager);
    if (manager.manager_email) {
      map.set(`email:${normalizeKey(manager.manager_email)}`, manager);
    }
    return map;
  }, new Map<string, ExistingManager>());
}

async function upsertEmployees(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  managerRows: NormalizedManagerRow[],
  completionRows: NormalizedCompletionRow[],
  managerMap: Map<string, ExistingManager>,
) {
  const { data: existingEmployees, error } = await supabase
    .from("employees")
    .select(
      "id, employee_name, employee_email, employee_external_id, manager_id, department, work_location, job_title, last_active",
    );

  if (error) {
    throw new Error(error.message);
  }

  const employeeMap = new Map<string, ExistingEmployee>();
  (existingEmployees ?? []).forEach((employee) => {
    if (employee.employee_external_id) {
      employeeMap.set(`external:${normalizeKey(employee.employee_external_id)}`, employee);
    }
    if (employee.employee_email) {
      employeeMap.set(`email:${normalizeKey(employee.employee_email)}`, employee);
    }
    employeeMap.set(`name:${normalizeKey(employee.employee_name)}`, employee);
  });

  const mergedRows = new Map<
    string,
    {
      employeeName: string;
      employeeEmail: string | null;
      employeeExternalId: string | null;
      department: string | null;
      managerName: string | null;
      active: boolean;
      workLocation: "Onshore" | "Offshore" | null;
      jobTitle: string | null;
      lastActive: string | null;
    }
  >();

  [...managerRows, ...completionRows].forEach((row) => {
    const key =
      normalizeKey("employeeExternalId" in row ? row.employeeExternalId : null) ||
      normalizeKey(row.employeeEmail) ||
      normalizeKey(row.employeeName);
    if (!key) return;

    const current = mergedRows.get(key) ?? {
      employeeName: row.employeeName,
      employeeEmail: row.employeeEmail,
      employeeExternalId: "employeeExternalId" in row ? row.employeeExternalId : null,
      department: row.department,
      managerName: row.managerName,
      active: true,
      workLocation: "workLocation" in row ? row.workLocation : null,
      jobTitle: "jobTitle" in row ? row.jobTitle : row.role,
      lastActive: "lastActive" in row ? row.lastActive : null,
    };

    current.employeeName = current.employeeName || row.employeeName;
    current.employeeEmail = current.employeeEmail || row.employeeEmail;
    current.employeeExternalId =
      current.employeeExternalId ||
      ("employeeExternalId" in row ? row.employeeExternalId : null);
    current.department = current.department || row.department;
    current.managerName = current.managerName || row.managerName;
    current.active = "status" in row ? !/terminated/i.test(row.status ?? "") : current.active;
    current.workLocation =
      current.workLocation || ("workLocation" in row ? row.workLocation : null);
    current.jobTitle = current.jobTitle || ("jobTitle" in row ? row.jobTitle : row.role);
    current.lastActive = current.lastActive || ("lastActive" in row ? row.lastActive : null);
    mergedRows.set(key, current);
  });

  const updates: Array<{
    id: string;
    employee_name: string;
    employee_email: string | null;
    employee_external_id: string | null;
    department: string | null;
    manager_id: string | null;
    active: boolean;
    work_location: "Onshore" | "Offshore" | null;
    job_title: string | null;
    last_active: string | null;
  }> = [];
  const inserts: Array<{
    employee_name: string;
    employee_email: string | null;
    employee_external_id: string | null;
    department: string | null;
    manager_id: string | null;
    active: boolean;
    work_location: "Onshore" | "Offshore" | null;
    job_title: string | null;
    last_active: string | null;
  }> = [];

  Array.from(mergedRows.values()).forEach((row) => {
    const manager = row.managerName
      ? managerMap.get(`name:${normalizeKey(row.managerName)}`) ?? null
      : null;
    const existing =
      (row.employeeExternalId &&
        employeeMap.get(`external:${normalizeKey(row.employeeExternalId)}`)) ||
      (row.employeeEmail && employeeMap.get(`email:${normalizeKey(row.employeeEmail)}`)) ||
      employeeMap.get(`name:${normalizeKey(row.employeeName)}`);

    const payload = {
      employee_name: row.employeeName,
      employee_email: row.employeeEmail,
      employee_external_id: row.employeeExternalId,
      department: row.department,
      manager_id: manager?.id ?? null,
      active: row.active,
      work_location: row.workLocation,
      job_title: row.jobTitle,
      last_active: row.lastActive,
    };

    if (existing) {
      updates.push({ id: existing.id, ...payload });
      return;
    }

    inserts.push(payload);
  });

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("employees")
      .update(update)
      .eq("id", update.id);
    if (updateError) {
      throw new Error(`Failed to update employee ${update.employee_name}: ${updateError.message}`);
    }
  }

  if (inserts.length) {
    const { error: insertError } = await supabase.from("employees").insert(inserts);
    if (insertError) {
      throw new Error(`Failed to insert employees: ${insertError.message}`);
    }
  }

  const { data: refreshedEmployees, error: refreshError } = await supabase
    .from("employees")
    .select(
      "id, employee_name, employee_email, employee_external_id, manager_id, department, work_location, job_title, last_active",
    );
  if (refreshError) {
    throw new Error(refreshError.message);
  }

  return (refreshedEmployees ?? []).reduce((map, employee) => {
    if (employee.employee_external_id) {
      map.set(`external:${normalizeKey(employee.employee_external_id)}`, employee);
    }
    if (employee.employee_email) {
      map.set(`email:${normalizeKey(employee.employee_email)}`, employee);
    }
    map.set(`name:${normalizeKey(employee.employee_name)}`, employee);
    return map;
  }, new Map<string, ExistingEmployee>());
}

async function insertCompletions(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: NormalizedCompletionRow[],
  employeeMap: Map<string, ExistingEmployee>,
) {
  const payload = rows
    .map((row) => {
      const employee =
        (row.employeeExternalId &&
          employeeMap.get(`external:${normalizeKey(row.employeeExternalId)}`)) ||
        (row.employeeEmail && employeeMap.get(`email:${normalizeKey(row.employeeEmail)}`)) ||
        employeeMap.get(`name:${normalizeKey(row.employeeName)}`);

      if (!employee) return null;

      return {
        employee_id: employee.id,
        completion_percentage: row.completionPercentage,
        completed_modules: row.completedModules,
        total_modules: row.totalModules,
        remaining_modules: row.remainingModules,
        snapshot_date: row.snapshotDate,
      };
    })
    .filter(
      (
        row,
      ): row is {
        employee_id: string;
        completion_percentage: number;
        completed_modules: number | null;
        total_modules: number | null;
        remaining_modules: number | null;
        snapshot_date: string | null;
      } => Boolean(row),
    );

  if (!payload.length) return 0;

  const { error } = await supabase.from("trainual_completions").upsert(payload, {
    onConflict: "employee_id,snapshot_date",
  });
  if (error) {
    throw new Error(`Failed to save completion snapshots: ${error.message}`);
  }
  return payload.length;
}

async function uploadOriginalFile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  file: File,
  folder: string,
) {
  const path = `${folder}/${Date.now()}-${slugify(file.name)}`;
  const { error } = await supabase.storage.from("trainual-imports").upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (error) {
    throw new Error(`Unable to store import file ${file.name}: ${error.message}`);
  }
  return path;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const uploadPassword = String(formData.get("uploadPassword") ?? "");
    const configuredPassword = process.env.UPLOAD_PASSWORD;

    if (!configuredPassword || uploadPassword !== configuredPassword) {
      return NextResponse.json(
        { message: "Upload password is incorrect." },
        { status: 401 },
      );
    }

    const supabase = await createSupabaseServerClient();
    const completionFile = formData.get("completionFile");
    const onshoreFile = formData.get("onshoreManagerFile");
    const offshoreFile = formData.get("offshoreManagerFile");

    if (
      !(completionFile instanceof File) &&
      !(onshoreFile instanceof File) &&
      !(offshoreFile instanceof File)
    ) {
      return NextResponse.json(
        { message: "Upload at least one file to refresh the dashboard." },
        { status: 400 },
      );
    }

    const managerRows: NormalizedManagerRow[] = [];
    const importLogs: Array<{
      source_name: string;
      import_type: "completion" | "manager_mapping";
      row_count: number;
      status: "success";
      notes: string;
      storage_path: string | null;
    }> = [];

    const managerMapping = getDefaultManagerMapping(["Employee Name", "Jobs Title", "Manager Name"]);

    for (const [file, workLocation] of [
      [onshoreFile, "Onshore"],
      [offshoreFile, "Offshore"],
    ] as const) {
      if (!(file instanceof File)) continue;
      const parsed = parseManagerWorkbook(await file.arrayBuffer());
      const issues = validateManagerMapping(managerMapping);
      if (issues.length) {
        return NextResponse.json({ message: issues.join(" ") }, { status: 400 });
      }

      const normalized = normalizeManagerRows(parsed.rows, managerMapping, workLocation);
      managerRows.push(...normalized);
      importLogs.push({
        source_name: file.name,
        import_type: "manager_mapping",
        row_count: normalized.length,
        status: "success",
        notes: `${workLocation} roster import.`,
        storage_path: await uploadOriginalFile(
          supabase,
          file,
          `manager-mapping/${workLocation.toLowerCase()}`,
        ),
      });
    }

    let completionRows: NormalizedCompletionRow[] = [];
    if (completionFile instanceof File) {
      const completionText = await completionFile.text();
      const parsed = parseCompletionFile(completionText, completionFile.name);
      const completionMapping = getDefaultCompletionMapping(parsed.headers);
      const issues = validateCompletionMapping(parsed.rows, completionMapping);
      if (issues.length) {
        return NextResponse.json({ message: issues.join(" ") }, { status: 400 });
      }

      completionRows = normalizeCompletionRows(
        parsed.rows,
        completionMapping as FieldMapping<CompletionCanonicalField>,
        parsed.inferredSnapshotDate,
      );

      importLogs.push({
        source_name: completionFile.name,
        import_type: "completion",
        row_count: completionRows.length,
        status: "success",
        notes: "Trainual completion import.",
        storage_path: await uploadOriginalFile(supabase, completionFile, "completion"),
      });
    }

    const managerMap = await upsertManagers(supabase, managerRows);
    const canonicalManagerNames = Array.from(
      new Set(managerRows.map((row) => row.managerName).filter(Boolean)),
    );
    completionRows = completionRows.map((row) => ({
      ...row,
      managerName: resolveCanonicalManagerName(row.managerName, canonicalManagerNames),
    }));
    const employeeMap = await upsertEmployees(supabase, managerRows, completionRows, managerMap);
    const completionCount = await insertCompletions(supabase, completionRows, employeeMap);

    if (importLogs.length) {
      const { error } = await supabase.from("imports").insert(
        importLogs.map((log) =>
          log.import_type === "completion"
            ? { ...log, row_count: completionCount }
            : log,
        ),
      );
      if (error) {
        throw new Error(error.message);
      }
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/admin/imports");
    revalidatePath("/manager");

    return NextResponse.json({
      message: `Dashboard refreshed. ${managerRows.length} mapped employees processed and ${completionCount} completion rows applied.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Unexpected import failure.",
      },
      { status: 500 },
    );
  }
}
