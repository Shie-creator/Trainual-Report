import { LoginForm } from "@/components/login-form";
import { SetupState } from "@/components/ui/setup-state";
import { isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isSupabaseConfigured()) {
    return <SetupState />;
  }

  return (
    <LoginForm
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
    />
  );
}
