import { describe, expect, it } from "vitest";
import { buildTimelineForRecord, buildTimelineFromSession, coachingRecommendations } from "./timeline";
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES, PULSE_LABEL } from "./checklist";
import { makeRecord } from "../test/factories";
import type { TimelineEvent } from "./types";

const CATS = DEFAULT_CATEGORIES;
const PHRASES = DEFAULT_PHRASES;

describe("buildTimelineFromSession", () => {
  it("stamps each ticked phrase at the second it was said, sorted by time", () => {
    const events = buildTimelineFromSession(
      CATS,
      PHRASES,
      { "p-empathy": 195, "p-greeting": 22 },
      {},
      { "p-greeting": "speech", "p-empathy": "speech" },
      [],
      false,
    );
    expect(events.map((e) => [e.seconds, e.label])).toEqual([
      [22, "Greeting detected"],
      [195, "Empathy statement detected"],
    ]);
    expect(events.every((e) => e.source === "speech" && !e.missed)).toBe(true);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });

  it("records the chosen variation in the detail for manual ticks", () => {
    const [event] = buildTimelineFromSession(
      CATS,
      PHRASES,
      { "p-greeting": 10 },
      { "p-greeting": "Good morning, thank you for calling Capitec Bank." },
      { "p-greeting": "manual" },
      [],
      false,
    );
    expect(event.source).toBe("manual");
    expect(event.variant).toBe("Good morning, thank you for calling Capitec Bank.");
    expect(event.detail).toContain("variation: “Good morning, thank you for calling Capitec Bank.”");
  });

  it("ignores phrases that were never ticked", () => {
    expect(buildTimelineFromSession(CATS, PHRASES, {}, {}, {}, [], false)).toEqual([]);
  });

  it("adds a Pulse event at its tick, defaulting to 60s", () => {
    const withTick = buildTimelineFromSession(CATS, PHRASES, { [PULSE_LABEL]: 300 }, {}, {}, [], true);
    expect(withTick).toMatchObject([{ seconds: 300, type: "pulse", label: "Pulse adopted", source: "manual" }]);
    const withoutTick = buildTimelineFromSession(CATS, PHRASES, {}, {}, {}, [], true);
    expect(withoutTick[0].seconds).toBe(60);
  });

  it("appends missed phrases as coaching events just after the last tick", () => {
    const events = buildTimelineFromSession(
      CATS,
      PHRASES,
      { "p-greeting": 40 },
      {},
      { "p-greeting": "speech" },
      ["p-recap"],
      false,
    );
    expect(events[1]).toMatchObject({ seconds: 45, type: "coaching", label: "Call not summarised", missed: true });
  });

  it("places coaching events at 5s when nothing was ticked", () => {
    const [event] = buildTimelineFromSession(CATS, PHRASES, {}, {}, {}, ["p-greeting"], false);
    expect(event.seconds).toBe(5);
  });
});

describe("buildTimelineForRecord", () => {
  it("returns a stored timeline untouched", () => {
    const timeline: TimelineEvent[] = [{ id: "t1", seconds: 3, type: "system", label: "Call started", detail: "" }];
    expect(buildTimelineForRecord(makeRecord({ timeline }), CATS, PHRASES)).toBe(timeline);
  });

  it("spreads checked phrases across a 10 minute call", () => {
    const record = makeRecord({ checkedItems: ["p-greeting", "p-empathy", "p-call-closing"] });
    const events = buildTimelineForRecord(record, CATS, PHRASES);
    expect(events.map((e) => e.seconds)).toEqual([0, 300, 600]);
    expect(events.map((e) => e.label)).toEqual([
      "Greeting detected",
      "Empathy statement detected",
      "Call closed professionally",
    ]);
  });

  it("places a lone checked phrase at 15s", () => {
    const events = buildTimelineForRecord(makeRecord({ checkedItems: ["p-greeting"] }), CATS, PHRASES);
    expect(events.map((e) => e.seconds)).toEqual([15]);
  });

  it("adds Pulse before the end and coaching events after it", () => {
    const record = makeRecord({
      checkedItems: ["p-greeting"],
      missedItems: ["p-recap"],
      pulseCompleted: true,
    });
    const events = buildTimelineForRecord(record, CATS, PHRASES);
    expect(events.map((e) => [e.seconds, e.type])).toEqual([
      [15, "greeting"],
      [570, "pulse"],
      [605, "coaching"],
    ]);
  });

  it("drops items that no longer resolve to a phrase", () => {
    const record = makeRecord({ checkedItems: ["deleted-phrase"], missedItems: ["also-deleted"] });
    expect(buildTimelineForRecord(record, CATS, PHRASES)).toEqual([]);
  });

  it("resolves legacy category names stored on old records", () => {
    const events = buildTimelineForRecord(makeRecord({ checkedItems: ["Greeting"] }), CATS, PHRASES);
    expect(events).toMatchObject([{ label: "Greeting detected", type: "greeting" }]);
  });
});

describe("coachingRecommendations", () => {
  it("returns guidance for each missed step", () => {
    const record = makeRecord({ missedItems: ["p-verification", "p-call-closing"] });
    expect(coachingRecommendations(record, CATS, PHRASES)).toEqual([
      "Always confirm the caller's identity before sharing any account detail.",
      "End every call with a professional closing and goodbye.",
    ]);
  });

  it("de-duplicates guidance shared by several categories", () => {
    const record = makeRecord({ missedItems: ["p-telco-iac", "p-adding-value"] });
    expect(coachingRecommendations(record, CATS, PHRASES)).toHaveLength(1);
  });

  it("returns nothing when no step was missed", () => {
    expect(coachingRecommendations(makeRecord(), CATS, PHRASES)).toEqual([]);
  });
});
