import { describe, expect, it } from "vitest";
import {
  buildKeywordMap,
  categoryById,
  categoryEventLabel,
  categoryEventType,
  categoryNameOf,
  coachingForCategory,
  DEFAULT_CATEGORIES,
  DEFAULT_PHRASES,
  missedOpportunityLabel,
  phraseById,
  resolveCategoryLabel,
  resolvePhrase,
  resolvePhraseText,
} from "./checklist";
import type { ChecklistCategory, Phrase } from "./types";

describe("default checklist", () => {
  it("gives every phrase a category that exists", () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const p of DEFAULT_PHRASES) expect(ids.has(p.categoryId)).toBe(true);
  });

  it("has one phrase per category and unique ids", () => {
    expect(DEFAULT_PHRASES).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(new Set(DEFAULT_PHRASES.map((p) => p.id)).size).toBe(DEFAULT_PHRASES.length);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(DEFAULT_CATEGORIES.length);
  });

  it("keeps speech keywords lower-cased so transcript matching works", () => {
    for (const p of DEFAULT_PHRASES) {
      for (const k of p.keywords) expect(k).toBe(k.toLowerCase());
    }
  });
});

describe("buildKeywordMap", () => {
  it("maps phrase id to its trigger phrases", () => {
    const map = buildKeywordMap(DEFAULT_PHRASES);
    expect(map["p-greeting"]).toContain("capitec bank");
    expect(Object.keys(map)).toHaveLength(DEFAULT_PHRASES.length);
  });

  it("skips phrases without keywords", () => {
    const phrases: Phrase[] = [
      { id: "a", categoryId: "greeting", text: "A", keywords: [], alternatives: [] },
      { id: "b", categoryId: "greeting", text: "B", keywords: ["hello"], alternatives: [] },
    ];
    expect(buildKeywordMap(phrases)).toEqual({ b: ["hello"] });
  });

  it("returns an empty map for an empty checklist", () => {
    expect(buildKeywordMap([])).toEqual({});
  });
});

describe("lookup helpers", () => {
  it("finds phrases and categories by id, or null", () => {
    expect(phraseById(DEFAULT_PHRASES, "p-recap")?.categoryId).toBe("recap");
    expect(phraseById(DEFAULT_PHRASES, "nope")).toBeNull();
    expect(categoryById(DEFAULT_CATEGORIES, "recap")?.name).toBe("Recap_and_Summarise");
    expect(categoryById(DEFAULT_CATEGORIES, "nope")).toBeNull();
  });
});

describe("resolvePhrase", () => {
  it("resolves a phrase id", () => {
    expect(resolvePhrase(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "p-empathy")?.id).toBe("p-empathy");
  });

  it("resolves a category id to that category's first phrase", () => {
    expect(resolvePhrase(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "empathy")?.id).toBe("p-empathy");
  });

  it("resolves a legacy category name", () => {
    expect(resolvePhrase(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "Recap_and_Summarise")?.id).toBe("p-recap");
  });

  it("returns null for unknown ids and for a category with no phrases", () => {
    expect(resolvePhrase(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "unknown")).toBeNull();
    const categories: ChecklistCategory[] = [{ id: "empty", name: "Empty" }];
    expect(resolvePhrase(categories, [], "empty")).toBeNull();
  });

  it("prefers a phrase id over an identically named category", () => {
    const categories: ChecklistCategory[] = [{ id: "shared", name: "Shared" }];
    const phrases: Phrase[] = [
      { id: "shared", categoryId: "shared", text: "Phrase with id 'shared'", keywords: [], alternatives: [] },
      { id: "other", categoryId: "shared", text: "First phrase of the category", keywords: [], alternatives: [] },
    ];
    expect(resolvePhrase(categories, phrases, "shared")?.text).toBe("Phrase with id 'shared'");
  });
});

describe("categoryNameOf", () => {
  it("returns the category name for phrase ids, category ids and legacy names", () => {
    expect(categoryNameOf(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "p-recap")).toBe("Recap_and_Summarise");
    expect(categoryNameOf(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "recap")).toBe("Recap_and_Summarise");
    expect(categoryNameOf(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "Recap_and_Summarise")).toBe("Recap_and_Summarise");
  });

  it("echoes ids it cannot resolve", () => {
    expect(categoryNameOf(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "ghost")).toBe("ghost");
  });
});

describe("resolveCategoryLabel / resolvePhraseText", () => {
  it("labels a phrase id with its category name", () => {
    expect(resolveCategoryLabel(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "p-greeting")).toBe("Greeting");
    expect(resolvePhraseText(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "p-call-closing")).toBe("Thank you, goodbye.");
  });

  it("echoes ids that cannot be resolved", () => {
    expect(resolveCategoryLabel(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "Ghost")).toBe("Ghost");
    expect(resolvePhraseText(DEFAULT_CATEGORIES, DEFAULT_PHRASES, "Ghost")).toBe("Ghost");
  });

  it("falls back to the category id when the category was deleted", () => {
    const phrases: Phrase[] = [{ id: "p", categoryId: "orphaned", text: "Orphan", keywords: [], alternatives: [] }];
    expect(resolveCategoryLabel([], phrases, "p")).toBe("orphaned");
  });
});

describe("category event mapping", () => {
  it("maps categories to timeline event types", () => {
    expect(categoryEventType("Greeting")).toBe("greeting");
    expect(categoryEventType("Empathy")).toBe("empathy");
    expect(categoryEventType("Active Listening")).toBe("empathy");
    expect(categoryEventType("Verification")).toBe("compliance");
    expect(categoryEventType("Keeping Client Informed")).toBe("compliance");
    expect(categoryEventType("Recap_and_Summarise")).toBe("compliance");
    expect(categoryEventType("Probing")).toBe("objection");
    expect(categoryEventType("Telco_IAC")).toBe("upsell");
    expect(categoryEventType("Adding Value")).toBe("upsell");
    expect(categoryEventType("Custom manager category")).toBe("quality");
  });

  it("labels every default category and falls back for custom ones", () => {
    for (const c of DEFAULT_CATEGORIES) {
      expect(categoryEventLabel(c.name)).not.toBe(`${c.name} demonstrated`);
      expect(missedOpportunityLabel(c.name)).not.toBe(`${c.name} not demonstrated`);
      expect(coachingForCategory(c.name)).not.toBe(`Review the ${c.name} step with the agent.`);
    }
    expect(categoryEventLabel("Rapport")).toBe("Rapport demonstrated");
    expect(missedOpportunityLabel("Rapport")).toBe("Rapport not demonstrated");
    expect(coachingForCategory("Rapport")).toBe("Review the Rapport step with the agent.");
  });

  it("shares coaching guidance between the two upsell categories", () => {
    expect(coachingForCategory("Telco_IAC")).toBe(coachingForCategory("Adding Value"));
  });
});
