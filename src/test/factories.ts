import type { EngagementRecord } from "../lib/types";

/** Minimal engagement record for tests; override only what a case cares about. */
export function makeRecord(partial: Partial<EngagementRecord> = {}): EngagementRecord {
  return {
    id: "e1",
    userName: "Thandi Nkosi",
    team: "CCS01",
    dateTime: "01 Jan 2024, 09:00",
    isoDate: "2024-01-01",
    savedAt: 1_704_099_600_000,
    completed: 0,
    total: 11,
    score: 0,
    pulseCompleted: false,
    dropped: false,
    checkedItems: [],
    missedItems: [],
    status: "active",
    ...partial,
  };
}
