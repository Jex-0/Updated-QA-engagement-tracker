import type { ChecklistCategory, EngagementRecord, Phrase, TimelineEvent } from "./types";
import { categoryById, categoryEventLabel, categoryEventType, coachingForCategory, missedOpportunityLabel, PULSE_LABEL, resolvePhrase } from "./checklist";
import { uid } from "./seed";

/** Category name for a phrase (or legacy category-name item). */
function categoryNameOf(categories: ChecklistCategory[], phrases: Phrase[], id: string): string {
  const phrase = resolvePhrase(categories, phrases, id);
  if (phrase) return categoryById(categories, phrase.categoryId)?.name ?? phrase.categoryId;
  return id;
}

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
  for (const phrase of phrases) {
    const seconds = ticks[phrase.id];
    if (seconds == null) continue;
    const category = categoryNameOf(categories, phrases, phrase.id);
    const variant = variants[phrase.id];
    events.push({
      id: uid(),
      seconds,
      type: categoryEventType(category),
      label: categoryEventLabel(category),
      detail: variant ? `${phrase.text} — variation: “${variant}”` : phrase.text,
      source: sources[phrase.id],
      variant: variant || undefined,
    });
  }
  if (pulseCompleted) {
    const pulseAt = ticks[PULSE_LABEL] ?? 60;
    events.push({ id: uid(), seconds: pulseAt, type: "pulse", label: "Pulse adopted", detail: PULSE_LABEL, source: "manual" });
  }
  const lastTick = Math.max(0, ...Object.values(ticks));
  for (const phrase of phrases) {
    if (!missedPhraseIds.includes(phrase.id)) continue;
    const category = categoryNameOf(categories, phrases, phrase.id);
    events.push({
      id: uid(),
      seconds: lastTick + 5,
      type: "coaching",
      label: missedOpportunityLabel(category),
      detail: phrase.text,
      missed: true,
    });
  }
  events.sort((a, b) => a.seconds - b.seconds);
  return events;
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

  const events: TimelineEvent[] = [];
  const DURATION = 600; // 10 minutes
  const checked = record.checkedItems
    .map((id) => resolvePhrase(categories, phrases, id))
    .filter((p): p is Phrase => p != null);
  checked.forEach((phrase, i) => {
    const seconds = checked.length > 1 ? Math.round((i / (checked.length - 1)) * DURATION) : 15;
    const category = categoryNameOf(categories, phrases, phrase.id);
    events.push({
      id: uid(),
      seconds,
      type: categoryEventType(category),
      label: categoryEventLabel(category),
      detail: phrase.text,
    });
  });
  if (record.pulseCompleted) {
    events.push({ id: uid(), seconds: DURATION - 30, type: "pulse", label: "Pulse adopted", detail: PULSE_LABEL });
  }
  record.missedItems
    .map((id) => resolvePhrase(categories, phrases, id))
    .filter((p): p is Phrase => p != null)
    .forEach((phrase) => {
      const category = categoryNameOf(categories, phrases, phrase.id);
      events.push({
        id: uid(),
        seconds: DURATION + 5,
        type: "coaching",
        label: missedOpportunityLabel(category),
        detail: phrase.text,
        missed: true,
      });
    });
  events.sort((a, b) => a.seconds - b.seconds);
  return events;
}

/** Coaching recommendations generated from the steps that were missed. */
export function coachingRecommendations(record: EngagementRecord, categories: ChecklistCategory[], phrases: Phrase[]): string[] {
  return record.missedItems
    .map((id) => {
      const category = categoryNameOf(categories, phrases, id);
      return coachingForCategory(category);
    })
    .filter((v, i, a) => a.indexOf(v) === i);
}
