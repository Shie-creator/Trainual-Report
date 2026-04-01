import { Inbox } from "lucide-react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="flex min-h-64 flex-col items-center justify-center gap-4 border-dashed text-center">
      <div className="rounded-full bg-[var(--surface-muted)] p-4 text-[var(--brand-navy)]">
        <Inbox className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <h2 className="font-serif text-2xl font-semibold">{title}</h2>
        <p className="max-w-xl text-sm leading-6 text-[var(--muted-foreground)]">
          {description}
        </p>
      </div>
    </Card>
  );
}
