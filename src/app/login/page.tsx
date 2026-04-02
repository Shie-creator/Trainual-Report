import Link from "next/link";

import { Card } from "@/components/ui/card";
import { SetupState } from "@/components/ui/setup-state";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isSupabaseConfigured()) {
    return <SetupState />;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12">
      <Card className="w-full space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--brand-seafoam)]">
            Public Access
          </p>
          <h1 className="font-serif text-4xl font-semibold text-[var(--brand-navy)]">
            The dashboard is now open without sign-in.
          </h1>
          <p className="text-sm leading-7 text-[var(--muted-foreground)]">
            Use the public dashboard directly, or keep email sign-in available here if you
            still want optional authenticated access for Supabase accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="rounded-full bg-[var(--brand-navy)] px-5 py-2.5 text-sm font-semibold text-white"
            href="/dashboard"
          >
            Open dashboard
          </Link>
          <Link
            className="rounded-full border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--brand-navy)]"
            href="/admin/imports"
          >
            Open imports
          </Link>
        </div>
      </Card>
    </div>
  );
}
