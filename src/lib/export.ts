import type { ChecklistCategory, EngagementRecord, Phrase } from "./types";
import { COMPLIANCE_CATEGORIES, effectiveScore } from "./format";
import { categoryNameOf, resolvePhrase } from "./checklist";

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

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReportKind = "engagements" | "agents" | "compliance" | "team";

export interface ReportRow {
  [key: string]: string | number | boolean;
}

export function exportCSV(filename: string, headers: string[], rows: ReportRow[], keyOrder: string[]) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(keyOrder.map((k) => csvEscape(row[k] ?? "")).join(","));
  }
  download(filename, lines.join("\n"), "text/csv;charset=utf-8");
}

export function engagementsToRows(records: EngagementRecord[], phrases: Phrase[], categories: ChecklistCategory[]): { headers: string[]; keys: string[]; rows: ReportRow[] } {
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
    pulseCompleted: r.pulseCompleted ? "Yes" : "No",
    dropped: r.dropped ? "Yes" : "No",
    status: r.status,
    checkedItems: r.checkedItems.map(label).join("; "),
    missedItems: r.missedItems.map(label).join("; "),
  }));
  return { headers, keys, rows };
}

export function agentSummaryRows(records: EngagementRecord[]): { headers: string[]; keys: string[]; rows: ReportRow[] } {
  const byAgent = new Map<string, EngagementRecord[]>();
  for (const r of records) {
    const key = `${r.userName}|${r.team}`;
    byAgent.set(key, [...(byAgent.get(key) || []), r]);
  }
  const rows: ReportRow[] = [...byAgent.entries()].map(([key, list]) => {
    const [userName, team] = key.split("|");
    const scores = list.map((r) => effectiveScore(r));
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    return {
      agent: userName,
      team,
      engagements: list.length,
      avgScore: avg,
      best: Math.max(...scores),
      worst: Math.min(...scores),
      pulseRate: Math.round((list.filter((r) => r.pulseCompleted).length / list.length) * 100),
      dropped: list.filter((r) => r.dropped).length,
      lastReview: list.find((r) => r.reviewed) ? new Date(Math.max(...list.filter((r) => r.reviewed).map((r) => r.reviewed!.at))).toLocaleDateString("en-ZA") : "Never",
    };
  });
  rows.sort((a, b) => Number(b.avgScore) - Number(a.avgScore));
  return { headers: ["Agent", "Team", "Engagements", "Avg Score", "Best", "Worst", "Pulse Rate %", "Dropped", "Last Review"], keys: ["agent", "team", "engagements", "avgScore", "best", "worst", "pulseRate", "dropped", "lastReview"], rows };
}

export function complianceRows(records: EngagementRecord[], phrases: Phrase[], categories: ChecklistCategory[]): { headers: string[]; keys: string[]; rows: ReportRow[] } {
  const categoryOf = (id: string) => categoryNameOf(categories, phrases, id);
  const rows: ReportRow[] = records.map((r) => {
    const complianceItems = r.checkedItems.filter((c) => COMPLIANCE_CATEGORIES.has(categoryOf(c)));
    const complianceMissed = r.missedItems.filter((c) => COMPLIANCE_CATEGORIES.has(categoryOf(c)));
    const done = complianceItems.length;
    const total = done + complianceMissed.length;
    return {
      agent: r.userName,
      team: r.team,
      date: r.isoDate,
      complianceScore: total ? Math.round((done / total) * 100) : "",
      compliant: complianceItems.join("; "),
      nonCompliant: complianceMissed.join("; "),
    };
  });
  return { headers: ["Agent", "Team", "Date", "Compliance Score", "Compliant Steps", "Non-Compliant Steps"], keys: ["agent", "team", "date", "complianceScore", "compliant", "nonCompliant"], rows };
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
