import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useStore } from "../lib/store";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, ScoreBadge, Select, Textarea, useToast, type BadgeTone } from "../components/ui";
import { Icon } from "../components/icons";
import { buildTimelineForRecord, coachingRecommendations } from "../lib/timeline";
import { avg, complianceScore, effectiveScore, fmtDateTime, fmtTime } from "../lib/format";
import { resolveCategoryLabel } from "../lib/checklist";
import type { EventType, TimelineEvent } from "../lib/types";
import type { Route } from "../lib/router";

const EVENT_META: Record<EventType, { label: string; tone: BadgeTone }> = {
  greeting: { label: "Greeting", tone: "primary" },
  empathy: { label: "Empathy", tone: "info" },
  compliance: { label: "Compliance", tone: "success" },
  objection: { label: "Objection handling", tone: "warning" },
  quality: { label: "Quality", tone: "neutral" },
  upsell: { label: "Upsell moment", tone: "warning" },
  coaching: { label: "Coaching opportunity", tone: "danger" },
  pulse: { label: "Pulse", tone: "info" },
  system: { label: "System", tone: "neutral" },
};

const FILTERS: { id: EventType | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "greeting", label: "Greeting" },
  { id: "empathy", label: "Empathy" },
  { id: "compliance", label: "Compliance" },
  { id: "objection", label: "Objection" },
  { id: "quality", label: "Quality" },
  { id: "upsell", label: "Upsell" },
  { id: "coaching", label: "Coaching" },
  { id: "pulse", label: "Pulse" },
];

export function EngagementView({ id, onNavigate }: { id: string; onNavigate: (r: Route) => void }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const session = state.session!;
  const record = state.records.find((r) => r.id === id);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EventType | "all">("all");
  const [modal, setModal] = useState<null | "review" | "dispute" | "correct" | "delete">(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [newScore, setNewScore] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);

  const canManage = session.role === "manager" || session.role === "admin";
  const isOwn = record?.userName === session.name;
  const canView = isOwn || session.role !== "agent";
  const openDispute = state.disputes.find((d) => d.engagementId === id && d.status === "open");

  const timeline: TimelineEvent[] = useMemo(
    () => (record ? buildTimelineForRecord(record, state.categories, state.phrases) : []),
    [record, state.categories, state.phrases],
  );
  const events = useMemo(() => {
    const q = search.trim().toLowerCase();
    return timeline.filter((e) => {
      if (filter !== "all" && e.type !== filter) return false;
      if (q && !(`${e.label} ${e.detail}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [timeline, filter, search]);

  const agentOther = useMemo(
    () => (record ? state.records.filter((r) => r.userName === record.userName && r.team === record.team && r.id !== record.id && r.status === "active") : []),
    [record, state.records],
  );
  const peerAvg = avg(agentOther.map((r) => effectiveScore(r)));
  const peerBest = agentOther.length ? Math.max(...agentOther.map((r) => effectiveScore(r))) : 0;
  const teamCompliance = useMemo(
    () => complianceScore(state.records.filter((r) => r.status === "active"), state.phrases, state.categories),
    [state.records, state.phrases, state.categories],
  );
  const recordCompliance = useMemo(() => {
    if (!record) return 0;
    const comp = state.phrases.filter((p) => ["Verification", "Keeping Client Informed", "Recap_and_Summarise", "Call Closing"].includes(resolveCategoryLabel(state.categories, state.phrases, p.id)));
    const done = comp.filter((c) => record!.checkedItems.includes(c.id)).length;
    return comp.length ? Math.round((done / comp.length) * 100) : 0;
  }, [record, state.phrases, state.categories]);
  const recommendations = useMemo(
    () => (record ? coachingRecommendations(record, state.categories, state.phrases) : []),
    [record, state.categories, state.phrases],
  );

  if (!record) {
    return (
      <EmptyState
        icon="fileText"
        title="Engagement not found"
        description="It may have been deleted. Return to the list."
        action={<Button icon="chevronRight" onClick={() => onNavigate({ name: "engagements" })}>Back to engagements</Button>}
      />
    );
  }

  if (!canView) {
    return <EmptyState icon="shield" title="Restricted" description="You can only view your own engagements." />;
  }

  const jumpTo = (eid: string) => {
    document.getElementById(`evt-${eid}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const openDisputeModal = () => {
    setReason("");
    setModal("dispute");
  };

  const submitDispute = () => {
    if (!reason.trim()) return toast.push("Add a reason for the dispute", "error");
    actions.openDispute(record.id, reason.trim());
    toast.push("Dispute opened for manager review");
    setModal(null);
  };

  const submitReview = () => {
    if (!note.trim()) return toast.push("Write a review note first", "error");
    actions.reviewEngagement(record.id, note.trim());
    toast.push("Review saved — agent can see it in their history");
    setModal(null);
  };

  const submitCorrect = () => {
    const n = Number(newScore);
    if (!Number.isFinite(n) || n < 0 || n > 100) return toast.push("Enter a score between 0 and 100", "error");
    actions.correctScore(record.id, Math.round(n), "Manager score correction");
    toast.push(`Score corrected to ${Math.round(n)}% (audited)`);
    setModal(null);
  };

  const doArchive = () => {
    actions.archiveEngagement(record.id);
    toast.push("Engagement archived");
    onNavigate({ name: "engagements" });
  };

  const doDelete = () => {
    actions.deleteEngagement(record.id);
    toast.push("Engagement permanently deleted (audited)");
    onNavigate({ name: "engagements" });
  };

  const agentNotes = state.notes.filter((n) => n.agentName === record.userName && n.team === record.team).slice(0, 6);

  return (
    <div className="engagement-page">
      <div className="page-toolbar">
        <Button variant="ghost" icon="chevronRight" className="back-btn" onClick={() => onNavigate({ name: "engagements" })}>
          Back
        </Button>
        <div className="toolbar-spacer" />
        {session.role === "leader" || canManage ? (
          <Button variant="secondary" size="sm" icon="message" onClick={() => { setNote(""); setModal("review"); }}>
            Add review
          </Button>
        ) : null}
        {!openDispute ? (
          <Button variant="outline" size="sm" icon="flag" onClick={openDisputeModal}>
            Open dispute
          </Button>
        ) : (
          <Badge tone="warning">Dispute open</Badge>
        )}
        {canManage ? (
          <>
            <Button variant="secondary" size="sm" icon="edit" onClick={() => { setNewScore(String(effectiveScore(record))); setModal("correct"); }}>
              Correct score
            </Button>
            {record.status === "active" ? (
              <Button variant="secondary" size="sm" icon="archive" onClick={doArchive}>Archive</Button>
            ) : (
              <Button variant="secondary" size="sm" icon="refresh" onClick={() => { actions.restoreEngagement(record.id); toast.push("Engagement restored"); }}>
                Restore
              </Button>
            )}
            <Button variant="danger" size="sm" icon="trash" onClick={() => setModal("delete")}>Delete</Button>
          </>
        ) : null}
      </div>

      <div className="engagement-head">
        <div>
          <div className="engagement-agent">
            <h2>{record.userName}</h2>
            <Badge tone="neutral">{record.team}</Badge>
            {record.dropped ? <Badge tone="warning">Dropped call</Badge> : null}
            {record.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
            {record.corrected ? <Badge tone="info">Corrected</Badge> : null}
            {record.reviewed ? <Badge tone="success">Reviewed</Badge> : null}
          </div>
          <p className="engagement-meta">{fmtDateTime(record.savedAt)}</p>
        </div>
        <div className="score-ring" style={{ "--pct": `${effectiveScore(record)}%` } as CSSProperties}>
          <strong>{effectiveScore(record)}%</strong>
          <span>Engagement score</span>
        </div>
      </div>

      <div className="stat-grid-4">
        <Card className="mini-stat"><span>Quality score</span><strong>{record.completed}/{record.total} steps</strong><ScoreBadge score={Math.round((record.completed / record.total) * 100)} /></Card>
        <Card className="mini-stat"><span>Compliance score</span><strong>{recordCompliance}%</strong><small>vs team {teamCompliance}%</small></Card>
        <Card className="mini-stat"><span>Pulse adoption</span><strong>{record.pulseCompleted ? "Adopted" : "Not adopted"}</strong><small>{record.pulseCompleted ? "Great coaching culture" : "Coach on adopting Pulse"}</small></Card>
        <Card className="mini-stat"><span>Agent average</span><strong>{peerAvg ? `${peerAvg}%` : "—"}</strong><small>{peerBest ? `Best: ${peerBest}%` : "First recorded call"}</small></Card>
      </div>

      {record.corrected ? (
        <Card className="correction-banner">
          <Icon name="edit" size={16} />
          <span>
            Score corrected by <strong>{record.corrected.by}</strong> from <strong>{record.corrected.oldScore}%</strong> to{" "}
            <strong>{record.corrected.newScore}%</strong> — {record.corrected.reason} ({fmtDateTime(record.corrected.at)})
          </span>
        </Card>
      ) : null}

      <div className="engagement-grid">
        <Card>
          <CardHeader
            title="Engagement timeline"
            subtitle="Timestamped quality markers captured during the call"
            actions={
              <div className="timeline-controls">
                <div className="search-box">
                  <Icon name="search" size={14} />
                  <Input placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search timeline events" />
                </div>
                <Select value={filter} onChange={(e) => setFilter(e.target.value as EventType | "all")} aria-label="Filter events">
                  {FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </Select>
              </div>
            }
          />
          <div className="timeline" ref={timelineRef}>
            {events.length === 0 ? (
              <EmptyState icon="clock" title="No matching events" description="Try a different search or filter." />
            ) : (
              events.map((e) => {
                const meta = EVENT_META[e.type] ?? EVENT_META.system;
                return (
                  <button
                    key={e.id}
                    type="button"
                    id={`evt-${e.id}`}
                    className={e.missed ? "timeline-event missed" : "timeline-event"}
                    onClick={() => jumpTo(e.id)}
                  >
                    <span className="timeline-time">{fmtTime(e.seconds)}</span>
                    <span className={`timeline-dot tone-${meta.tone}`} />
                    <span className="timeline-body">
                      <strong>{e.label}</strong>
                      <small>{e.detail}</small>
                      <span className="timeline-tags">
                        <Badge tone={meta.tone} className="timeline-tag">{meta.label}</Badge>
                        {e.source ? <Badge tone={e.source === "speech" ? "info" : "neutral"} className="timeline-tag">{e.source === "speech" ? "Speech" : "Manual"}</Badge> : null}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <div className="timeline-hint">
            <Icon name="info" size={13} /> Click any event to jump to it. Missed markers are coaching opportunities.
          </div>
        </Card>

        <div className="engagement-side">
          <Card className="ai-card">
            <CardHeader title={<span className="ai-title"><Icon name="sparkles" size={16} /> AI insights</span>} subtitle="Automatically generated from this engagement" />
            <div className="ai-section">
              <h4>Strengths</h4>
              {record.checkedItems.length ? (
                <ul className="ai-list good">
                  {record.checkedItems.map((c) => <li key={c}><Icon name="checkCircle" size={13} /> {resolveCategoryLabel(state.categories, state.phrases, c)}</li>)}
                </ul>
              ) : (
                <p className="ai-empty">No steps captured.</p>
              )}
            </div>
            <div className="ai-section">
              <h4>Areas for improvement</h4>
              {record.missedItems.length ? (
                <ul className="ai-list bad">
                  {record.missedItems.map((c) => <li key={c}><Icon name="alert" size={13} /> {resolveCategoryLabel(state.categories, state.phrases, c)}</li>)}
                </ul>
              ) : (
                <p className="ai-empty">All steps completed — outstanding.</p>
              )}
            </div>
            <div className="ai-section">
              <h4>Coaching recommendations</h4>
              {recommendations.length ? (
                <ul className="ai-list coach">
                  {recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              ) : (
                <p className="ai-empty">No coaching needed on this call.</p>
              )}
            </div>
            <div className="ai-section">
              <h4>Historical comparison</h4>
              <p className="ai-compare">
                This call scores <strong>{effectiveScore(record)}%</strong> vs the agent's {agentOther.length} previous
                engagements averaging <strong>{peerAvg ? `${peerAvg}%` : "—"}</strong>.
                {peerAvg > 0 ? (effectiveScore(record) >= peerAvg ? " Trending at or above their usual level." : " Below their usual level — worth a coaching conversation.") : ""}
              </p>
            </div>
          </Card>

          {agentNotes.length ? (
            <Card>
              <CardHeader title="Coaching history" subtitle={`Recent notes for ${record.userName}`} />
              <div className="notes-list">
                {agentNotes.map((n) => (
                  <div key={n.id} className="note-item">
                    <span className={`note-dot ${n.type === "strength" ? "good" : "bad"}`} />
                    <p>{n.text}</p>
                    <small>{n.author} · {fmtDateTime(n.ts)}</small>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {record.transcript ? (
            <Card>
              <CardHeader title="Transcript" subtitle="Captured via speech assistant" />
              <div className="transcript-box tall">{record.transcript}</div>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Review modal */}
      <Modal open={modal === "review"} onClose={() => setModal(null)} title={`Review — ${record.userName}`}>
        <Field label="Review note">
          <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Strong closing this week; work on empathy phrasing." />
        </Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button icon="check" onClick={submitReview}>Save review</Button>
        </div>
      </Modal>

      {/* Dispute modal */}
      <Modal open={modal === "dispute"} onClose={() => setModal(null)} title="Open a dispute">
        <p className="modal-intro">
          Flag this engagement for manager review. Include the reason and any context — the manager can adjust the score or reject the dispute.
        </p>
        <Field label="Reason for dispute">
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Step was completed verbally but not ticked — customer confirmed on replay." />
        </Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button icon="flag" onClick={submitDispute}>Submit dispute</Button>
        </div>
      </Modal>

      {/* Correct score modal */}
      <Modal open={modal === "correct"} onClose={() => setModal(null)} title="Correct engagement score">
        <p className="modal-intro">All score corrections are written to the audit log with your name and timestamp.</p>
        <Field label="New score (%)">
          <Input type="number" min={0} max={100} value={newScore} onChange={(e) => setNewScore(e.target.value)} />
        </Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button icon="check" onClick={submitCorrect}>Apply correction</Button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal open={modal === "delete"} onClose={() => setModal(null)} title="Delete engagement permanently?">
        <p className="modal-intro">This cannot be undone. A permanent audit entry is recorded with your name, the previous value and timestamp.</p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" icon="trash" onClick={doDelete}>Delete permanently</Button>
        </div>
      </Modal>
    </div>
  );
}
