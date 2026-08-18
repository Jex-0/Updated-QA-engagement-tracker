import type { ChecklistCategory, EngagementRecord, Phrase } from "./types";
import { avg, complianceScore, effectiveScore, pulseRate } from "./format";

export const DAY_MS = 86_400_000;

/** Ranges offered by the dashboard/report filters: days as a string, or all history. */
export type DayRange = "7" | "30" | "90" | "all";

/** Timestamp before which records fall outside the selected range (0 = all time). */
export function rangeCutoff(range: DayRange): number {
  return range === "all" ? 0 : Date.now() - Number(range) * DAY_MS;
}

/** yyyy-mm-dd key for a timestamp. */
export function isoDay(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Agents are identified by name + team across the app. */
export function agentKey(record: EngagementRecord): string {
  return `${record.userName}|${record.team}`;
}

export function splitAgentKey(key: string): { name: string; team: string } {
  const [name, team] = key.split("|");
  return { name, team };
}

export function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Effective scores (after manager corrections) for a set of records. */
export function scoresOf(records: EngagementRecord[]): number[] {
  return records.map((r) => effectiveScore(r));
}

/** Average effective score, 0 when there are no records. */
export function averageScore(records: EngagementRecord[]): number {
  return avg(scoresOf(records));
}

export const newestFirst = (a: EngagementRecord, b: EngagementRecord) => b.savedAt - a.savedAt;
export const oldestFirst = (a: EngagementRecord, b: EngagementRecord) => a.savedAt - b.savedAt;

export function sortedByDate(records: EngagementRecord[], direction: "newest" | "oldest" = "newest"): EngagementRecord[] {
  return [...records].sort(direction === "newest" ? newestFirst : oldestFirst);
}

export interface RecordFilter {
  /** team name, or "all" */
  team?: string;
  /** agent name, or "all" */
  agent?: string;
  /** record status, or "all" */
  status?: "all" | EngagementRecord["status"];
  /** free-text match against agent name and team */
  query?: string;
  /** keep records saved at or after this timestamp */
  since?: number;
}

export function filterRecords(records: EngagementRecord[], filter: RecordFilter): EngagementRecord[] {
  const query = filter.query?.trim().toLowerCase();
  return records.filter((r) => {
    if (filter.team && filter.team !== "all" && r.team !== filter.team) return false;
    if (filter.agent && filter.agent !== "all" && r.userName !== filter.agent) return false;
    if (filter.status && filter.status !== "all" && r.status !== filter.status) return false;
    if (filter.since && r.savedAt < filter.since) return false;
    if (query && !`${r.userName} ${r.team}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

/** Distinct agent names appearing in a set of records, alphabetically. */
export function agentNames(records: EngagementRecord[]): string[] {
  return [...new Set(records.map((r) => r.userName))].sort();
}

/** Number of distinct agents (name + team) in a set of records. */
export function agentCount(records: EngagementRecord[]): number {
  return new Set(records.map(agentKey)).size;
}

/** Most recent review timestamp across a set of records, null when never reviewed. */
export function lastReviewAt(records: EngagementRecord[]): number | null {
  return records.reduce<number | null>((acc, r) => (r.reviewed ? Math.max(acc ?? 0, r.reviewed.at) : acc), null);
}

export interface RecordSummary {
  engagements: number;
  agents: number;
  avgScore: number;
  compliance: number;
  pulse: number;
}

/** Headline stats shared by the dashboards, the manager overview and reporting. */
export function summarise(records: EngagementRecord[], phrases: Phrase[], categories: ChecklistCategory[]): RecordSummary {
  return {
    engagements: records.length,
    agents: agentCount(records),
    avgScore: averageScore(records),
    compliance: complianceScore(records, phrases, categories),
    pulse: pulseRate(records),
  };
}
