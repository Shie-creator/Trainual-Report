import { AppShell } from "@/components/app-shell";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  const [profile, supabase] = await Promise.all([
    getCurrentProfile(),
    createSupabaseServerClient(),
  ]);

  const { data: latestImport } = await supabase
    .from("imports")
    .select("imported_at")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell
      title="Trainual Completion Dashboard"
      subtitle="Live completion analytics for employees and managers"
      latestImportAt={latestImport?.imported_at ?? null}
      isAdmin={profile?.role === "admin"}
    >
      {children}
    </AppShell>
  );
}
