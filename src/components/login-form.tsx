"use client";

import { useState } from "react";
import { Mail, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ siteUrl }: { siteUrl: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const redirectTo = new URL("/auth/callback", siteUrl);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo.toString(),
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your inbox for the secure sign-in link.");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="data-grid hidden bg-[var(--brand-navy)] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="space-y-8">
          <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.32em]">
            Nao Medical Internal Tool
          </div>
          <div className="max-w-xl space-y-5">
            <h1 className="font-serif text-6xl font-semibold leading-tight">
              Trainual Completion Dashboard
            </h1>
            <p className="text-lg leading-8 text-white/82">
              Track employee completion, compare manager performance, and import fresh
              Trainual snapshots into Supabase from one production-ready workspace.
            </p>
          </div>
        </div>
        <div className="grid gap-4 text-sm text-white/82 md:grid-cols-2">
          <div className="rounded-[26px] border border-white/16 bg-white/10 p-5 backdrop-blur">
            <p className="font-semibold">Executive-friendly reporting</p>
            <p className="mt-2 leading-6">
              Live KPIs, completion bands, linked charts, and manager drilldowns.
            </p>
          </div>
          <div className="rounded-[26px] border border-white/16 bg-white/10 p-5 backdrop-blur">
            <p className="font-semibold">Controlled imports</p>
            <p className="mt-2 leading-6">
              Admin-only CSV validation, column mapping, preview, and import history.
            </p>
          </div>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 lg:px-10">
        <div className="card-surface w-full max-w-md rounded-[32px] border border-white/80 p-8">
          <div className="mb-8 space-y-3">
            <div className="inline-flex rounded-full bg-[var(--brand-powder)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-navy)]">
              Secure Access
            </div>
            <h2 className="font-serif text-4xl font-semibold text-[var(--brand-navy)]">
              Sign in with email
            </h2>
            <p className="text-sm leading-7 text-[var(--muted-foreground)]">
              Enter your work email to receive a Supabase magic link for the dashboard.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2 text-sm font-medium">
              <span>Email address</span>
              <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3">
                <Mail className="h-4 w-4 text-[var(--muted-foreground)]" />
                <input
                  className="w-full bg-transparent outline-none"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@naomedical.com"
                  required
                />
              </div>
            </label>

            <Button className="w-full" disabled={status === "loading"} type="submit">
              <Sparkles className="mr-2 h-4 w-4" />
              {status === "loading" ? "Sending link..." : "Email me a sign-in link"}
            </Button>
          </form>

          {message ? (
            <p
              className="mt-4 rounded-2xl px-4 py-3 text-sm leading-6"
              style={{
                backgroundColor: status === "error" ? "#c9080815" : "#9acf8c25",
                color: status === "error" ? "var(--danger)" : "var(--brand-navy)",
              }}
            >
              {message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
