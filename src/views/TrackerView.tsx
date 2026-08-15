import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Card, CardHeader, EmptyState, Modal, ProgressBar, ScoreBadge, Textarea, useToast } from "../components/ui";
import { Icon } from "../components/icons";
import { ENGAGEMENT_ITEMS, PULSE_LABEL, PULSE_PROMPT, TOTAL_ITEMS } from "../lib/checklist";
import { buildTimelineFromSession } from "../lib/timeline";
import { effectiveScore, fmtDateTime } from "../lib/format";
import { useSpeech } from "../hooks/useSpeech";
import type { Route } from "../lib/router";

const SESSION_KEY = "qe-session-state-v2";

interface SessionState {
  checked: Record<string, boolean>;
  ticks: Record<string, number>;
  pulse: boolean;
  startedAt: number;
  transcript: string;
  notes: string;
}

function loadSession(name: string): SessionState {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY}:${name}`);
    if (raw) return { ...emptySession(), ...(JSON.parse(raw) as SessionState) };
  } catch {
    /* ignore */
  }
  return emptySession();
}

function emptySession(): SessionState {
  return { checked: {}, ticks: {}, pulse: false, startedAt: Date.now(), transcript: "", notes: "" };
}

export function TrackerView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const session = state.session!;
  const [sess, setSess] = useState<SessionState>(() => loadSession(session.name));
  const [historyOpen, setHistoryOpen] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(`${SESSION_KEY}:${session.name}`, JSON.stringify(sess));
    } catch {
      /* ignore */
    }
  }, [sess, session.name]);

  const checkedCount = ENGAGEMENT_ITEMS.filter((i) => sess.checked[i.category]).length;
  const liveScore = Math.round((checkedCount / TOTAL_ITEMS) * 100);
  const missed = ENGAGEMENT_ITEMS.filter((i) => !sess.checked[i.category]).map((i) => i.category);

  const myRecords = useMemo(
    () =>
      state.records
        .filter((r) => r.userName === session.name && r.team === session.team && r.status === "active")
        .sort((a, b) => b.savedAt - a.savedAt),
    [state.records, session.name, session.team],
  );

  const speech = useSpeech((category) => {
    setSess((s) => {
      if (s.checked[category]) return s;
      const seconds = (Date.now() - s.startedAt) / 1000;
      return { ...s, checked: { ...s.checked, [category]: true }, ticks: { ...s.ticks, [category]: seconds } };
    });
    toast.push(`${category} detected and ticked automatically`, "info");
  });

  const toggleItem = (category: string) => {
    setSess((s) => {
      const now = (Date.now() - s.startedAt) / 1000;
      if (s.checked[category]) {
        const next = { ...s.checked };
        delete next[category];
        const ticks = { ...s.ticks };
        delete ticks[category];
        return { ...s, checked: next, ticks };
      }
      return { ...s, checked: { ...s.checked, [category]: true }, ticks: { ...s.ticks, [category]: now } };
    });
  };

  const togglePulse = () => {
    setSess((s) => {
      const seconds = (Date.now() - s.startedAt) / 1000;
      return {
        ...s,
        pulse: !s.pulse,
        ticks: { ...s.ticks, [PULSE_LABEL]: s.pulse ? s.ticks[PULSE_LABEL] : seconds },
      };
    });
  };

  const saveCall = (dropped: boolean) => {
    if (savedRef.current) return;
    savedRef.current = true;
    const timeline = buildTimelineFromSession(sess.ticks, missed, sess.pulse);
    actions.saveEngagement({
      userName: session.name,
      team: session.team,
      checkedItems: ENGAGEMENT_ITEMS.filter((i) => sess.checked[i.category]).map((i) => i.category),
      missedItems: missed,
      pulseCompleted: sess.pulse,
      dropped,
      transcript: speech.transcript || sess.transcript || undefined,
      timeline,
      notes: sess.notes || undefined,
    });
    toast.push(dropped ? "Call saved as DROPPED for team review." : "Engagement saved to team history.");
    speech.reset();
    setSess(emptySession());
    window.setTimeout(() => {
      savedRef.current = false;
    }, 800);
  };

  const notSupported = !speech.supported;

  return (
    <div className="tracker-layout">
      <div className="tracker-main">
        <Card className="warm-card">
          <div className="warm-icon"><Icon name="headphones" size={18} /></div>
          <p>
            <strong>Live QA session</strong> — tick each step as it happens during the call. The speech assistant can
            auto-detect quality markers; your leader sees the full timeline with coaching opportunities.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Engagement checklist"
            subtitle="QA steps assessed on every client engagement"
            actions={
              <div className="summary-inline">
                <span className="summary-inline-item"><strong>{checkedCount}</strong>/{TOTAL_ITEMS}</span>
                <ScoreBadge score={liveScore} />
              </div>
            }
          />
          <ProgressBar value={liveScore} />
          <div className="checklist">
            {ENGAGEMENT_ITEMS.map((item, i) => {
              const on = !!sess.checked[item.category];
              return (
                <label key={item.category} className={on ? "checklist-item on" : "checklist-item"} htmlFor={`item-${i}`}>
                  <input
                    id={`item-${i}`}
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleItem(item.category)}
                  />
                  <span className="check-custom" aria-hidden="true"><Icon name="check" size={12} /></span>
                  <span className="item-body">
                    <strong>{item.category}</strong>
                    <span>{item.phrase}</span>
                  </span>
                  {sess.ticks[item.category] != null ? (
                    <span className="item-time">{Math.floor(sess.ticks[item.category] / 60)}m {Math.floor(sess.ticks[item.category] % 60)}s</span>
                  ) : null}
                </label>
              );
            })}
          </div>

          <div className="pulse-row">
            <label className={sess.pulse ? "pulse-tile on" : "pulse-tile"}>
              <input type="checkbox" checked={sess.pulse} onChange={togglePulse} />
              <span className="check-custom" aria-hidden="true"><Icon name="check" size={12} /></span>
              <span>
                <strong>Pulse Adoption</strong>
                <small>{PULSE_PROMPT}</small>
              </span>
            </label>
          </div>

          <Card className="notes-card">
            <label className="notes-label" htmlFor="callNotes">Coach note (visible to your leader)</label>
            <Textarea id="callNotes" rows={2} placeholder="Optional note about this engagement…" value={sess.notes} onChange={(e) => setSess((s) => ({ ...s, notes: e.target.value }))} />
          </Card>

          <div className="call-actions">
            <Button variant="primary" size="lg" icon="checkCircle" onClick={() => saveCall(false)}>Save engagement</Button>
            <Button variant="danger" size="lg" icon="alert" onClick={() => saveCall(true)}>Mark as dropped call</Button>
            <Button variant="ghost" size="lg" icon="history" onClick={() => setHistoryOpen(true)}>My history</Button>
          </div>
        </Card>
      </div>

      <aside className="tracker-side">
        <Card className={speech.listening ? "listen-card live" : "listen-card"}>
          <CardHeader title={<span className="listen-title"><span className="listen-dot" /> Live speech assistant</span>} subtitle="Chrome or Edge only — listens for quality phrases and ticks the checklist" />
          {notSupported ? (
            <EmptyState icon="mic" title="Speech not supported" description="This browser has no Web Speech API. Use Chrome or Edge, or tick the checklist manually." />
          ) : (
            <>
              <Button
                variant={speech.listening ? "danger" : "primary"}
                className="listen-btn"
                icon="mic"
                onClick={speech.toggle}
              >
                {speech.listening ? "Stop listening" : "Start listening"}
              </Button>
              <p className="listen-status">{speech.listening ? "Listening… detected phrases tick items automatically" : "Not listening"}</p>
              <div className="transcript-box">
                {speech.transcript ? speech.transcript : <span className="transcript-empty">Transcript appears here as you speak.</span>}
              </div>
              {speech.error ? <p className="speech-error">{speech.error}</p> : null}
            </>
          )}
        </Card>

        <Card className="missed-card">
          <CardHeader title="Remaining steps" subtitle="Recommended coaching focus" />
          {missed.length === 0 ? (
            <div className="missed-none"><Icon name="checkCircle" size={18} /> All steps completed — excellent!</div>
          ) : (
            <ul className="missed-list">
              {missed.map((m) => (
                <li key={m}><Icon name="alert" size={13} /> {m}</li>
              ))}
            </ul>
          )}
        </Card>
      </aside>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="My engagement history" wide>
        {myRecords.length === 0 ? (
          <EmptyState icon="history" title="No engagements yet" description="Save your first call and it will appear here." />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date &amp; time</th>
                  <th>Score</th>
                  <th>Completed</th>
                  <th>Pulse</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {myRecords.slice(0, 50).map((r) => (
                  <tr key={r.id} className="clickable" onClick={() => { setHistoryOpen(false); onNavigate({ name: "engagement", params: { id: r.id } }); }}>
                    <td>{fmtDateTime(r.savedAt)}</td>
                    <td><ScoreBadge score={effectiveScore(r)} /></td>
                    <td>{r.completed}/{r.total}</td>
                    <td>{r.pulseCompleted ? "Yes" : "No"}</td>
                    <td>{r.dropped ? <span className="badge badge-warning">Dropped</span> : <span className="badge badge-success">Saved</span>}</td>
                    <td><Icon name="chevronRight" size={14} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
