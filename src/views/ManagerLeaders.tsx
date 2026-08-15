import { useMemo } from "react";
import { useStore } from "../lib/store";
import { Badge, Card, CardHeader, EmptyState, ScoreBadge } from "../components/ui";
import { Icon } from "../components/icons";
import { Bars, TrendBadge } from "../components/charts";
import { avg, complianceScore, effectiveScore, pulseRate } from "../lib/format";
import type { Route } from "../lib/router";

export function ManagerLeaders({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { state } = useStore();
  const phrases = state.phrases;

  const rows = useMemo(() => {
    const leaders = state.users.filter((u) => u.role === "leader");
    const now = Date.now();
    const week = 7 * 86_400_000;
    return leaders.map((leader) => {
      const teamRecords = state.records.filter((r) => r.team === leader.team && r.status === "active");
      const knownAgents = new Set(
        state.users.filter((u) => u.role === "agent" && u.team === leader.team).map((u) => u.name),
      );
      for (const r of teamRecords) knownAgents.add(r.userName);
      const scores = teamRecords.map((r) => effectiveScore(r));
      const last7 = teamRecords.filter((r) => r.savedAt >= now - week);
      const prev7 = teamRecords.filter((r) => r.savedAt >= now - 2 * week && r.savedAt < now - week);
      const trend =
        avg(last7.map((r) => effectiveScore(r))) - avg(prev7.map((r) => effectiveScore(r)));
      return {
        name: leader.name,
        email: leader.email,
        team: leader.team,
        agents: knownAgents.size,
        engagements: teamRecords.length,
        avgScore: avg(scores),
        compliance: complianceScore(teamRecords, phrases, state.categories),
        pulse: pulseRate(teamRecords),
        dropped: teamRecords.filter((r) => r.dropped).length,
        trend,
      };
    });
  }, [state.users, state.records, phrases, state.categories]);

  const totals = useMemo(() => {
    const allTeams = new Set(rows.map((r) => r.team));
    const scoped = state.records.filter((r) => r.status === "active" && allTeams.has(r.team));
    return {
      leaders: rows.length,
      agents: new Set(state.users.filter((u) => u.role === "agent").map((u) => u.name)).size,
      avg: avg(scoped.map((r) => effectiveScore(r))),
      compliance: complianceScore(scoped, phrases, state.categories),
      pulse: pulseRate(scoped),
    };
  }, [rows, state.records, state.users, phrases, state.categories]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="No team leaders assigned yet"
        description="Assign the Team Leader role to users in Administration → Users & roles. Their team overview appears here."
      />
    );
  }

  return (
    <div className="leader-overview">
      <div className="stat-grid-4">
        <Card className="mini-stat"><span>Team leaders</span><strong>{totals.leaders}</strong><small>across {rows.length} team(s)</small></Card>
        <Card className="mini-stat"><span>Agents managed</span><strong>{totals.agents}</strong><small>in scoped teams</small></Card>
        <Card className="mini-stat"><span>Avg engagement score</span><strong>{totals.avg ? `${totals.avg}%` : "—"}</strong><small>across scoped teams</small></Card>
        <Card className="mini-stat"><span>Compliance</span><strong>{totals.compliance ? `${totals.compliance}%` : "—"}</strong><small>Pulse adoption {totals.pulse}%</small></Card>
      </div>

      <Card>
        <CardHeader title="Team leader performance" subtitle="Compare leaders on engagement, compliance and team outcomes" />
        <Bars
          max={100}
          items={rows.map((r) => ({
            label: r.team,
            value: r.avgScore,
            sub: r.name,
          }))}
        />
        <div className="table-wrap leader-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>Team leader</th>
                <th>Team</th>
                <th>Agents</th>
                <th>Engagements</th>
                <th>Avg score</th>
                <th>Compliance</th>
                <th>Pulse</th>
                <th>Trend (7d)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="clickable" onClick={() => onNavigate({ name: "dashboard" })}>
                  <td>
                    <strong>{r.name}</strong>
                    {r.email ? <span className="muted block">{r.email}</span> : null}
                  </td>
                  <td><Badge tone="neutral">{r.team}</Badge></td>
                  <td>{r.agents}</td>
                  <td>{r.engagements}</td>
                  <td>{r.engagements ? <ScoreBadge score={r.avgScore} /> : <span className="muted">—</span>}</td>
                  <td>{r.engagements ? `${r.compliance}%` : <span className="muted">—</span>}</td>
                  <td>{r.engagements ? `${r.pulse}%` : <span className="muted">—</span>}</td>
                  <td>
                    {r.engagements ? <TrendBadge current={r.avgScore + r.trend} previous={r.avgScore} /> : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="table-hint"><Icon name="info" size={13} /> Trend compares the last 7 days against the previous 7 days of engagements.</p>
      </Card>
    </div>
  );
}
