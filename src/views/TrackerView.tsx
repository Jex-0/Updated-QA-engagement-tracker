import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../lib/store";
import { Button, Card, CardHeader, EmptyState, Modal, ProgressBar, ScoreBadge, Textarea, useToast } from "../components/ui";
import { Icon } from "../components/icons";
import { buildKeywordMap, PULSE_LABEL, PULSE_PROMPT } from "../lib/checklist";
import { buildTimelineFromSession } from "../lib/timeline";
import { effectiveScore, fmtDateTime, fmtTime } from "../lib/format";
import { useSpeech } from "../hooks/useSpeech";
import type { Route } from "../lib/router";

const SESSION_KEY = "qe-session-state-v2";

interface SessionState {
  /** phrase id → checked */
  checked: Record<string, boolean>;
  /** phrase id → seconds into the call when captured */
  ticks: Record<string, number>;
  /** phrase id → chosen alternative phrasing ("" = standard) */
  variants: Record<string, string>;
  /** phrase id → how it was captured */
  sources: Record<string, "speech" | "manual">;
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
  return { checked: {}, ticks: {}, variants: {}, sources: {}, pulse: false, startedAt: Date.now(), transcript: "", notes: "" };
}

export function TrackerView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const session = state.session!;
  const [sess, setSess] = useState<SessionState>(() => loadSession(session.name));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const savedRef = useRef(false);

  const phrases = state.phrases;
  const categories = state.categories;
  const manualEnabled = state.settings.manualTickEnabled;

  useEffect(() => {
    try {
      localStorage.setItem(`${SESSION_KEY}:${session.name}`, JSON.stringify(sess));
    } catch {
      /* ignore */
    }
  }, [sess, session.name]);

  const checkedCount = phrases.filter((p) => sess.checked[p.id]).length;
  const liveScore = Math.round((checkedCount / Math.max(phrases.length, 1)) * 100);
  const missed = phrases.filter((p) => !sess.checked[p.id]).map((p) => p.id);

  const myRecords = useMemo(
    () =>
      state.records
        .filter((r) => r.userName === session.name && r.team === session.team && r.status === "active")
        .sort((a, b) => b.savedAt - a.savedAt),
    [state.records, session.name, session.team],
  );

  const keywordMap = useMemo(() => buildKeywordMap(phrases), [phrases]);

  const speech = useSpeech(keywordMap, (phraseId) => {
    setSess((s) => {
      if (s.checked[phraseId]) return s;
      const seconds = (Date.now() - s.startedAt) / 1000;
      return {
        ...s,
        checked: { ...s.checked, [phraseId]: true },
        ticks: { ...s.ticks, [phraseId]: seconds },
        sources: { ...s.sources, [phraseId]: "speech" },
      };
    });
    const phrase = phrases.find((p) => p.id === phraseId);
    const cat = categories.find((c) => c.id === phrase?.categoryId);
    toast.push(`${cat?.name ?? phraseId} detected — ticked automatically at ${fmtTime(secondsNow())}`, "info");
  });

  /** helper for the toast above */
  function secondsNow(): number {
    return (Date.now() - sess.startedAt) / 1000;
  }

  const untick = (phraseId: string) => {
    setSess((s) => {
      const checked = { ...s.checked };
      delete checked[phraseId];
      const ticks = { ...s.ticks };
      delete ticks[phraseId];
      const variants = { ...s.variants };
      delete variants[phraseId];
      const sources = { ...s.sources };
      delete sources[phraseId];
      return { ...s, checked, ticks, variants, sources };
    });
  };

  const tickManual = (phraseId: string, variant: string) => {
    const seconds = (Date.now() - sess.startedAt) / 1000;
    setSess((s) => ({
      ...s,
      checked: { ...s.checked, [phraseId]: true },
      ticks: { ...s.ticks, [phraseId]: seconds },
      variants: { ...s.variants, [phraseId]: variant },
      sources: { ...s.sources, [phraseId]: "manual" },
    }));
    setOpenPicker(null);
    const phrase = phrases.find((p) => p.id === phraseId);
    const cat = categories.find((c) => c.id === phrase?.categoryId);
    toast.push(variant ? `${cat?.name ?? phraseId} ticked (variation: “${variant}”)` : `${cat?.name ?? phraseId} ticked`);
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
    const timeline = buildTimelineFromSession(categories, phrases, sess.ticks, sess.variants, sess.sources, missed, sess.pulse);
    actions.saveEngagement({
      userName: session.name,
      team: session.team,
      checkedItems: phrases.filter((p) => sess.checked[p.id]).map((p) => p.id),
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
    setOpenPicker(null);
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
            <strong>Live QA session</strong> — phrases are captured automatically by the speech assistant with an exact
            timestamp. Your leader sees the full timeline with coaching opportunities.
          </p>
        </Card>

        {!manualEnabled ? (
          <Card className="lock-card">
            <div className="lock-icon"><Icon name="shield" size={16} /></div>
            <p>
              <strong>Manual ticking is switched off.</strong> Phrases are captured automatically by the speech assistant only.
              If speech isn't available in your browser, ask your manager to enable manual ticking (one click, applies to everyone).
            </p>
          </Card>
        ) : null}

        <Card>
          <CardHeader
            title="Engagement checklist"
            subtitle={manualEnabled ? "Tap a phrase to choose the variation that was said — it ticks either way" : "Auto-captured by the speech assistant with timestamps"}
            actions={
              <div className="summary-inline">
                <span className="summary-inline-item"><strong>{checkedCount}</strong>/{phrases.length}</span>
                <ScoreBadge score={liveScore} />
              </div>
            }
          />
          <ProgressBar value={liveScore} />
          <div className="checklist">
            {categories.map((cat) => {
              const catPhrases = phrases.filter((p) => p.categoryId === cat.id);
              if (!catPhrases.length) return null;
              return (
                <div key={cat.id} className="checklist-group">
                  {catPhrases.map((phrase) => {
                    const on = !!sess.checked[phrase.id];
                    const seconds = sess.ticks[phrase.id];
                    const source = sess.sources[phrase.id];
                    const variant = sess.variants[phrase.id];
                    if (on) {
                      return (
                        <div key={phrase.id} className={`checklist-item on ${source === "speech" ? "auto" : "manual"}`}>
                          <span className="check-custom" aria-hidden="true"><Icon name="check" size={12} /></span>
                          <span className="item-body">
                            <strong>{cat.name}</strong>
                            <span>{variant ? `“${variant}”` : phrase.text}</span>
                            {source ? <em className="source-chip">{source === "speech" ? "Speech detected" : "Manual"}</em> : null}
                          </span>
                          {seconds != null ? <span className="item-time mono">{fmtTime(seconds)}</span> : null}
                          <button type="button" className="icon-btn item-undo" title="Untick" onClick={() => untick(phrase.id)}>
                            <Icon name="x" size={13} />
                          </button>
                        </div>
                      );
                    }
                    if (!manualEnabled) {
                      return (
                        <div key={phrase.id} className="checklist-item locked">
                          <span className="check-custom" aria-hidden="true"><Icon name="lock" size={11} /></span>
                          <span className="item-body">
                            <strong>{cat.name}</strong>
                            <span>{phrase.text}</span>
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div key={phrase.id} className="checklist-item pickable">
                        <button
                          type="button"
                          className="item-picker"
                          aria-expanded={openPicker === phrase.id}
                          onClick={() => setOpenPicker(openPicker === phrase.id ? null : phrase.id)}
                        >
                          <span className="check-custom" aria-hidden="true" />
                          <span className="item-body">
                            <strong>{cat.name}</strong>
                            <span>{phrase.text}</span>
                          </span>
                          <Icon name="chevronDown" size={15} className="picker-chevron" />
                        </button>
                        {openPicker === phrase.id ? (
                          <div className="picker-menu" role="menu">
                            <p className="picker-title">Which phrasing was said?</p>
                            <button type="button" role="menuitem" className="picker-option standard" onClick={() => tickManual(phrase.id, "")}>
                              <Icon name="checkCircle" size={14} />
                              <span>
                                <strong>Standard phrasing</strong>
                                <small>{phrase.text}</small>
                              </span>
                            </button>
                            {phrase.alternatives.map((alt) => (
                              <button key={alt} type="button" role="menuitem" className="picker-option" onClick={() => tickManual(phrase.id, alt)}>
                                <Icon name="check" size={14} />
                                <span>
                                  <strong>Alternative</strong>
                                  <small>{alt}</small>
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
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
          <CardHeader title={<span className="listen-title"><span className="listen-dot" /> Live speech assistant</span>} subtitle="Chrome or Edge only — listens for quality phrases, ticks them and stamps the time" />
          {notSupported ? (
            <EmptyState icon="mic" title="Speech not supported" description="This browser has no Web Speech API. Use Chrome or Edge" />
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
              <p className="listen-status">{speech.listening ? "Listening… detected phrases tick automatically with timestamps" : "Not listening"}</p>
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
              {missed.map((id) => {
                const phrase = phrases.find((p) => p.id === id);
                const cat = categories.find((c) => c.id === phrase?.categoryId);
                return <li key={id}><Icon name="alert" size={13} /> {cat?.name ?? id}</li>;
              })}
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
