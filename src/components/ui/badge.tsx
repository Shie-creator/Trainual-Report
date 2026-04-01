import type { HTMLAttributes } from "react";

import { STATUS_COLORS, type CompletionStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { status: CompletionStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{
        color: STATUS_COLORS[status],
        backgroundColor: `${STATUS_COLORS[status]}15`,
      }}
      {...props}
    >
      {status}
    </span>
  );
}
