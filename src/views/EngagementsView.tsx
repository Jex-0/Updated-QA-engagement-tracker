import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Badge, Card, CardHeader, EmptyState, Input, ScoreBadge, Select } from "../components/ui";
import { Icon } from "../components/icons";
import { effectiveScore, fmtDateTime } from "../lib/format";
import type { Route } from "../lib/router";

export function EngagementsView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { state } = useStore();
  const [team, setTeam] = useState("all");
  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "archived">("all");
  const [query, setQuery] = useState("");

  const agents = useMemo(() => [...new Set(state.records.map((r) => r.userName))].sort(), [state.records]);

  const list = useMemo(
    () =>
      state.records
        .filter((r) => team === "all" || r.team === team)
        .filter((r) => agent === "all" || r.userName === agent)
        .filter((r) => status === "all" || r.status === status)
        .filter((r) => !query || `${r.userName} ${r.team}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.savedAt - a.savedAt),
    [state.records, team, agent, status, query],
  );

  return (
    <Card>
      <CardHeader
        title="Team engagements"
        subtitle="Every engagement across your teams — open one for the full timeline and coaching view"
        actions={
          <div className="filter-row">
            <Select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
              <option value="all">All teams</option>
              {state.teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
            <Select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agent">
              <option value="all">All agents</option>
              {agents.map((a) => <option key={a} value={a}>{a}</option>)}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
            <div className="search-box">
              <Icon name="search" size={14} />
              <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search engagements" />
            </div>
          </div>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon="fileText" title="No engagements yet" description="Adjust filters or wait for agents to record calls." />
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Team</th>
                <th>Date &amp; time</th>
                <th>Score</th>
                <th>Steps</th>
                <th>Pulse</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, 150).map((r) => (
                <tr key={r.id} className="clickable" onClick={() => onNavigate({ name: "engagement", params: { id: r.id } })}>
                  <td><strong>{r.userName}</strong></td>
                  <td><Badge tone="neutral">{r.team}</Badge></td>
                  <td>{fmtDateTime(r.savedAt)}</td>
                  <td><ScoreBadge score={effectiveScore(r)} /></td>
                  <td>{r.completed}/{r.total}</td>
                  <td>{r.pulseCompleted ? "Yes" : "No"}</td>
                  <td>
                    {r.status === "archived" ? <Badge tone="neutral">Archived</Badge> : r.dropped ? <Badge tone="warning">Dropped</Badge> : <Badge tone="success">Saved</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
