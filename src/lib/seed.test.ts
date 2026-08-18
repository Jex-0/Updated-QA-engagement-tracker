import { describe, expect, it } from "vitest";
import { DEFAULT_TEAMS, firstAccountRole, initialState, makeUser, uid, withSampleData } from "./seed";
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from "./checklist";

describe("DEFAULT_TEAMS", () => {
  it("seeds 12 zero-padded contact-centre teams", () => {
    expect(DEFAULT_TEAMS).toHaveLength(12);
    expect(DEFAULT_TEAMS[0]).toEqual({ id: "ccs01", name: "CCS01" });
    expect(DEFAULT_TEAMS[11]).toEqual({ id: "ccs12", name: "CCS12" });
  });
});

describe("uid", () => {
  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uid()));
    expect(ids.size).toBe(500);
  });
});

describe("makeUser", () => {
  it("defaults team, role and id", () => {
    const user = makeUser({ name: "Thandi Nkosi" });
    expect(user).toMatchObject({ name: "Thandi Nkosi", team: "CCS01", role: "agent", email: undefined });
    expect(user.id).toBeTruthy();
    expect(user.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("lets callers override the defaults", () => {
    const user = makeUser({ name: "Lead", team: "CCS05", role: "leader", email: "lead@capitecbank.co.za" });
    expect(user).toMatchObject({ team: "CCS05", role: "leader", email: "lead@capitecbank.co.za" });
  });
});

describe("initialState", () => {
  it("seeds one administrator, the default checklist and no engagements", () => {
    const state = initialState();
    expect(state.session).toBeNull();
    expect(state.users).toHaveLength(1);
    expect(state.users[0].role).toBe("admin");
    expect(state.teams).toEqual(DEFAULT_TEAMS);
    expect(state.categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(state.phrases).toHaveLength(DEFAULT_PHRASES.length);
    expect(state.records).toEqual([]);
    expect(state.disputes).toEqual([]);
    expect(state.notes).toEqual([]);
    expect(state.audit[0]).toMatchObject({ actor: "system", action: "platform_initialised" });
  });

  it("keeps manual ticking off and cloud disconnected by default", () => {
    expect(initialState().settings).toMatchObject({
      theme: "light",
      sampleDataLoaded: false,
      manualTickEnabled: false,
      cloud: { firebaseConfig: null, connected: false },
    });
  });

  it("deep-copies the default checklist so edits cannot leak into the defaults", () => {
    const state = initialState();
    state.categories[0].name = "Renamed";
    state.phrases[0].keywords.push("mutated");
    expect(DEFAULT_CATEGORIES[0].name).toBe("Greeting");
    expect(DEFAULT_PHRASES[0].keywords).not.toContain("mutated");
  });
});

describe("withSampleData", () => {
  it("adds sample agents, records and coaching notes without dropping existing users", () => {
    const state = withSampleData(initialState());
    expect(state.users).toHaveLength(7); // seeded admin + 6 sample agents
    expect(state.users.filter((u) => u.role === "leader")).toHaveLength(2);
    expect(state.records).toHaveLength(6 * 14);
    expect(state.notes).toHaveLength(6);
    expect(state.settings.sampleDataLoaded).toBe(true);
  });

  it("generates coherent records: checked + missed covers the checklist and scores stay in range", () => {
    const { records } = withSampleData(initialState());
    for (const r of records) {
      expect(r.checkedItems.length + r.missedItems.length).toBe(DEFAULT_PHRASES.length);
      expect(new Set(r.checkedItems).size).toBe(r.checkedItems.length);
      expect(r.checkedItems.some((c) => r.missedItems.includes(c))).toBe(false);
      expect(r.completed).toBe(r.checkedItems.length);
      expect(r.total).toBe(DEFAULT_PHRASES.length);
      expect(r.score).toBeGreaterThanOrEqual(18);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.status).toBe("active");
    }
  });

  it("attributes coaching notes to a sample leader", () => {
    const state = withSampleData(initialState());
    const leaders = state.users.filter((u) => u.role === "leader").map((u) => u.name);
    for (const note of state.notes) {
      expect(leaders).toContain(note.author);
      expect(["strength", "improvement"]).toContain(note.type);
    }
  });
});

describe("firstAccountRole", () => {
  it("makes the very first account an administrator", () => {
    expect(firstAccountRole({ ...initialState(), users: [] })).toBe("admin");
  });

  it("makes later accounts agents once an administrator exists", () => {
    expect(firstAccountRole(initialState())).toBe("agent");
  });
});
