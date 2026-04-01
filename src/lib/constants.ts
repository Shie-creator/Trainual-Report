export const STATUS_ORDER = ["Complete", "Nearly Complete", "Needs Attention"] as const;

export type CompletionStatus = (typeof STATUS_ORDER)[number];

export const STATUS_COLORS: Record<CompletionStatus, string> = {
  Complete: "#2f7d32",
  "Nearly Complete": "#b88315",
  "Needs Attention": "#c90808",
};

export function getCompletionStatus(percentage: number): CompletionStatus {
  if (percentage >= 100) {
    return "Complete";
  }

  if (percentage >= 80) {
    return "Nearly Complete";
  }

  return "Needs Attention";
}
