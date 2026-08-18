import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, EngagementStatusBadge, Field, Modal, ScoreBadge, SegmentedControl, Select, StatCard, Textarea, useToast } from "../components/ui";
import { Bars, LineChart, TrendBadge } from "../components/charts";
import { avg, categoryPerformance, complianceTone, effectiveScore, fmtDate, fmtDateTime, yesNo } from "../lib/format";
import { filterRecords, rangeCutoff, scoresOf, sortedByDate, summarise, type DayRange } from "../lib/records";
import { Icon } from "../components/icons";
import type { Route } from "../lib/router";

export function AgentProfileView({ name, team, onNavigate }: { name: string; team: string; onNavigate: (r: Route) => void }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const session = state.session!;
  const [range, setRange] = useState<DayRange>("all");
  const [noteModal, setNoteModal] = useState(false);
  const [noteType, setNoteType] = useState<"strength" | "improvement">("strength");
  const [noteText, setNoteText] = useState("");

  const isSelf = session.name === name;
  const isLeader = session.role === "leader" || session.role === "manager" || session.role === "admin";
  if (!isSelf && session.role === "agent") {
    return <EmptyState icon="shield" title="Restricted" description="Agents can only view their own profile." />;
  }

  const all = sortedByDate(filterRecords(state.records, { status: "active", agent: name, team }));
  const scoped = all.filter((r) => r.savedAt >= rangeCutoff(range));
  const notes = state.notes.filter((n) => n.agentName === name && n.team === team).sort((a, b) => b.ts - a.ts);

  const scores = useMemo(() => scoresOf(scoped), [scoped]);
  const { avgScore, compliance, pulse } = summarise(scoped, state.phrases, state.categories);

  // Period comparison: most recent half vs previous half of the scoped history
  const { recent, previous } = useMemo(() => {
    const chronological = scoresOf(sortedByDate(scoped, "oldest"));
    const half = Math.floor(chronological.length / 2);
    return { recent: avg(chronological.slice(half)), previous: avg(chronological.slice(0, half)) };
  }, [scoped]);

  const cats = useMemo(() => categoryPerformance(scoped, state.phrases, state.categories), [scoped, state.phrases, state.categories]);
  const strengths = cats.filter((c) => c.rate >= 70 && c.done > 0);
  const weaknesses = cats.filter((c) => c.rate < 70).sort((a, b) => a.rate - b.rate);

  const trend = useMemo(() => {
    const sorted = sortedByDate(scoped, "oldest");
    return { data: scoresOf(sorted), labels: sorted.map((r) => fmtDate(r.savedAt).slice(0, 6)) };
  }, [scoped]);

  const submitNote = () => {
    if (!noteText.trim()) return toast.push("Write the coaching note first", "error");
    actions.addNote(name, team, noteType, noteText.trim());
    toast.push("Coaching note added");
    setNoteModal(false);
    setNoteText("");
  };

  const user = state.users.find((u) => u.name === name && u.team === team);

  return (
    <div className="agent-profile">
      <div className="page-toolbar">
        <Button variant="ghost" icon="chevronRight" className="back-btn" onClick={() => onNavigate({ name: "dashboard" })}>
          Dashboard
        </Button>
        <div className="toolbar-spacer" />
        {isLeader ? (
          <Button variant="secondary" size="sm" icon="message" onClick={() => setNoteModal(true)}>
            Add coaching note
          </Button>
        ) : null}
      </div>

      <Card className="agent-hero">
        <Avatar name={name} size={64} />
        <div className="agent-hero-info">
          <h2>{name}</h2>
          <p>
            <Badge tone="neutral">{team}</Badge>{" "}
            {user ? <Badge tone="info">{user.role === "leader" ? "Team Leader" : user.role === "agent" ? "Agent" : "Manager"}</Badge> : null}
          </p>
        </div>
        <div className="agent-hero-stats">
          <div><span>Average score</span><strong>{avgScore}%</strong></div>
          <div><span>Engagements</span><strong>{scoped.length}</strong></div>
          <div><span>Compliance</span><strong>{compliance}%</strong></div>
          <div><span>Pulse rate</span><strong>{pulse}%</strong></div>
          <div><span>Trend</span><TrendBadge current={recent} previous={previous} /></div>
        </div>
      </Card>

      <div className="profile-controls">
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "all", label: "All time" },
          ]}
        />
      </div>

      <div className="stat-grid-4">
        <StatCard icon="star" label="Current average" value={`${avgScore}%`} tone="success" sub={`${scoped.length} engagements in scope`} />
        <StatCard icon="shield" label="Compliance score" value={`${compliance}%`} tone={complianceTone(compliance)} sub="Regulatory steps adherence" />
        <StatCard icon="checkCircle" label="Best score" value={scores.length ? `${Math.max(...scores)}%` : "—"} tone="info" sub={scores.length ? "Most recent period" : "No data"} />
        <StatCard icon="history" label="Last engagement" value={scoped.length ? fmtDate(scoped[0].savedAt) : "—"} sub={scoped.length ? `${scoped[0].completed}/${scoped[0].total} steps` : "No data"} />
      </div>

      <div className="dash-grid-2">
        <Card>
          <CardHeader title="Score trend" subtitle={`Engagement score over time (${range === "all" ? "all history" : `last ${range} days`})`} />
          {trend.data.length === 0 ? (
            <EmptyState icon="chart" title="No data in this period" description="Extend the date range or record engagements." />
          ) : (
            <LineChart data={trend.data} labels={trend.labels} />
          )}
        </Card>

        <Card>
          <CardHeader title="Category performance" subtitle="Checklist step completion rate" />
          {cats.length === 0 ? (
            <EmptyState icon="checklist" title="No data" description="Complete engagements to see category performance." />
          ) : (
            <Bars items={cats.map((c) => ({ label: c.category, value: c.rate, sub: `${c.done}/${c.done + c.missed}` }))} />
          )}
        </Card>
      </div>

      <div className="dash-grid-2">
        <Card>
          <CardHeader title="Strengths" subtitle="Steps demonstrated ≥ 70% of the time" />
          {strengths.length === 0 ? (
            <EmptyState icon="star" title="Not enough data" description="Strengths appear once there are engagements in scope." />
          ) : (
            <ul className="strength-list">
              {strengths.map((s) => (
                <li key={s.category}>
                  <span><Icon name="checkCircle" size={15} /> {s.category}</span>
                  <ScoreBadge score={s.rate} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Areas for improvement" subtitle="Steps demonstrated under 70% — coaching focus" />
          {weaknesses.length === 0 ? (
            <EmptyState icon="trophy" title="No weak areas" description="Consistently strong across all checklist steps." />
          ) : (
            <ul className="strength-list weak">
              {weaknesses.map((s) => (
                <li key={s.category}>
                  <span><Icon name="alert" size={15} /> {s.category}</span>
                  <ScoreBadge score={s.rate} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Engagement history" subtitle={`${scoped.length} engagement${scoped.length === 1 ? "" : "s"} — click to open the full timeline`} />
        {scoped.length === 0 ? (
          <EmptyState icon="history" title="No engagements in scope" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Score</th>
                  <th>Steps</th>
                  <th>Pulse</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {scoped.slice(0, 100).map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => onNavigate({ name: "engagement", params: { id: r.id } })}>
                    <td>{fmtDateTime(r.savedAt)}</td>
                    <td><ScoreBadge score={effectiveScore(r)} /></td>
                    <td>{r.completed}/{r.total}</td>
                    <td>{yesNo(r.pulseCompleted)}</td>
                    <td><EngagementStatusBadge record={r} /></td>
                    <td>{r.reviewed ? fmtDate(r.reviewed.at) : <span className="muted">—</span>}</td>
                    <td><Icon name="chevronRight" size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Coaching history" subtitle={`${notes.length} note${notes.length === 1 ? "" : "s"} from leaders and managers`} />
        {notes.length === 0 ? (
          <EmptyState icon="message" title="No coaching notes yet" description="Leaders can add notes from here or from any engagement." />
        ) : (
          <div className="notes-grid">
            {notes.map((n) => (
              <div key={n.id} className="note-card">
                <span className={`note-dot ${n.type === "strength" ? "good" : "bad"}`} />
                <p>{n.text}</p>
                <small>{n.author} · {fmtDateTime(n.ts)}</small>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={noteModal} onClose={() => setNoteModal(false)} title={`Coaching note — ${name}`}>
        <Field label="Note type">
          <Select value={noteType} onChange={(e) => setNoteType(e.target.value as "strength" | "improvement")}>
            <option value="strength">Strength / positive</option>
            <option value="improvement">Area for improvement</option>
          </Select>
        </Field>
        <Field label="Note">
          <Textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Specific, actionable feedback tied to an observed behaviour…" />
        </Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setNoteModal(false)}>Cancel</Button>
          <Button icon="check" onClick={submitNote}>Save note</Button>
        </div>
      </Modal>
    </div>
  );
}
