import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Card, CardHeader, EmptyState, Select, StatCard } from "../components/ui";
import { Icon } from "../components/icons";
import { agentSummaryRows, complianceRows, engagementsToRows, exportCSV, printReport, type ReportKind } from "../lib/export";
import { avg, complianceScore, effectiveScore, pulseRate } from "../lib/format";

type Range = "7" | "30" | "90" | "all";

const KINDS: { id: ReportKind; label: string; icon: "users" | "chart" | "shield" | "fileText" }[] = [
  { id: "team", label: "Team performance", icon: "users" },
  { id: "agents", label: "Agent comparison", icon: "chart" },
  { id: "compliance", label: "Compliance report", icon: "shield" },
  { id: "engagements", label: "Engagement report", icon: "fileText" },
];

export function ReportsView() {
  const { state } = useStore();
  const [kind, setKind] = useState<ReportKind>("team");
  const [range, setRange] = useState<Range>("30");
  const [team, setTeam] = useState("all");

  const cutoff = range === "all" ? 0 : Date.now() - Number(range) * 86_400_000;
  const scoped = useMemo(
    () =>
      state.records
        .filter((r) => r.status === "active")
        .filter((r) => r.savedAt >= cutoff)
        .filter((r) => team === "all" || r.team === team),
    [state.records, cutoff, team],
  );

  const stats = useMemo(() => {
    const scores = scoped.map((r) => effectiveScore(r));
    const agents = new Set(scoped.map((r) => `${r.userName}|${r.team}`)).size;
    return { engagements: scoped.length, agents, avg: avg(scores), compliance: complianceScore(scoped), pulse: pulseRate(scoped) };
  }, [scoped]);

  const rangeLabel = range === "all" ? "All time" : `Last ${range} days`;
  const teamLabel = team === "all" ? "All teams" : team;

  const buildBlocks = () => {
    if (kind === "engagements") {
      const { headers, keys, rows } = engagementsToRows(scoped);
      return [{ heading: "Engagement report", headers, rows: rows.map((r) => keys.map((k) => r[k])) }];
    }
    if (kind === "compliance") {
      const { headers, keys, rows } = complianceRows(scoped);
      return [{ heading: "Compliance report", headers, rows: rows.map((r) => keys.map((k) => r[k])) }];
    }
    if (kind === "agents") {
      const { headers, keys, rows } = agentSummaryRows(scoped);
      return [{ heading: "Agent comparison report", headers, rows: rows.map((r) => keys.map((k) => r[k])) }];
    }
    // team performance: aggregate by team
    const byTeam = new Map<string, number[]>();
    for (const r of scoped) byTeam.set(r.team, [...(byTeam.get(r.team) || []), effectiveScore(r)]);
    const headers = ["Team", "Engagements", "Avg score", "Compliance", "Pulse rate"];
    const rows = [...byTeam.entries()]
      .map(([t, scores]) => [t, scores.length, `${avg(scores)}%`, `${complianceScore(scoped.filter((r) => r.team === t))}%`, `${pulseRate(scoped.filter((r) => r.team === t))}%`])
      .sort((a, b) => Number(String(b[2]).replace("%", "")) - Number(String(a[2]).replace("%", "")));
    return [{ heading: "Team performance report", headers, rows }];
  };

  const doCSV = () => {
    if (!scoped.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "engagements") {
      const { headers, keys, rows } = engagementsToRows(scoped);
      exportCSV(`Engagements_${stamp}.csv`, headers, rows, keys);
    } else if (kind === "compliance") {
      const { headers, keys, rows } = complianceRows(scoped);
      exportCSV(`Compliance_${stamp}.csv`, headers, rows, keys);
    } else if (kind === "agents") {
      const { headers, keys, rows } = agentSummaryRows(scoped);
      exportCSV(`Agents_${stamp}.csv`, headers, rows, keys);
    } else {
      const blocks = buildBlocks();
      const rows = blocks[0].rows.map((r) => r.reduce<Record<string, string | number | boolean>>((acc, v, i) => ({ ...acc, [blocks[0].headers[i]]: v }), {}));
      exportCSV(`TeamPerformance_${stamp}.csv`, blocks[0].headers, rows, blocks[0].headers);
    }
  };

  const doPDF = () => {
    if (!scoped.length) return;
    printReport(
      `${KINDS.find((k) => k.id === kind)?.label ?? "Report"} — Client Engagement Tracker`,
      `${teamLabel} · ${rangeLabel} · ${scoped.length} engagements`,
      buildBlocks(),
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
            <Select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Period">
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
        <StatCard icon="star" label="Average score" value={`${stats.avg}%`} tone="success" />
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
                  {buildBlocks()[0].headers.map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {buildBlocks()[0].rows.slice(0, 25).map((r, i) => (
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
