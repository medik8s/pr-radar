"use client";
import type { BotReviewState } from "@/lib/types";

const SPINNER = (
  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-status-warning border-t-transparent" />
);

export function BotBadge({ state }: { state: BotReviewState }) {
  switch (state.state) {
    case "missing":
      return <span className="text-text-muted text-xs">—</span>;
    case "thinking":
      return <span title="Generating...">{SPINNER}</span>;
    case "rate_limited":
      return (
        <span title="Rate limited" className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2 py-0.5 text-xs text-status-warning border border-[rgba(234,179,8,0.25)]">
          limit
        </span>
      );
    case "clean":
      return (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-status-success text-xs font-bold text-white">
          ✓
        </span>
      );
    case "open":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-status-error-bg px-2 py-0.5 text-xs font-semibold text-status-error border border-[rgba(239,68,68,0.25)]">
          {state.count}
        </span>
      );
  }
}
