import { Card } from "@/components/ui/card";

export function SetupState() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
      <Card className="w-full space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[var(--brand-seafoam)]">
          Configuration Needed
        </p>
        <h1 className="font-serif text-4xl font-semibold text-[var(--brand-navy)]">
          Connect Supabase to start the dashboard.
        </h1>
        <p className="text-sm leading-7 text-[var(--muted-foreground)]">
          Add the values from <code>.env.local.example</code> to your local
          environment or Vercel project settings, then reload the app.
        </p>
      </Card>
    </div>
  );
}
