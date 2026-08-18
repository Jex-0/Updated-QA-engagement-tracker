import type { ChecklistCategory, EngagementRecord, Phrase } from "./types";
import { categoryNameOf, resolvePhrase } from "./checklist";

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

export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/** The single place the good / watch / poor score thresholds are defined. */
export function scoreTone(score: number): "high" | "mid" | "low" {
  return score >= 80 ? "high" : score >= 50 ? "mid" : "low";
}

const BAND_TONE = { high: "success", mid: "warning", low: "danger" } as const;

export type ScoreBadgeTone = (typeof BAND_TONE)[keyof typeof BAND_TONE];

/** Badge / progress-bar tone for a score. */
export function scoreBadgeTone(score: number): ScoreBadgeTone {
  return BAND_TONE[scoreTone(score)];
}

/** Compliance is pass / needs-attention only — never rendered as a failure. */
export function complianceTone(score: number): "success" | "warning" {
  return score >= 80 ? "success" : "warning";
}

export function scoreColor(score: number): string {
  return `var(--${scoreBadgeTone(score)})`;
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

/**
 * Aggregates checked / missed items across a set of records, resolving legacy
 * category-name ids to current phrase ids so historical data still counts.
 */
export function aggregateCategories(
  records: EngagementRecord[],
  phrases: Phrase[],
  categories: ChecklistCategory[],
): {
  checked: Record<string, number>;
  missed: Record<string, number>;
} {
  const checked: Record<string, number> = {};
  const missed: Record<string, number> = {};
  const key = (id: string) => resolvePhrase(categories, phrases, id)?.id ?? id;
  for (const r of records) {
    for (const c of r.checkedItems) checked[key(c)] = (checked[key(c)] || 0) + 1;
    for (const c of r.missedItems) missed[key(c)] = (missed[key(c)] || 0) + 1;
  }
  return { checked, missed };
}

/** Per-category performance for the current checklist (dynamic, editable). */
export function categoryPerformance(records: EngagementRecord[], phrases: Phrase[], categories: ChecklistCategory[]) {
  const { checked, missed } = aggregateCategories(records, phrases, categories);
  return phrases.map((p) => {
    const done = checked[p.id] || 0;
    const not = missed[p.id] || 0;
    const total = done + not;
    return {
      category: p.categoryId,
      phrase: p.text,
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

export interface ComplianceBreakdown {
  /** ids of mandatory steps that were completed */
  compliant: string[];
  /** ids of mandatory steps that were missed */
  nonCompliant: string[];
  score: number | null;
}

/** Splits a record's items into compliant / non-compliant mandatory steps. */
export function complianceBreakdown(
  record: EngagementRecord,
  phrases: Phrase[],
  categories: ChecklistCategory[],
): ComplianceBreakdown {
  const isCompliance = (id: string) => COMPLIANCE_CATEGORIES.has(categoryNameOf(categories, phrases, id));
  const compliant = record.checkedItems.filter(isCompliance);
  const nonCompliant = record.missedItems.filter(isCompliance);
  const total = compliant.length + nonCompliant.length;
  return { compliant, nonCompliant, score: total ? Math.round((compliant.length / total) * 100) : null };
}

export function complianceScore(
  records: EngagementRecord[],
  phrases: Phrase[],
  categories: ChecklistCategory[],
): number {
  if (!records.length) return 0;
  let done = 0;
  let total = 0;
  for (const r of records) {
    const { compliant, nonCompliant } = complianceBreakdown(r, phrases, categories);
    done += compliant.length;
    total += compliant.length + nonCompliant.length;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

export function pulseRate(records: EngagementRecord[]): number {
  if (!records.length) return 0;
  return Math.round((records.filter((r) => r.pulseCompleted).length / records.length) * 100);
}
