import Link from "next/link";
import { format } from "date-fns";

export function AppShell({
  children,
  title,
  subtitle,
  latestImportAt,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  latestImportAt: string | null;
}) {
  return (
    <div className="min-h-screen bg-transparent">
      <header className="border-b border-white/70 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-[var(--brand-navy)] px-3 py-1 text-xs font-bold uppercase tracking-[0.3em] text-white">
                Nao Medical
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {latestImportAt
                  ? `Latest import ${format(new Date(latestImportAt), "MMM d, yyyy • h:mm a")}`
                  : "No imports yet"}
              </p>
            </div>
            <div>
              <h1 className="font-serif text-4xl font-semibold text-[var(--brand-navy)]">
                {title}
              </h1>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--brand-navy)] transition hover:bg-[var(--surface-muted)]"
              href="/dashboard"
            >
              Dashboard
            </Link>
            <Link
              className="rounded-full border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--brand-navy)] transition hover:bg-[var(--surface-muted)]"
              href="/admin/imports"
            >
              Imports
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">
        {children}
      </main>
    </div>
  );
}
