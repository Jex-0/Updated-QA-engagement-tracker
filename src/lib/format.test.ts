import { describe, expect, it } from "vitest";
import {
  aggregateCategories,
  avg,
  categoryPerformance,
  clamp,
  complianceScore,
  effectiveScore,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  fmtTime,
  pct,
  pulseRate,
  rollingAverage,
  scoreColor,
  scoreTone,
} from "./format";
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from "./checklist";
import { makeRecord } from "../test/factories";

describe("date formatting", () => {
  const ts = Date.UTC(2024, 2, 5, 10, 30);

  it("formats a date without time", () => {
    expect(fmtDate(ts)).toMatch(/2024/);
    expect(fmtDate(ts)).not.toMatch(/:/);
  });

  it("formats a date with time", () => {
    expect(fmtDateTime(ts)).toMatch(/2024/);
    expect(fmtDateTime(ts)).toMatch(/:/);
  });
});

describe("fmtTime", () => {
  it("pads minutes and seconds under an hour", () => {
    expect(fmtTime(0)).toBe("00:00:00");
    expect(fmtTime(9)).toBe("00:00:09");
    expect(fmtTime(75)).toBe("00:01:15");
    expect(fmtTime(3599)).toBe("00:59:59");
  });

  it("includes hours once the call passes an hour", () => {
    expect(fmtTime(3600)).toBe("1:00:00");
    expect(fmtTime(3661)).toBe("1:01:01");
  });

  it("truncates fractional seconds", () => {
    expect(fmtTime(61.9)).toBe("00:01:01");
  });
});

describe("fmtDuration", () => {
  it("renders minutes below an hour", () => {
    expect(fmtDuration(0)).toBe("0 min");
    expect(fmtDuration(90)).toBe("2 min");
    expect(fmtDuration(3540)).toBe("59 min");
  });

  it("renders hours and minutes from an hour up", () => {
    expect(fmtDuration(3600)).toBe("1h 0m");
    expect(fmtDuration(9000)).toBe("2h 30m");
  });
});

describe("simple numeric helpers", () => {
  it("rounds percentages", () => {
    expect(pct(0)).toBe("0%");
    expect(pct(66.6)).toBe("67%");
  });

  it("buckets score tone at the 80/50 thresholds", () => {
    expect(scoreTone(80)).toBe("high");
    expect(scoreTone(79)).toBe("mid");
    expect(scoreTone(50)).toBe("mid");
    expect(scoreTone(49)).toBe("low");
  });

  it("maps score tone to a CSS variable", () => {
    expect(scoreColor(95)).toBe("var(--success)");
    expect(scoreColor(60)).toBe("var(--warning)");
    expect(scoreColor(10)).toBe("var(--danger)");
  });

  it("averages, returning 0 for an empty list", () => {
    expect(avg([])).toBe(0);
    expect(avg([50, 51])).toBe(51);
    expect(avg([10, 20, 30])).toBe(20);
  });

  it("clamps into range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe("rollingAverage", () => {
  it("uses a growing window until the window size is reached", () => {
    expect(rollingAverage([10, 20, 30], 2)).toEqual([10, 15, 25]);
  });

  it("defaults to a 7-point window", () => {
    const scores = [0, 0, 0, 0, 0, 0, 0, 70];
    expect(rollingAverage(scores).at(-1)).toBe(10);
  });

  it("returns an empty list for no scores", () => {
    expect(rollingAverage([])).toEqual([]);
  });
});

describe("effectiveScore", () => {
  it("prefers a manager correction over the captured score", () => {
    const corrected = makeRecord({
      score: 40,
      corrected: { by: "Manager", at: 1, oldScore: 40, newScore: 75, reason: "dispute" },
    });
    expect(effectiveScore(corrected)).toBe(75);
    expect(effectiveScore(makeRecord({ score: 40 }))).toBe(40);
  });
});

describe("aggregateCategories", () => {
  it("counts checked and missed items per phrase", () => {
    const records = [
      makeRecord({ checkedItems: ["p-greeting", "p-empathy"], missedItems: ["p-recap"] }),
      makeRecord({ checkedItems: ["p-greeting"], missedItems: ["p-recap"] }),
    ];
    const { checked, missed } = aggregateCategories(records, DEFAULT_PHRASES, DEFAULT_CATEGORIES);
    expect(checked).toEqual({ "p-greeting": 2, "p-empathy": 1 });
    expect(missed).toEqual({ "p-recap": 2 });
  });

  it("resolves legacy category-name ids onto the current phrase ids", () => {
    const records = [makeRecord({ checkedItems: ["Greeting"], missedItems: ["Call Closing"] })];
    const { checked, missed } = aggregateCategories(records, DEFAULT_PHRASES, DEFAULT_CATEGORIES);
    expect(checked).toEqual({ "p-greeting": 1 });
    expect(missed).toEqual({ "p-call-closing": 1 });
  });

  it("keeps unresolvable ids as-is", () => {
    const { checked } = aggregateCategories(
      [makeRecord({ checkedItems: ["ghost-phrase"] })],
      DEFAULT_PHRASES,
      DEFAULT_CATEGORIES,
    );
    expect(checked).toEqual({ "ghost-phrase": 1 });
  });
});

describe("categoryPerformance", () => {
  it("reports done/missed counts and completion rate per phrase", () => {
    const records = [
      makeRecord({ checkedItems: ["p-greeting"], missedItems: ["p-empathy"] }),
      makeRecord({ checkedItems: ["p-empathy"], missedItems: ["p-greeting"] }),
      makeRecord({ checkedItems: ["p-greeting"], missedItems: [] }),
    ];
    const rows = categoryPerformance(records, DEFAULT_PHRASES, DEFAULT_CATEGORIES);
    const greeting = rows.find((r) => r.category === "greeting")!;
    expect(greeting).toMatchObject({ done: 2, missed: 1, rate: 67 });
    expect(rows.find((r) => r.category === "empathy")).toMatchObject({ done: 1, missed: 1, rate: 50 });
  });

  it("rates never-attempted phrases 0 rather than dividing by zero", () => {
    const rows = categoryPerformance([], DEFAULT_PHRASES, DEFAULT_CATEGORIES);
    expect(rows).toHaveLength(DEFAULT_PHRASES.length);
    expect(rows.every((r) => r.done === 0 && r.missed === 0 && r.rate === 0)).toBe(true);
  });
});

describe("complianceScore", () => {
  it("scores only the mandatory regulatory categories", () => {
    const records = [
      makeRecord({
        // 2 of 3 compliance steps done; greeting is not a compliance step
        checkedItems: ["p-verification", "p-recap", "p-greeting"],
        missedItems: ["p-keeping-informed", "p-empathy"],
      }),
    ];
    expect(complianceScore(records, DEFAULT_PHRASES, DEFAULT_CATEGORIES)).toBe(67);
  });

  it("returns 0 with no records and 0 when no compliance step was attempted", () => {
    expect(complianceScore([], DEFAULT_PHRASES, DEFAULT_CATEGORIES)).toBe(0);
    const nonCompliance = [makeRecord({ checkedItems: ["p-greeting"], missedItems: ["p-empathy"] })];
    expect(complianceScore(nonCompliance, DEFAULT_PHRASES, DEFAULT_CATEGORIES)).toBe(0);
  });

  it("scores 100 when every compliance step was captured", () => {
    const records = [makeRecord({ checkedItems: ["p-verification", "p-recap", "p-keeping-informed"] })];
    expect(complianceScore(records, DEFAULT_PHRASES, DEFAULT_CATEGORIES)).toBe(100);
  });
});

describe("pulseRate", () => {
  it("is the share of engagements with Pulse adopted", () => {
    const records = [
      makeRecord({ pulseCompleted: true }),
      makeRecord({ pulseCompleted: true }),
      makeRecord({ pulseCompleted: false }),
    ];
    expect(pulseRate(records)).toBe(67);
  });

  it("returns 0 for no records", () => {
    expect(pulseRate([])).toBe(0);
  });
});
