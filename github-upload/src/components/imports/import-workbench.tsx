"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, FileUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getDefaultCompletionMapping,
  getDefaultManagerMapping,
  getDuplicateKeys,
  listCanonicalLabels,
  parseCompletionFile,
  parseManagerMappingFile,
  validateCompletionMapping,
  validateManagerMapping,
} from "@/lib/imports/parser";
import {
  type CompletionCanonicalField,
  type FieldMapping,
  type ImportType,
  type ManagerCanonicalField,
} from "@/lib/imports/types";

type PreviewState = {
  headers: string[];
  rows: Record<string, string>[];
  issues: string[];
  fileName: string;
  inferredSnapshotDate?: string | null;
};

export function ImportWorkbench({
  history,
}: {
  history: {
    id: string;
    importedAt: string;
    importType: string;
    sourceName: string;
    status: string;
    rowCount: number;
    notes: string | null;
  }[];
}) {
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [managerFile, setManagerFile] = useState<File | null>(null);
  const [completionPreview, setCompletionPreview] = useState<PreviewState | null>(null);
  const [managerPreview, setManagerPreview] = useState<PreviewState | null>(null);
  const [completionMapping, setCompletionMapping] = useState<
    FieldMapping<CompletionCanonicalField>
  >({});
  const [managerMapping, setManagerMapping] = useState<FieldMapping<ManagerCanonicalField>>({});
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const completionIssues = useMemo(() => {
    if (!completionPreview) return [];
    return [
      ...completionPreview.issues,
      ...validateCompletionMapping(completionPreview.rows, completionMapping),
      ...getDuplicateKeys(completionPreview.rows, [
        completionMapping.employee_external_id ?? "",
        completionMapping.employee_name ?? "",
      ]).map((entry) => `Duplicate completion record detected for key: ${entry}`),
    ];
  }, [completionMapping, completionPreview]);

  const managerIssues = useMemo(() => {
    if (!managerPreview) return [];
    return [
      ...managerPreview.issues,
      ...validateManagerMapping(managerMapping),
      ...getDuplicateKeys(managerPreview.rows, [
        managerMapping.employee_external_id ?? "",
        managerMapping.employee_name ?? "",
      ]).map((entry) => `Duplicate manager mapping detected for key: ${entry}`),
    ];
  }, [managerMapping, managerPreview]);

  async function handleFile(
    file: File,
    type: ImportType,
  ) {
    const text = await file.text();
    const parsed =
      type === "completion"
        ? parseCompletionFile(text, file.name)
        : parseManagerMappingFile(text);

    if (type === "completion") {
      setCompletionFile(file);
      setCompletionPreview({
        ...parsed,
        fileName: file.name,
      });
      setCompletionMapping(getDefaultCompletionMapping(parsed.headers));
      return;
    }

    setManagerFile(file);
    setManagerPreview({
      ...parsed,
      fileName: file.name,
    });
    setManagerMapping(getDefaultManagerMapping(parsed.headers));
  }

  async function handleSubmit() {
    if (!completionFile || !managerFile || !completionPreview || !managerPreview) {
      setSubmitState("error");
      setMessage("Both files are required before you can confirm the import.");
      return;
    }

    if (completionIssues.length || managerIssues.length) {
      setSubmitState("error");
      setMessage("Resolve the mapping issues before confirming the import.");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    const formData = new FormData();
    formData.append("completionFile", completionFile);
    formData.append("managerFile", managerFile);
    formData.append("completionMapping", JSON.stringify(completionMapping));
    formData.append("managerMapping", JSON.stringify(managerMapping));
    formData.append(
      "completionSnapshotDate",
      completionPreview.inferredSnapshotDate ?? "",
    );

    const response = await fetch("/api/imports", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setSubmitState("error");
      setMessage(payload.message ?? "Import failed.");
      return;
    }

    setSubmitState("success");
    setMessage(payload.message ?? "Import completed successfully.");
    window.location.reload();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-5">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Import files</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Upload the Trainual completion report and the manager mapping report,
              then confirm the normalized preview before saving to Supabase.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <UploadCard
              title="Trainual completion file"
              accept=".csv,text/csv"
              fileName={completionPreview?.fileName}
              onChange={(file) => handleFile(file, "completion")}
            />
            <UploadCard
              title="Manager mapping file"
              accept=".csv,text/csv"
              fileName={managerPreview?.fileName}
              onChange={(file) => handleFile(file, "manager_mapping")}
            />
          </div>

          {completionPreview ? (
            <MappingSection
              title="Completion column mapping"
              type="completion"
              headers={completionPreview.headers}
              mapping={completionMapping}
              onChange={(field, value) =>
                setCompletionMapping((current) => ({ ...current, [field]: value }))
              }
              rows={completionPreview.rows}
              issues={completionIssues}
            />
          ) : null}

          {managerPreview ? (
            <MappingSection
              title="Manager column mapping"
              type="manager_mapping"
              headers={managerPreview.headers}
              mapping={managerMapping}
              onChange={(field, value) =>
                setManagerMapping((current) => ({ ...current, [field]: value }))
              }
              rows={managerPreview.rows}
              issues={managerIssues}
            />
          ) : null}

          <div className="flex flex-col gap-4 rounded-[24px] border border-dashed p-5">
            <div className="flex items-start gap-3">
              {submitState === "error" ? (
                <AlertCircle className="mt-0.5 h-5 w-5 text-[var(--danger)]" />
              ) : submitState === "success" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--success)]" />
              ) : (
                <FileUp className="mt-0.5 h-5 w-5 text-[var(--brand-navy)]" />
              )}
              <div>
                <p className="font-semibold text-[var(--brand-navy)]">Confirm import</p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Imports upsert employees and managers, store the original files in
                  Supabase Storage, and insert completion snapshots for dashboard reporting.
                </p>
              </div>
            </div>
            {message ? (
              <p className="text-sm leading-6 text-[var(--muted-foreground)]">{message}</p>
            ) : null}
            <div>
              <Button
                onClick={handleSubmit}
                disabled={
                  submitState === "submitting" || !completionPreview || !managerPreview
                }
              >
                {submitState === "submitting" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Confirm import"
                )}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold">Recent imports</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Logged from the shared Supabase database.
            </p>
          </div>
          <div className="space-y-3">
            {history.length ? (
              history.map((item) => (
                <div key={item.id} className="rounded-[22px] border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--brand-navy)]">
                        {item.sourceName}
                      </p>
                      <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
                        {item.importType.replace("_", " ")}
                      </p>
                    </div>
                    <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold uppercase text-[var(--brand-navy)]">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    {new Date(item.importedAt).toLocaleString()} • {item.rowCount} rows
                  </p>
                  {item.notes ? (
                    <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                      {item.notes}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-[22px] border border-dashed p-6 text-sm text-[var(--muted-foreground)]">
                No imports recorded yet.
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

function UploadCard({
  title,
  accept,
  fileName,
  onChange,
}: {
  title: string;
  accept: string;
  fileName?: string;
  onChange: (file: File) => void;
}) {
  return (
    <label className="block rounded-[26px] border border-dashed bg-white p-5">
      <span className="mb-3 block font-semibold text-[var(--brand-navy)]">{title}</span>
      <span className="mb-4 block text-sm text-[var(--muted-foreground)]">
        {fileName ?? "Choose a CSV file"}
      </span>
      <input
        className="block w-full text-sm"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onChange(file);
        }}
      />
    </label>
  );
}

function MappingSection({
  title,
  type,
  headers,
  mapping,
  onChange,
  rows,
  issues,
}: {
  title: string;
  type: ImportType;
  headers: string[];
  mapping: Record<string, string>;
  onChange: (field: string, value: string) => void;
  rows: Record<string, string>[];
  issues: string[];
}) {
  const fields = listCanonicalLabels(type);

  return (
    <div className="space-y-4 rounded-[28px] border bg-[var(--surface-muted)]/50 p-5">
      <div>
        <h3 className="font-serif text-xl font-semibold">{title}</h3>
        <p className="text-sm text-[var(--muted-foreground)]">
          Adjust the source column for any canonical field if the report headers vary.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => (
          <label key={field} className="block">
            <span className="mb-2 block text-sm font-medium">{field}</span>
            <select
              className="w-full rounded-2xl border bg-white px-4 py-3 outline-none"
              value={mapping[field] ?? ""}
              onChange={(event) => onChange(field, event.target.value)}
            >
              <option value="">Not mapped</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {issues.length ? (
        <div className="space-y-2 rounded-[22px] border border-[#c9080830] bg-[#c9080808] p-4 text-sm text-[var(--danger)]">
          {issues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-[#2f7d3230] bg-[#2f7d3208] p-4 text-sm text-[var(--success)]">
          Mapping looks valid.
        </div>
      )}

      <div className="overflow-x-auto rounded-[22px] border bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-[var(--surface-muted)]">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-3 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 6).map((row, index) => (
              <tr key={index} className="border-t">
                {headers.map((header) => (
                  <td key={header} className="px-3 py-2 text-[var(--muted-foreground)]">
                    {row[header] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
