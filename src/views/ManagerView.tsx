import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, ScoreBadge, Select, Tabs, Textarea, useToast } from "../components/ui";
import { Icon } from "../components/icons";
import { effectiveScore, fmtDateTime } from "../lib/format";
import type { Dispute } from "../lib/types";
import type { Route } from "../lib/router";

type Tab = "engagements" | "disputes" | "audit";

export function ManagerView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("engagements");
  const [team, setTeam] = useState("all");
  const [agent, setAgent] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "archived">("all");
  const [query, setQuery] = useState("");

  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [adjusted, setAdjusted] = useState("");

  const agents = useMemo(() => {
    const set = new Set(state.records.map((r) => r.userName));
    return [...set].sort();
  }, [state.records]);

  const engagements = useMemo(
    () =>
      state.records
        .filter((r) => team === "all" || r.team === team)
        .filter((r) => agent === "all" || r.userName === agent)
        .filter((r) => status === "all" || r.status === status)
        .filter((r) => !query || `${r.userName} ${r.team}`.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.savedAt - a.savedAt),
    [state.records, team, agent, status, query],
  );

  const disputes = useMemo(() => [...state.disputes].sort((a, b) => b.openedAt - a.openedAt), [state.disputes]);
  const openCount = disputes.filter((d) => d.status === "open").length;
  const audit = useMemo(() => [...state.audit].sort((a, b) => b.ts - a.ts).slice(0, 200), [state.audit]);

  const resolveDispute = (d: Dispute, outcome: "approved" | "rejected") => {
    if (!resolution.trim()) return toast.push("Add a resolution note", "error");
    const adj = outcome === "approved" && adjusted !== "" ? Number(adjusted) : undefined;
    if (adj != null && (!Number.isFinite(adj) || adj < 0 || adj > 100)) return toast.push("Adjusted score must be 0–100", "error");
    actions.resolveDispute(d.id, outcome, resolution.trim(), adj);
    toast.push(outcome === "approved" ? "Dispute approved — score adjusted and audited" : "Dispute rejected");
    setResolveId(null);
    setResolution("");
    setAdjusted("");
  };

  const disputeFor = (d: Dispute) => state.records.find((r) => r.id === d.engagementId);

  return (
    <div className="manager-page">
      <Tabs
        tabs={[
          { id: "engagements", label: "Engagements", icon: "fileText" },
          { id: "disputes", label: "Disputes", icon: "flag", count: openCount },
          { id: "audit", label: "Audit log", icon: "shield" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "engagements" ? (
        <Card>
          <CardHeader
            title="Engagement management"
            subtitle="View, correct, archive, restore and delete engagements — every action is audited"
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
                  <Input placeholder="Search agent or team…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search engagements" />
                </div>
              </div>
            }
          />
          {engagements.length === 0 ? (
            <EmptyState icon="fileText" title="No engagements match" description="Adjust the filters or record engagements first." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Team</th>
                    <th>Date &amp; time</th>
                    <th>Score</th>
                    <th>Pulse</th>
                    <th>Status</th>
                    <th aria-label="Actions" className="actions-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {engagements.slice(0, 100).map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.userName}</strong></td>
                      <td><Badge tone="neutral">{r.team}</Badge></td>
                      <td>{fmtDateTime(r.savedAt)}</td>
                      <td>
                        <ScoreBadge score={effectiveScore(r)} />
                        {r.corrected ? <span className="corrected-mark" title={`Corrected by ${r.corrected.by}`}> ✎</span> : null}
                      </td>
                      <td>{r.pulseCompleted ? "Yes" : "No"}</td>
                      <td>
                        {r.status === "archived" ? <Badge tone="neutral">Archived</Badge> : r.dropped ? <Badge tone="warning">Dropped</Badge> : <Badge tone="success">Active</Badge>}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="Open engagement" onClick={() => onNavigate({ name: "engagement", params: { id: r.id } })}>
                            <Icon name="eye" size={15} />
                          </button>
                          {r.status === "active" ? (
                            <button type="button" className="icon-btn" title="Archive" onClick={() => { actions.archiveEngagement(r.id); toast.push("Archived"); }}>
                              <Icon name="archive" size={15} />
                            </button>
                          ) : (
                            <button type="button" className="icon-btn" title="Restore" onClick={() => { actions.restoreEngagement(r.id); toast.push("Restored"); }}>
                              <Icon name="refresh" size={15} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-btn danger"
                            title="Delete permanently"
                            onClick={() => {
                              if (window.confirm(`Permanently delete ${r.userName}'s engagement from ${fmtDateTime(r.savedAt)}? This is audited and cannot be undone.`)) {
                                actions.deleteEngagement(r.id);
                                toast.push("Deleted (audited)");
                              }
                            }}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {tab === "disputes" ? (
        <Card>
          <CardHeader
            title="Dispute handling"
            subtitle="Agents and leaders can flag engagements; managers approve (with score adjustment) or reject. Fully tracked."
          />
          {disputes.length === 0 ? (
            <EmptyState icon="flag" title="No disputes" description="Disputes raised on engagements will appear here for review." />
          ) : (
            <div className="dispute-list">
              {disputes.map((d) => {
                const rec = disputeFor(d);
                return (
                  <div key={d.id} className={`dispute-card status-${d.status}`}>
                    <div className="dispute-head">
                      <span className={`dispute-flag status-${d.status}`}>
                        <Icon name="flag" size={14} /> {d.status.toUpperCase()}
                      </span>
                      <strong>{d.agentName}</strong>
                      <Badge tone="neutral">{d.team}</Badge>
                      <span className="dispute-score">Original: {d.score}%</span>
                      {d.adjustedScore != null ? <span className="dispute-score adjusted">Adjusted: {d.adjustedScore}%</span> : null}
                      <span className="dispute-meta">{d.openedBy} · {fmtDateTime(d.openedAt)}</span>
                    </div>
                    <p className="dispute-reason">{d.reason}</p>
                    {d.status === "open" ? (
                      <div className="dispute-actions">
                        {rec ? (
                          <Button variant="ghost" size="sm" icon="eye" onClick={() => onNavigate({ name: "engagement", params: { id: rec.id } })}>
                            View engagement
                          </Button>
                        ) : null}
                        <Button variant="primary" size="sm" icon="check" onClick={() => { setResolveId(d.id); setAdjusted(String(d.score)); setResolution(""); }}>
                          Review &amp; resolve
                        </Button>
                      </div>
                    ) : (
                      <p className="dispute-resolution">
                        <Icon name={d.status === "approved" ? "checkCircle" : "xCircle"} size={14} />
                        {d.resolution} — by {d.resolvedBy} on {d.resolvedAt ? fmtDateTime(d.resolvedAt) : ""}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "audit" ? (
        <Card>
          <CardHeader
            title="Audit log"
            subtitle="Every change, who made it, the previous value, the new value and a timestamp"
          />
          {audit.length === 0 ? (
            <EmptyState icon="shield" title="No audit entries yet" />
          ) : (
            <div className="table-wrap">
              <table className="data-table audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((e) => (
                    <tr key={e.id}>
                      <td className="mono">{fmtDateTime(e.ts)}</td>
                      <td><strong>{e.actor}</strong></td>
                      <td><Badge tone={e.action.includes("deleted") || e.action.includes("rejected") ? "danger" : e.action.includes("created") || e.action.includes("saved") || e.action.includes("approved") || e.action.includes("restored") ? "success" : "info"}>{e.action}</Badge></td>
                      <td>{e.entity}{e.entityId ? <span className="muted"> · {e.entityId.slice(0, 12)}…</span> : null}</td>
                      <td className="audit-detail mono">
                        {e.oldValue != null ? <span className="audit-old">- {JSON.stringify(e.oldValue).slice(0, 140)}</span> : null}
                        {e.newValue != null ? <span className="audit-new">+ {JSON.stringify(e.newValue).slice(0, 140)}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}

      {resolveId ? (
        (() => {
          const d = disputes.find((x) => x.id === resolveId);
          if (!d) return null;
          return (
            <Modal open onClose={() => setResolveId(null)} title={`Resolve dispute — ${d.agentName}`} wide>
              <p className="modal-intro">
                {d.reason}
              </p>
              <div className="resolve-grid">
                <Field label="Resolution note (required)">
                  <Textarea rows={4} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Verified on replay — step was indeed completed. Score updated." />
                </Field>
                <Field label="Adjusted score if approved (%)">
                  <Input type="number" min={0} max={100} value={adjusted} onChange={(e) => setAdjusted(e.target.value)} />
                </Field>
              </div>
              <div className="modal-actions">
                <Button variant="ghost" onClick={() => setResolveId(null)}>Cancel</Button>
                <Button variant="danger" icon="x" onClick={() => resolveDispute(d, "rejected")}>Reject dispute</Button>
                <Button variant="primary" icon="check" onClick={() => resolveDispute(d, "approved")}>Approve &amp; adjust score</Button>
              </div>
            </Modal>
          );
        })()
      ) : null}
    </div>
  );
}
