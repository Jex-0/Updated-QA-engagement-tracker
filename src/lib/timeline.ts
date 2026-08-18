import type { ChecklistCategory, EngagementRecord, Phrase, TimelineEvent } from "./types";
import {
  categoryEventLabel,
  categoryEventType,
  coachingForCategory,
  missedOpportunityLabel,
  PULSE_LABEL,
  resolveCategoryLabel,
  resolvePhrase,
} from "./checklist";
import { uid } from "./seed";

interface CaptureOptions {
  variant?: string;
  source?: "speech" | "manual";
}

/** Timeline entry for a phrase that was demonstrated. */
function capturedEvent(category: string, phrase: Phrase, seconds: number, { variant, source }: CaptureOptions = {}): TimelineEvent {
  return {
    id: uid(),
    seconds,
    type: categoryEventType(category),
    label: categoryEventLabel(category),
    detail: variant ? `${phrase.text} — variation: “${variant}”` : phrase.text,
    source,
    variant: variant || undefined,
  };
}

/** Timeline entry for a phrase that was missed — a coaching opportunity. */
function coachingEvent(category: string, phrase: Phrase, seconds: number): TimelineEvent {
  return {
    id: uid(),
    seconds,
    type: "coaching",
    label: missedOpportunityLabel(category),
    detail: phrase.text,
    missed: true,
  };
}

function pulseEvent(seconds: number, source?: "speech" | "manual"): TimelineEvent {
  return { id: uid(), seconds, type: "pulse", label: "Pulse adopted", detail: PULSE_LABEL, source };
}

/** Phrases for stored item ids, dropping ids that no longer resolve. */
function resolvePhrases(categories: ChecklistCategory[], phrases: Phrase[], ids: string[]): Phrase[] {
  return ids.map((id) => resolvePhrase(categories, phrases, id)).filter((p): p is Phrase => p != null);
}

const bySeconds = (a: TimelineEvent, b: TimelineEvent) => a.seconds - b.seconds;

/**
 * Build a live timeline from session ticks.
 * - `ticks`: phrase id → seconds into the call when the phrase was said
 * - `variants`: phrase id → the alternative phrasing chosen (manual) or ""
 * - `sources`: phrase id → how it was captured
 * - `missedPhraseIds`: phrases not completed (become coaching opportunities)
 */
export function buildTimelineFromSession(
  categories: ChecklistCategory[],
  phrases: Phrase[],
  ticks: Record<string, number>,
  variants: Record<string, string>,
  sources: Record<string, "speech" | "manual">,
  missedPhraseIds: string[],
  pulseCompleted: boolean,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const categoryOf = (phrase: Phrase) => resolveCategoryLabel(categories, phrases, phrase.id);

  for (const phrase of phrases) {
    const seconds = ticks[phrase.id];
    if (seconds == null) continue;
    events.push(capturedEvent(categoryOf(phrase), phrase, seconds, { variant: variants[phrase.id], source: sources[phrase.id] }));
  }
  if (pulseCompleted) {
    events.push(pulseEvent(ticks[PULSE_LABEL] ?? 60, "manual"));
  }
  const lastTick = Math.max(0, ...Object.values(ticks));
  for (const phrase of phrases) {
    if (!missedPhraseIds.includes(phrase.id)) continue;
    events.push(coachingEvent(categoryOf(phrase), phrase, lastTick + 5));
  }
  return events.sort(bySeconds);
}

/**
 * Deterministic timeline for records saved without one (legacy): checked
 * phrases are spread across a typical ~10 minute call, missed phrases become
 * coaching opportunities at the end.
 */
export function buildTimelineForRecord(
  record: EngagementRecord,
  categories: ChecklistCategory[],
  phrases: Phrase[],
): TimelineEvent[] {
  if (record.timeline && record.timeline.length) return record.timeline;

  const DURATION = 600; // 10 minutes
  const categoryOf = (phrase: Phrase) => resolveCategoryLabel(categories, phrases, phrase.id);
  const checked = resolvePhrases(categories, phrases, record.checkedItems);

  const events: TimelineEvent[] = checked.map((phrase, i) =>
    capturedEvent(categoryOf(phrase), phrase, checked.length > 1 ? Math.round((i / (checked.length - 1)) * DURATION) : 15),
  );
  if (record.pulseCompleted) {
    events.push(pulseEvent(DURATION - 30));
  }
  for (const phrase of resolvePhrases(categories, phrases, record.missedItems)) {
    events.push(coachingEvent(categoryOf(phrase), phrase, DURATION + 5));
  }
  return events.sort(bySeconds);
}

/** Coaching recommendations generated from the steps that were missed. */
export function coachingRecommendations(record: EngagementRecord, categories: ChecklistCategory[], phrases: Phrase[]): string[] {
  const advice = record.missedItems.map((id) => coachingForCategory(resolveCategoryLabel(categories, phrases, id)));
  return [...new Set(advice)];
}
