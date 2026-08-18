import type { ChecklistCategory, EngagementRecord, Phrase } from "./types";
import { avg, complianceBreakdown, complianceScore, effectiveScore, pulseRate, yesNo } from "./format";
import { resolvePhrase } from "./checklist";
import { downloadFile } from "./download";
import { agentKey, averageScore, groupBy, lastReviewAt, scoresOf, splitAgentKey } from "./records";

/** Guard spreadsheet cells against formula injection (starts with = + - @). */
function safeCell(value: string | number | boolean): string {
  const s = String(value);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}

function csvEscape(value: string | number | boolean): string {
  const s = safeCell(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type ReportKind = "engagements" | "agents" | "compliance" | "team";

export interface ReportRow {
  [key: string]: string | number | boolean;
}

/** A report as both keyed rows (CSV) and ordered columns (print). */
export interface ReportTable {
  headers: string[];
  keys: string[];
  rows: ReportRow[];
}

/** Ordered cell matrix for a table, matching the header order. */
export function tableMatrix(table: ReportTable): (string | number | boolean)[][] {
  return table.rows.map((row) => table.keys.map((k) => row[k] ?? ""));
}

export function exportCSV(filename: string, headers: string[], rows: ReportRow[], keyOrder: string[]) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(keyOrder.map((k) => csvEscape(row[k] ?? "")).join(","));
  }
  downloadFile(filename, lines.join("\n"), "text/csv;charset=utf-8");
}

export function exportTableCSV(filename: string, table: ReportTable) {
  exportCSV(filename, table.headers, table.rows, table.keys);
}

export function engagementsToRows(records: EngagementRecord[], phrases: Phrase[], categories: ChecklistCategory[]): ReportTable {
  const label = (id: string) => resolvePhrase(categories, phrases, id)?.text ?? id;
  const headers = [
    "Agent Name",
    "Team",
    "Date & Time",
    "Score (%)",
    "Corrected Score",
    "Completed",
    "Total Steps",
    "Pulse Adopted",
    "Dropped",
    "Status",
    "Completed Steps",
    "Missed Steps",
  ];
  const keys = ["userName", "team", "dateTime", "score", "corrected", "completed", "total", "pulseCompleted", "dropped", "status", "checkedItems", "missedItems"];
  const rows: ReportRow[] = records.map((r) => ({
    userName: r.userName,
    team: r.team,
    dateTime: r.dateTime,
    score: r.score,
    corrected: r.corrected ? effectiveScore(r) : "",
    completed: r.completed,
    total: r.total,
    pulseCompleted: yesNo(r.pulseCompleted),
    dropped: yesNo(r.dropped),
    status: r.status,
    checkedItems: r.checkedItems.map(label).join("; "),
    missedItems: r.missedItems.map(label).join("; "),
  }));
  return { headers, keys, rows };
}

export function agentSummaryRows(records: EngagementRecord[]): ReportTable {
  const rows: ReportRow[] = [...groupBy(records, agentKey).entries()].map(([key, list]) => {
    const { name, team } = splitAgentKey(key);
    const scores = scoresOf(list);
    const reviewedAt = lastReviewAt(list);
    return {
      agent: name,
      team,
      engagements: list.length,
      avgScore: avg(scores),
      best: Math.max(...scores),
      worst: Math.min(...scores),
      pulseRate: pulseRate(list),
      dropped: list.filter((r) => r.dropped).length,
      lastReview: reviewedAt ? new Date(reviewedAt).toLocaleDateString("en-ZA") : "Never",
    };
  });
  rows.sort((a, b) => Number(b.avgScore) - Number(a.avgScore));
  return { headers: ["Agent", "Team", "Engagements", "Avg Score", "Best", "Worst", "Pulse Rate %", "Dropped", "Last Review"], keys: ["agent", "team", "engagements", "avgScore", "best", "worst", "pulseRate", "dropped", "lastReview"], rows };
}

export function complianceRows(records: EngagementRecord[], phrases: Phrase[], categories: ChecklistCategory[]): ReportTable {
  const rows: ReportRow[] = records.map((r) => {
    const { compliant, nonCompliant, score } = complianceBreakdown(r, phrases, categories);
    return {
      agent: r.userName,
      team: r.team,
      date: r.isoDate,
      complianceScore: score ?? "",
      compliant: compliant.join("; "),
      nonCompliant: nonCompliant.join("; "),
    };
  });
  return { headers: ["Agent", "Team", "Date", "Compliance Score", "Compliant Steps", "Non-Compliant Steps"], keys: ["agent", "team", "date", "complianceScore", "compliant", "nonCompliant"], rows };
}

/** Per-team averages, ranked by average score. */
export function teamSummaryRows(
  records: EngagementRecord[],
  phrases: Phrase[],
  categories: ChecklistCategory[],
): ReportTable {
  const rows: ReportRow[] = [...groupBy(records, (r) => r.team).entries()]
    .map(([team, list]) => ({
      team,
      engagements: list.length,
      avgScore: `${averageScore(list)}%`,
      compliance: `${complianceScore(list, phrases, categories)}%`,
      pulse: `${pulseRate(list)}%`,
    }))
    .sort((a, b) => averageOf(b) - averageOf(a));
  return {
    headers: ["Team", "Engagements", "Avg score", "Compliance", "Pulse rate"],
    keys: ["team", "engagements", "avgScore", "compliance", "pulse"],
    rows,
  };
}

function averageOf(row: ReportRow): number {
  return Number(String(row.avgScore).replace("%", ""));
}

export const REPORT_TITLES: Record<ReportKind, string> = {
  engagements: "Engagement report",
  agents: "Agent comparison report",
  compliance: "Compliance report",
  team: "Team performance report",
};

export const REPORT_FILE_PREFIX: Record<ReportKind, string> = {
  engagements: "Engagements",
  agents: "Agents",
  compliance: "Compliance",
  team: "TeamPerformance",
};

/** The one place a report kind is turned into data — used for both CSV and print. */
export function reportTable(
  kind: ReportKind,
  records: EngagementRecord[],
  phrases: Phrase[],
  categories: ChecklistCategory[],
): ReportTable {
  switch (kind) {
    case "engagements":
      return engagementsToRows(records, phrases, categories);
    case "compliance":
      return complianceRows(records, phrases, categories);
    case "agents":
      return agentSummaryRows(records);
    case "team":
      return teamSummaryRows(records, phrases, categories);
  }
}

export function printReport(title: string, subtitle: string, blocks: { heading: string; headers: string[]; rows: (string | number | boolean)[][] }[]) {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  const esc = (s: string | number | boolean) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const tables = blocks
    .map(
      (b) => `
      <h2>${esc(b.heading)}</h2>
      <table>
        <thead><tr>${b.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`,
    )
    .join("");
  win.document.write(`<!doctype html><html><head><title>${esc(title)}</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2d3d;padding:32px;margin:0;background:#fff}
      h1{color:#003865;margin:0 0 4px;font-size:22px}
      .sub{color:#5f6f7e;margin-bottom:24px;font-size:13px}
      h2{color:#003865;font-size:15px;margin:22px 0 8px;border-bottom:2px solid #eef3f7;padding-bottom:6px}
      table{border-collapse:collapse;width:100%;font-size:11.5px;margin-bottom:8px}
      th{background:#003865;color:#fff;text-align:left;padding:7px 9px}
      td{padding:6px 9px;border-bottom:1px solid #e8eff5}
      tr:nth-child(even) td{background:#f7fafc}
      .meta{color:#7b8a97;font-size:11px;margin-bottom:20px}
      @media print{body{padding:12px}}
    </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="sub">${esc(subtitle)}</div>
    <div class="meta">Generated ${new Date().toLocaleString("en-ZA")}</div>
    ${tables}
    <script>window.onload = () => window.print();</script>
  </body></html>`);
  win.document.close();
}
