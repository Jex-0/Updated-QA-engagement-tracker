import type { EngagementRecord, TimelineEvent } from "./types";
import { ENGAGEMENT_ITEMS, categoryEventLabel, categoryEventType, missedOpportunityLabel, PULSE_LABEL } from "./checklist";
import { uid } from "./seed";

/**
 * Deterministic timeline for legacy records that were saved without one:
 * checked categories are spread evenly across a typical call (~10 minutes)
 * and missed categories become coaching opportunities at the end.
 */
/**
 * Build a timeline from live session ticks (category → seconds into the call),
 * missed categories and the pulse checkbox.
 */
export function buildTimelineFromSession(
  ticks: Record<string, number>,
  missedCategories: string[],
  pulseCompleted: boolean,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const item of ENGAGEMENT_ITEMS) {
    const seconds = ticks[item.category];
    if (seconds == null) continue;
    events.push({
      id: uid(),
      seconds,
      type: categoryEventType(item.category),
      label: categoryEventLabel(item.category),
      detail: item.phrase,
    });
  }
  if (pulseCompleted) {
    const pulseAt = ticks[PULSE_LABEL] ?? 60;
    events.push({ id: uid(), seconds: pulseAt, type: "pulse", label: "Pulse adopted", detail: PULSE_LABEL });
  }
  for (const item of ENGAGEMENT_ITEMS) {
    if (!missedCategories.includes(item.category)) continue;
    events.push({
      id: uid(),
      seconds: (ticks[item.category] ?? 0) + 0.5,
      type: "coaching",
      label: missedOpportunityLabel(item.category),
      detail: item.phrase,
      missed: true,
    });
  }
  events.sort((a, b) => a.seconds - b.seconds);
  return events;
}

export function buildTimelineForRecord(record: EngagementRecord): TimelineEvent[] {
  if (record.timeline && record.timeline.length) return record.timeline;

  const events: TimelineEvent[] = [];
  const DURATION = 600; // 10 minutes
  const checked = ENGAGEMENT_ITEMS.filter((it) => record.checkedItems.includes(it.category));
  checked.forEach((item, i) => {
    const seconds = checked.length > 1 ? Math.round((i / (checked.length - 1)) * DURATION) : 15;
    events.push({
      id: uid(),
      seconds,
      type: categoryEventType(item.category),
      label: categoryEventLabel(item.category),
      detail: item.phrase,
    });
  });
  if (record.pulseCompleted) {
    events.push({ id: uid(), seconds: DURATION - 30, type: "pulse", label: "Pulse adopted", detail: PULSE_LABEL });
  }
  ENGAGEMENT_ITEMS.filter((it) => record.missedItems.includes(it.category)).forEach((item) => {
    events.push({
      id: uid(),
      seconds: DURATION + 5,
      type: "coaching",
      label: missedOpportunityLabel(item.category),
      detail: item.phrase,
      missed: true,
    });
  });
  events.sort((a, b) => a.seconds - b.seconds);
  return events;
}

/** Coaching recommendations generated from the categories that were missed. */
export function coachingRecommendations(record: EngagementRecord): string[] {
  return ENGAGEMENT_ITEMS.filter((it) => record.missedItems.includes(it.category)).map((it) => {
    switch (it.category) {
      case "Greeting":
        return "Reinforce the standard opening script; role-play the greeting until it becomes automatic.";
      case "Verification":
        return "Always confirm the caller's identity before sharing any account detail.";
      case "Telco_IAC":
      case "Adding Value":
        return "Practise a value-add sentence after resolving the query (e.g. 'Did you know…').";
      case "Empathy":
        return "Use a reflective empathy phrase such as 'I hear you' early in difficult calls.";
      case "Probing":
        return "Ask one clarifying question before offering a solution to reduce repeat contact.";
      case "Keeping Client Informed":
        return "Set explicit expectations: 'I will confirm the next steps shortly.'";
      case "Recap_and_Summarise":
        return "Close the loop by summarising what was done before ending the call.";
      case "Active Listening":
        return "Acknowledge customer confirmations verbally ('Thank you for confirming').";
      case "Additional Assistance":
        return "Always offer additional assistance before closing the call.";
      case "Call Closing":
        return "End every call with a professional closing and goodbye.";
      default:
        return `Review the ${it.category} step with the agent.`;
    }
  });
}
