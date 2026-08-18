import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, ScoreBadge, SegmentedControl, Select, StatCard } from "../components/ui";
import { Icon } from "../components/icons";
import { Bars, dayLabels, Heatmap, LineChart, Sparkline, TrendBadge } from "../components/charts";
import { avg, complianceTone, fmtDate, pulseRate, scoreColor } from "../lib/format";
import {
  agentKey,
  averageScore,
  DAY_MS,
  filterRecords,
  groupBy,
  isoDay,
  lastReviewAt,
  rangeCutoff,
  scoresOf,
  sortedByDate,
  splitAgentKey,
  summarise,
  type DayRange,
} from "../lib/records";
import type { EngagementRecord } from "../lib/types";
import type { Route } from "../lib/router";

type Period = "daily" | "weekly" | "monthly";

interface AgentStat {
  name: string;
  team: string;
  records: EngagementRecord[];
  avg: number;
  last: number;
  pulse: number;
  trend: number;
  prevTrend: number;
  lastReview: number | null;
  noteCount: number;
  lastNoteType?: "strength" | "improvement";
}

function bucketKey(ts: number, period: Period): string {
  const d = new Date(ts);
  if (period === "daily") return isoDay(ts);
  if (period === "monthly") return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  return isoDay(monday.getTime());
}

function bucketLabel(key: string, period: Period): string {
  const d = new Date(`${key}T00:00:00`);
  if (period === "monthly") return d.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
}

export function LeaderView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { state } = useStore();
  const [period, setPeriod] = useState<Period>("daily");
  const [range, setRange] = useState<DayRange>("30");
  const [teamFilter, setTeamFilter] = useState("all");

  const cutoff = rangeCutoff(range);

  const scoped = useMemo(
    () => filterRecords(state.records, { status: "active", since: cutoff, team: teamFilter }),
    [state.records, cutoff, teamFilter],
  );

  const agentStats: AgentStat[] = useMemo(() => {
    const stats = [...groupBy(scoped, agentKey).entries()].map(([key, list]) => {
      const { name, team } = splitAgentKey(key);
      const sorted = sortedByDate(list, "oldest");
      const scores = scoresOf(sorted);
      const prev = scores.slice(-10, -5);
      const notes = state.notes.filter((n) => n.agentName === name && n.team === team);
      return {
        name,
        team,
        records: sorted,
        avg: avg(scores),
        last: scores[scores.length - 1] ?? 0,
        pulse: pulseRate(list),
        trend: avg(scores.slice(-5)),
        prevTrend: prev.length ? avg(prev) : avg(scores),
        lastReview: lastReviewAt(sorted),
        noteCount: notes.length,
        lastNoteType: notes[0]?.type,
      };
    });
    return stats.sort((a, b) => b.avg - a.avg);
  }, [scoped, state.notes]);

  const overall = useMemo(() => {
    const summary = summarise(scoped, state.phrases, state.categories);
    const totalAgents = new Set(
      state.users.filter((u) => u.role === "agent" || u.role === "leader").map((u) => `${u.name}|${u.team}`),
    ).size;
    return {
      ...summary,
      totalAgents: Math.max(totalAgents, agentStats.length),
      activeAgents: summary.agents,
    };
  }, [scoped, agentStats.length, state.users, state.phrases, state.categories]);

  const trendData = useMemo(() => {
    const buckets = groupBy(scoped, (r) => bucketKey(r.savedAt, period));
    const keys = [...buckets.keys()].sort();
    return {
      data: keys.map((k) => averageScore(buckets.get(k)!)),
      labels: keys.map((k) => bucketLabel(k, period)),
    };
  }, [scoped, period]);

  const teamComparison = useMemo(
    () =>
      [...groupBy(scoped, (r) => r.team).entries()]
        .map(([team, list]) => ({ label: team, value: averageScore(list) }))
        .sort((a, b) => b.value - a.value),
    [scoped],
  );

  const heatmap = useMemo(() => {
    const days = 14;
    const end = Date.now();
    const columns = dayLabels(days, end);
    const dayKeys = Array.from({ length: days }, (_, i) => isoDay(end - (days - 1 - i) * DAY_MS));
    const rows = agentStats.slice(0, 12).map((a) => {
      const byDay = groupBy(a.records, (r) => r.isoDate);
      return {
        label: a.name,
        values: dayKeys.map((key) => {
          const list = byDay.get(key);
          return list ? averageScore(list) : null;
        }),
      };
    });
    return { rows, columns };
  }, [agentStats]);

  return (
    <div className="dashboard">
      <div className="dashboard-controls">
        <div className="control-group">
          <SegmentedControl
            value={period}
            onChange={setPeriod}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
          <Select value={range} onChange={(e) => setRange(e.target.value as DayRange)} aria-label="Date range">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </Select>
          <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} aria-label="Team">
            <option value="all">All teams</option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </Select>
        </div>
        <Button variant="secondary" size="sm" icon="chart" onClick={() => onNavigate({ name: "reports" })}>
          Export report
        </Button>
      </div>

      <div className="stat-grid-4">
        <StatCard icon="users" label="Total agents" value={overall.totalAgents} sub="Across filtered scope" />
        <StatCard icon="user" label="Active agents" value={overall.activeAgents} sub="Recorded this period" tone="info" />
        <StatCard icon="star" label="Average engagement score" value={`${overall.avgScore}%`} sub={`${scoped.length} engagements`} tone="success" />
        <StatCard icon="shield" label="Compliance score" value={`${overall.compliance}%`} sub={`Pulse rate ${overall.pulse}%`} tone={complianceTone(overall.compliance)} />
      </div>

      <div className="dash-grid-2">
        <Card>
          <CardHeader
            title="Performance trend"
            subtitle={`Average engagement score — ${range === "all" ? "all time" : `last ${range} days`}`}
            actions={<div className="legend-inline"><span><i style={{ background: "var(--primary)" }} /> Avg score</span><span><i style={{ borderColor: "var(--accent)", borderStyle: "dashed" }} /> 7-period average</span></div>}
          />
          <LineChart data={trendData.data} labels={trendData.labels} />
        </Card>

        <Card>
          <CardHeader title="Agent leaderboard" subtitle="Ranked by average score" />
          {agentStats.length === 0 ? (
            <EmptyState icon="trophy" title="No agent data yet" description="Engagements will rank agents here." />
          ) : (
            <div className="leaderboard">
              {agentStats.slice(0, 8).map((a, i) => (
                <button key={`${a.name}|${a.team}`} type="button" className="leader-row" onClick={() => onNavigate({ name: "agent", params: { name: a.name, team: a.team } })}>
                  <span className={`rank ${i < 3 ? "top" : ""}`}>{i + 1}</span>
                  <Avatar name={a.name} size={30} />
                  <span className="leader-name">
                    <strong>{a.name}</strong>
                    <small>{a.team} · {a.records.length} calls</small>
                  </span>
                  <span className="leader-score" style={{ color: scoreColor(a.avg) }}>{a.avg}%</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Team comparison"
          subtitle="Average engagement score by team"
          actions={<Icon name="grid" size={16} />}
        />
        {teamComparison.length === 0 ? (
          <EmptyState icon="chart" title="No data" description="Record engagements to see team comparison." />
        ) : (
          <Bars items={teamComparison} />
        )}
      </Card>

      <Card>
        <CardHeader title="Agent performance heatmap" subtitle="Average score per agent per day (last 14 days)" />
        {heatmap.rows.length === 0 ? (
          <EmptyState icon="grid" title="No data yet" description="Heatmap appears once engagements are recorded." />
        ) : (
          <Heatmap rows={heatmap.rows} columns={heatmap.columns} />
        )}
      </Card>

      <Card>
        <CardHeader title="Agent overview" subtitle="Click an agent to open their performance profile" />
        {agentStats.length === 0 ? (
          <EmptyState icon="users" title="No agents with recorded engagements" description="Scores, trends and coaching status will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Team</th>
                  <th>Current</th>
                  <th>Average</th>
                  <th>Trend</th>
                  <th>Pulse</th>
                  <th>Coaching</th>
                  <th>Last reviewed</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {agentStats.map((a) => (
                  <tr key={`${a.name}|${a.team}`} className="clickable" onClick={() => onNavigate({ name: "agent", params: { name: a.name, team: a.team } })}>
                    <td>
                      <span className="cell-agent"><Avatar name={a.name} size={26} /><strong>{a.name}</strong></span>
                    </td>
                    <td><Badge tone="neutral">{a.team}</Badge></td>
                    <td><ScoreBadge score={a.last} /></td>
                    <td><ScoreBadge score={a.avg} /></td>
                    <td><TrendBadge current={a.trend} previous={a.prevTrend} /></td>
                    <td>{a.pulse}%</td>
                    <td>
                      {a.noteCount > 0 ? (
                        <span className={`coach-dot ${a.lastNoteType === "strength" ? "good" : "bad"}`} title={`${a.noteCount} coaching note${a.noteCount > 1 ? "s" : ""}`}>
                          {a.noteCount} note{a.noteCount > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                    <td>{a.lastReview ? fmtDate(a.lastReview) : <span className="muted">Never</span>}</td>
                    <td><Sparkline data={scoresOf(a.records).slice(-10)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
