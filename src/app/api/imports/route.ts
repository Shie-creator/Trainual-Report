import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { normalizeCompletionRows, normalizeManagerRows } from "@/lib/imports/normalize";
import {
  parseCompletionFile,
  parseManagerMappingFile,
  validateCompletionMapping,
  validateManagerMapping,
} from "@/lib/imports/parser";
import type {
  CompletionCanonicalField,
  FieldMapping,
  ManagerCanonicalField,
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
    .select("id, employee_name, employee_email, employee_external_id, manager_id, department");

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
    };

    current.employeeName = current.employeeName || row.employeeName;
    current.employeeEmail = current.employeeEmail || row.employeeEmail;
    current.employeeExternalId =
      current.employeeExternalId ||
      ("employeeExternalId" in row ? row.employeeExternalId : null);
    current.department = current.department || row.department;
    current.managerName = current.managerName || row.managerName;
    current.active = "status" in row ? !/terminated/i.test(row.status ?? "") : true;
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
  }> = [];
  const inserts: Array<{
    employee_name: string;
    employee_email: string | null;
    employee_external_id: string | null;
    department: string | null;
    manager_id: string | null;
    active: boolean;
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

    if (existing) {
      updates.push({
        ...existing,
        employee_name: row.employeeName,
        employee_email: row.employeeEmail,
        employee_external_id: row.employeeExternalId,
        department: row.department,
        manager_id: manager?.id ?? null,
        active: row.active,
      });
      return;
    }

    inserts.push({
      employee_name: row.employeeName,
      employee_email: row.employeeEmail,
      employee_external_id: row.employeeExternalId,
      department: row.department,
      manager_id: manager?.id ?? null,
      active: row.active,
    });
  });

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        employee_name: update.employee_name,
        employee_email: update.employee_email,
        employee_external_id: update.employee_external_id,
        department: update.department,
        manager_id: update.manager_id,
        active: update.active,
      })
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
    .select("id, employee_name, employee_email, employee_external_id, manager_id, department");

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

      if (!employee) {
        return null;
      }

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
        value,
      ): value is {
        employee_id: string;
        completion_percentage: number;
        completed_modules: number | null;
        total_modules: number | null;
        remaining_modules: number | null;
        snapshot_date: string | null;
      } => Boolean(value),
    );

  if (!payload.length) {
    return 0;
  }

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
  const { error } = await supabase.storage
    .from("trainual-imports")
    .upload(path, file, {
      contentType: file.type || "text/csv",
      upsert: true,
    });

  if (error) {
    throw new Error(`Unable to store import file ${file.name}: ${error.message}`);
  }

  return path;
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const formData = await request.formData();
    const completionFile = formData.get("completionFile");
    const managerFile = formData.get("managerFile");
    const completionMapping = JSON.parse(
      String(formData.get("completionMapping") ?? "{}"),
    ) as FieldMapping<CompletionCanonicalField>;
    const managerMapping = JSON.parse(
      String(formData.get("managerMapping") ?? "{}"),
    ) as FieldMapping<ManagerCanonicalField>;
    const fallbackSnapshotDate = String(formData.get("completionSnapshotDate") ?? "");

    if (!(completionFile instanceof File) || !(managerFile instanceof File)) {
      return NextResponse.json(
        { message: "Both files are required." },
        { status: 400 },
      );
    }

    const [completionText, managerText] = await Promise.all([
      completionFile.text(),
      managerFile.text(),
    ]);

    const completionParsed = parseCompletionFile(completionText, completionFile.name);
    const managerParsed = parseManagerMappingFile(managerText);

    const completionIssues = validateCompletionMapping(
      completionParsed.rows,
      completionMapping,
    );
    const managerIssues = validateManagerMapping(managerMapping);

    if (completionIssues.length || managerIssues.length) {
      return NextResponse.json(
        {
          message: [...completionIssues, ...managerIssues].join(" "),
        },
        { status: 400 },
      );
    }

    const normalizedCompletions = normalizeCompletionRows(
      completionParsed.rows,
      completionMapping,
      fallbackSnapshotDate || completionParsed.inferredSnapshotDate,
    );
    const normalizedManagers = normalizeManagerRows(managerParsed.rows, managerMapping);

    const [completionStoragePath, managerStoragePath] = await Promise.all([
      uploadOriginalFile(supabase, completionFile, "completion"),
      uploadOriginalFile(supabase, managerFile, "manager-mapping"),
    ]);

    const managerMap = await upsertManagers(supabase, normalizedManagers);
    const employeeMap = await upsertEmployees(
      supabase,
      normalizedManagers,
      normalizedCompletions,
      managerMap,
    );
    const completionCount = await insertCompletions(
      supabase,
      normalizedCompletions,
      employeeMap,
    );

    const importNotes = [
      `Managers processed: ${normalizedManagers.length}.`,
      `Completion rows processed: ${normalizedCompletions.length}.`,
      fallbackSnapshotDate
        ? `Snapshot date fallback: ${fallbackSnapshotDate}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    const { error: importError } = await supabase.from("imports").insert([
      {
        source_name: completionFile.name,
        import_type: "completion",
        row_count: completionCount,
        status: "success",
        notes: importNotes,
        storage_path: completionStoragePath,
      },
      {
        source_name: managerFile.name,
        import_type: "manager_mapping",
        row_count: normalizedManagers.length,
        status: "success",
        notes: importNotes,
        storage_path: managerStoragePath,
      },
    ]);

    if (importError) {
      throw new Error(importError.message);
    }

    revalidatePath("/dashboard");
    revalidatePath("/admin/imports");
    revalidatePath("/manager");

    return NextResponse.json({
      message: `Import complete. Saved ${completionCount} completion snapshots and ${normalizedManagers.length} manager mappings.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unexpected import failure.",
      },
      { status: 500 },
    );
  }
}
