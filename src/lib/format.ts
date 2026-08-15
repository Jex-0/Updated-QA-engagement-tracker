import type { EngagementRecord } from "./types";
import { ENGAGEMENT_ITEMS } from "./checklist";

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `00:${mm}:${ss}`;
}

export function fmtDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function scoreTone(score: number): "high" | "mid" | "low" {
  return score >= 80 ? "high" : score >= 50 ? "mid" : "low";
}

export function scoreColor(score: number): string {
  return score >= 80 ? "var(--success)" : score >= 50 ? "var(--warning)" : "var(--danger)";
}

/** Effective score after any manager correction. */
export function effectiveScore(r: EngagementRecord): number {
  return r.corrected ? r.corrected.newScore : r.score;
}

export function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function rollingAverage(scores: number[], windowSize = 7): number[] {
  return scores.map((_, i) => {
    const win = scores.slice(Math.max(0, i - windowSize + 1), i + 1);
    return Math.round(win.reduce((a, b) => a + b, 0) / win.length);
  });
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Aggregates checked / missed categories across a set of records. */
export function aggregateCategories(records: EngagementRecord[]): {
  checked: Record<string, number>;
  missed: Record<string, number>;
} {
  const checked: Record<string, number> = {};
  const missed: Record<string, number> = {};
  for (const r of records) {
    for (const c of r.checkedItems) checked[c] = (checked[c] || 0) + 1;
    for (const c of r.missedItems) missed[c] = (missed[c] || 0) + 1;
  }
  return { checked, missed };
}

/** Returns the 11 categories in canonical order with per-category performance. */
export function categoryPerformance(records: EngagementRecord[]) {
  const { checked, missed } = aggregateCategories(records);
  return ENGAGEMENT_ITEMS.map((item) => {
    const done = checked[item.category] || 0;
    const not = missed[item.category] || 0;
    const total = done + not;
    return {
      category: item.category,
      phrase: item.phrase,
      done,
      missed: not,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
  });
}

/** Compliance = adherence to mandatory regulatory steps (verification, recap, closing). */
export const COMPLIANCE_CATEGORIES = new Set([
  "Verification",
  "Keeping Client Informed",
  "Recap_and_Summarise",
  "Call Closing",
]);

export function complianceScore(records: EngagementRecord[]): number {
  if (!records.length) return 0;
  let done = 0;
  let total = 0;
  for (const r of records) {
    for (const c of r.checkedItems) if (COMPLIANCE_CATEGORIES.has(c)) done++;
    for (const c of r.checkedItems) if (COMPLIANCE_CATEGORIES.has(c)) total++;
    for (const c of r.missedItems) if (COMPLIANCE_CATEGORIES.has(c)) total++;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function pulseRate(records: EngagementRecord[]): number {
  if (!records.length) return 0;
  return Math.round((records.filter((r) => r.pulseCompleted).length / records.length) * 100);
}
