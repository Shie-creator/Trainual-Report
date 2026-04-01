import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--brand-navy)] text-white hover:bg-[#172a52]",
        variant === "secondary" &&
          "bg-[var(--brand-mint)] text-[var(--brand-navy)] hover:bg-[#86bf77]",
        variant === "ghost" &&
          "border border-[var(--border)] bg-white text-[var(--brand-navy)] hover:bg-[var(--surface-muted)]",
        variant === "danger" &&
          "bg-[var(--danger)] text-white hover:bg-[#b10606]",
        className,
      )}
      {...props}
    />
  );
}
