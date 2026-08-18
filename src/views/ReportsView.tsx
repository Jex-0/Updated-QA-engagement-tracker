import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Card, CardHeader, EmptyState, Select, StatCard } from "../components/ui";
import { Icon } from "../components/icons";
import { exportTableCSV, printReport, REPORT_FILE_PREFIX, REPORT_TITLES, reportTable, tableMatrix, type ReportKind } from "../lib/export";
import { filterRecords, isoDay, rangeCutoff, summarise, type DayRange } from "../lib/records";

const KINDS: { id: ReportKind; label: string; icon: "users" | "chart" | "shield" | "fileText" }[] = [
  { id: "team", label: "Team performance", icon: "users" },
  { id: "agents", label: "Agent comparison", icon: "chart" },
  { id: "compliance", label: "Compliance report", icon: "shield" },
  { id: "engagements", label: "Engagement report", icon: "fileText" },
];

export function ReportsView() {
  const { state } = useStore();
  const [kind, setKind] = useState<ReportKind>("team");
  const [range, setRange] = useState<DayRange>("30");
  const [team, setTeam] = useState("all");

  const cutoff = rangeCutoff(range);
  const scoped = useMemo(
    () => filterRecords(state.records, { status: "active", since: cutoff, team }),
    [state.records, cutoff, team],
  );

  const stats = useMemo(() => summarise(scoped, state.phrases, state.categories), [scoped, state.phrases, state.categories]);
  const table = useMemo(() => reportTable(kind, scoped, state.phrases, state.categories), [kind, scoped, state.phrases, state.categories]);

  const rangeLabel = range === "all" ? "All time" : `Last ${range} days`;
  const teamLabel = team === "all" ? "All teams" : team;

  const doCSV = () => {
    if (!scoped.length) return;
    exportTableCSV(`${REPORT_FILE_PREFIX[kind]}_${isoDay(Date.now())}.csv`, table);
  };

  const doPDF = () => {
    if (!scoped.length) return;
    printReport(
      `${KINDS.find((k) => k.id === kind)?.label ?? "Report"} — Client Engagement Tracker`,
      `${teamLabel} · ${rangeLabel} · ${scoped.length} engagements`,
      [{ heading: REPORT_TITLES[kind], headers: table.headers, rows: tableMatrix(table) }],
    );
  };

  return (
    <div className="reports-page">
      <Card>
        <CardHeader title="Reporting" subtitle="Export team, agent, compliance and engagement reports as CSV or print-ready PDF" />
        <div className="report-controls">
          <div className="report-kinds">
            {KINDS.map((k) => (
              <button key={k.id} type="button" className={kind === k.id ? "report-kind active" : "report-kind"} onClick={() => setKind(k.id)}>
                <Icon name={k.icon} size={18} />
                {k.label}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <Select value={range} onChange={(e) => setRange(e.target.value as DayRange)} aria-label="Period">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </Select>
            <Select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
              <option value="all">All teams</option>
              {state.teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </div>
        </div>
      </Card>

      <div className="stat-grid-4">
        <StatCard icon="fileText" label="Engagements" value={stats.engagements} sub={rangeLabel} />
        <StatCard icon="users" label="Agents" value={stats.agents} sub={teamLabel} tone="info" />
        <StatCard icon="star" label="Average score" value={`${stats.avgScore}%`} tone="success" />
        <StatCard icon="shield" label="Compliance" value={`${stats.compliance}%`} sub={`Pulse ${stats.pulse}%`} tone="warning" />
      </div>

      {scoped.length === 0 ? (
        <Card>
          <EmptyState icon="chart" title="Nothing to report" description="Record engagements in this period first." />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`Preview — ${KINDS.find((k) => k.id === kind)?.label}`}
            subtitle={`${teamLabel} · ${rangeLabel}`}
            actions={
              <div className="report-actions">
                <Button variant="secondary" size="sm" icon="download" onClick={doCSV}>Export CSV</Button>
                <Button size="sm" icon="printer" onClick={doPDF}>Print / PDF</Button>
              </div>
            }
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {table.headers.map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {tableMatrix(table).slice(0, 25).map((r, i) => (
                  <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="report-note">
        <div className="report-note-icon"><Icon name="clock" size={18} /></div>
        <div>
          <strong>Scheduled reporting</strong>
          <p>
            Automatic email delivery of reports (daily / weekly / monthly) requires a server-side scheduler — this is
            listed in the roadmap with Firebase Cloud Functions or Convex as the recommended backend. On-demand exports
            above are available today.
          </p>
        </div>
      </Card>
    </div>
  );
}
