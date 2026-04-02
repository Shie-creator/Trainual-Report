"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function DashboardUploadPanel() {
  const [completionFile, setCompletionFile] = useState<File | null>(null);
  const [onshoreFile, setOnshoreFile] = useState<File | null>(null);
  const [offshoreFile, setOffshoreFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("Choose a manager mapping file first, then upload Trainual completion whenever you are ready.");

  async function handleUpload() {
    setStatus("submitting");
    const formData = new FormData();
    if (completionFile) formData.append("completionFile", completionFile);
    if (onshoreFile) formData.append("onshoreManagerFile", onshoreFile);
    if (offshoreFile) formData.append("offshoreManagerFile", offshoreFile);

    const response = await fetch("/api/imports", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json()) as { message?: string };

    if (!response.ok) {
      setStatus("error");
      setMessage(payload.message ?? "Upload failed.");
      return;
    }

    setStatus("success");
    setMessage(payload.message ?? "Dashboard refreshed.");
    window.location.reload();
  }

  return (
    <Card className="rounded-[32px]">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <h3 className="text-4xl font-semibold text-[var(--brand-navy)]">
            Refresh the live dashboard for everyone
          </h3>
          <p className="text-xl text-[#9f5f49]">
            Upload Onshore and Offshore roster mappings first, then Trainual completion whenever it is ready.
          </p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <UploadButton label={onshoreFile?.name ?? "Choose Onshore XLSX"} accept=".xlsx" onPick={setOnshoreFile} />
            <UploadButton label={offshoreFile?.name ?? "Choose Offshore XLSX"} accept=".xlsx" onPick={setOffshoreFile} />
            <UploadButton label={completionFile?.name ?? "Choose Completion CSV"} accept=".csv,text/csv" onPick={setCompletionFile} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              className="px-8 py-3"
              disabled={status === "submitting" || (!completionFile && !onshoreFile && !offshoreFile)}
              onClick={handleUpload}
            >
              {status === "submitting" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Upload and Refresh Live Site"
              )}
            </Button>
            <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              {status === "error" ? (
                <AlertCircle className="h-4 w-4 text-[var(--danger)]" />
              ) : status === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
              ) : null}
              {message}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function UploadButton({
  label,
  accept,
  onPick,
}: {
  label: string;
  accept: string;
  onPick: (file: File | null) => void;
}) {
  return (
    <label className="cursor-pointer rounded-full border bg-white px-5 py-4 text-center font-semibold text-[var(--brand-navy)]">
      <input
        className="hidden"
        type="file"
        accept={accept}
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
      />
      {label}
    </label>
  );
}
