import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "card-surface rounded-[28px] border border-white/80 p-6",
        className,
      )}
      {...props}
    />
  );
}
