import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { StoreProvider, useFirstAccountRole, useStore, type Action } from "./store";
import { initialState } from "./seed";
import { makeRecord } from "../test/factories";
import type { AppState, EngagementRecord } from "./types";

const STORAGE_KEY = "qe-platform-v2";

function wrapper({ children }: { children: ReactNode }) {
  return <StoreProvider>{children}</StoreProvider>;
}

function mountStore() {
  const { result } = renderHook(() => useStore(), { wrapper });
  const run = (fn: (store: ReturnType<typeof useStore>) => void) => act(() => fn(result.current));
  return { result, run };
}

/** Signs a manager in so audit entries are attributed to a real actor. */
function mountAsManager() {
  const store = mountStore();
  store.run((s) => s.actions.login("Nomsa Manager", "CCS01", "manager"));
  return store;
}

function saveRecord(store: ReturnType<typeof mountStore>, checked: string[] = ["p-greeting"]): EngagementRecord {
  let saved: EngagementRecord | null = null;
  store.run((s) => {
    saved = s.actions.saveEngagement({
      userName: "Thandi Nkosi",
      team: "CCS01",
      checkedItems: checked,
      missedItems: [],
      pulseCompleted: false,
      dropped: false,
    });
  });
  if (!saved) throw new Error("record was not saved");
  return saved;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useStore", () => {
  it("throws outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useStore())).toThrow("useStore must be used inside StoreProvider");
  });

  it("starts from a fresh install and persists every change", () => {
    const { result, run } = mountStore();
    expect(result.current.state.users).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).users).toHaveLength(1);

    run((s) => s.actions.addTeam("CCS99"));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).teams.at(-1).name).toBe("CCS99");
  });

  it("rehydrates saved state and back-fills newer fields", () => {
    const saved = {
      ...initialState(),
      users: [{ id: "u1", name: "Restored Admin", team: "CCS01", role: "admin", createdAt: 1 }],
      categories: [],
      phrases: [],
      settings: { theme: "dark" },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    const { result } = mountStore();
    expect(result.current.state.users[0].name).toBe("Restored Admin");
    expect(result.current.state.settings.theme).toBe("dark");
    // manualTickEnabled did not exist in the saved state
    expect(result.current.state.settings.manualTickEnabled).toBe(false);
    expect(result.current.state.categories.length).toBeGreaterThan(0);
    expect(result.current.state.phrases.length).toBeGreaterThan(0);
  });

  it("falls back to a fresh install for corrupt or incomplete saved state", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(mountStore().result.current.state.users).toHaveLength(1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ users: [] }));
    expect(mountStore().result.current.state.users).toHaveLength(1);
  });

  it("keeps working when localStorage rejects writes", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const { result, run } = mountStore();
    run((s) => s.actions.addTeam("CCS99"));
    expect(result.current.state.teams.at(-1)!.name).toBe("CCS99");
  });

  it("ignores unknown actions", () => {
    const { result, run } = mountStore();
    const before = result.current.state;
    run((s) => s.dispatch({ type: "NOT_A_REAL_ACTION" } as unknown as Action));
    expect(result.current.state).toBe(before);
  });
});

describe("session", () => {
  it("logs in and out", () => {
    const { result, run } = mountStore();
    run((s) => s.actions.login("Thandi Nkosi", "CCS01", "agent", "t@capitecbank.co.za"));
    expect(result.current.state.session).toEqual({
      name: "Thandi Nkosi",
      team: "CCS01",
      role: "agent",
      email: "t@capitecbank.co.za",
    });
    run((s) => s.actions.logout());
    expect(result.current.state.session).toBeNull();
  });

  it("attributes audit entries to the signed-in user, or to system", () => {
    const anonymous = mountStore();
    anonymous.run((s) => s.actions.addTeam("CCS90"));
    expect(anonymous.result.current.state.audit[0].actor).toBe("system");

    const manager = mountAsManager();
    manager.run((s) => s.actions.addTeam("CCS91"));
    expect(manager.result.current.state.audit[0].actor).toBe("Nomsa Manager");
  });
});

describe("engagements", () => {
  it("scores a saved engagement against the checklist size", () => {
    const store = mountAsManager();
    const record = saveRecord(store, ["p-greeting", "p-empathy"]);
    const total = store.result.current.state.phrases.length;
    expect(record).toMatchObject({ completed: 2, total, score: Math.round((2 / total) * 100), status: "active" });
    expect(store.result.current.state.records[0].id).toBe(record.id);
    expect(store.result.current.state.audit[0]).toMatchObject({ action: "engagement_saved", actor: "Nomsa Manager" });
  });

  it("copies draft item arrays so later edits cannot mutate the record", () => {
    const store = mountAsManager();
    const checked = ["p-greeting"];
    let saved: EngagementRecord | null = null;
    store.run((s) => {
      saved = s.actions.saveEngagement({
        userName: "Thandi Nkosi",
        team: "CCS01",
        checkedItems: checked,
        missedItems: [],
        pulseCompleted: false,
        dropped: false,
      });
    });
    checked.push("p-empathy");
    expect(saved!.checkedItems).toEqual(["p-greeting"]);
  });

  it("deletes a record and audits the removal", () => {
    const store = mountAsManager();
    const record = saveRecord(store);
    store.run((s) => s.actions.deleteEngagement(record.id));
    expect(store.result.current.state.records).toEqual([]);
    expect(store.result.current.state.audit[0].action).toBe("engagement_deleted");
  });

  it("archives and restores a record, ignoring repeat transitions", () => {
    const store = mountAsManager();
    const record = saveRecord(store);

    store.run((s) => s.actions.archiveEngagement(record.id));
    expect(store.result.current.state.records[0]).toMatchObject({ status: "archived", archivedBy: "Nomsa Manager" });

    const afterArchive = store.result.current.state;
    store.run((s) => s.actions.archiveEngagement(record.id));
    expect(store.result.current.state).toBe(afterArchive);

    store.run((s) => s.actions.restoreEngagement(record.id));
    expect(store.result.current.state.records[0]).toMatchObject({
      status: "active",
      archivedAt: undefined,
      archivedBy: undefined,
    });

    const afterRestore = store.result.current.state;
    store.run((s) => s.actions.restoreEngagement(record.id));
    expect(store.result.current.state).toBe(afterRestore);
  });

  it("records a score correction and a review note", () => {
    const store = mountAsManager();
    const record = saveRecord(store);

    store.run((s) => s.actions.correctScore(record.id, 91, "coaching credit"));
    expect(store.result.current.state.records[0].corrected).toMatchObject({
      by: "Nomsa Manager",
      oldScore: record.score,
      newScore: 91,
      reason: "coaching credit",
    });

    store.run((s) => s.actions.reviewEngagement(record.id, "Great call"));
    expect(store.result.current.state.records[0].reviewed).toMatchObject({ by: "Nomsa Manager", note: "Great call" });
  });

  it("ignores actions that target a missing record", () => {
    const store = mountAsManager();
    const before = store.result.current.state;
    store.run((s) => {
      s.actions.deleteEngagement("ghost");
      s.actions.archiveEngagement("ghost");
      s.actions.restoreEngagement("ghost");
      s.actions.correctScore("ghost", 10, "n/a");
      s.actions.reviewEngagement("ghost", "n/a");
      s.actions.openDispute("ghost", "n/a");
    });
    expect(store.result.current.state).toBe(before);
  });

  it("imports records ahead of existing ones", () => {
    const store = mountAsManager();
    const existing = saveRecord(store);
    const imported = [makeRecord({ id: "imported-1" }), makeRecord({ id: "imported-2" })];
    store.run((s) => s.actions.importRecords(imported));
    expect(store.result.current.state.records.map((r) => r.id)).toEqual(["imported-1", "imported-2", existing.id]);
    expect(store.result.current.state.audit[0]).toMatchObject({ action: "records_imported", newValue: { count: 2 } });
  });
});

describe("disputes", () => {
  it("opens a dispute against the effective score", () => {
    const store = mountAsManager();
    const record = saveRecord(store);
    store.run((s) => s.actions.correctScore(record.id, 70, "adjust"));
    store.run((s) => s.actions.openDispute(record.id, "Greeting was said"));
    expect(store.result.current.state.disputes[0]).toMatchObject({
      engagementId: record.id,
      agentName: "Thandi Nkosi",
      score: 70,
      status: "open",
      openedBy: "Nomsa Manager",
    });
  });

  it("applies the adjusted score when a dispute is approved", () => {
    const store = mountAsManager();
    const record = saveRecord(store);
    store.run((s) => s.actions.openDispute(record.id, "Greeting was said"));
    const dispute = store.result.current.state.disputes[0];

    store.run((s) => s.actions.resolveDispute(dispute.id, "approved", "Agreed", 95));
    expect(store.result.current.state.disputes[0]).toMatchObject({
      status: "approved",
      resolution: "Agreed",
      resolvedBy: "Nomsa Manager",
      adjustedScore: 95,
    });
    expect(store.result.current.state.records[0].corrected).toMatchObject({
      newScore: 95,
      reason: "Dispute approved: Agreed",
    });
    expect(store.result.current.state.audit.map((a) => a.action)).toContain("engagement_score_corrected");
  });

  it("leaves the score alone when a dispute is rejected or carries no adjustment", () => {
    const store = mountAsManager();
    const record = saveRecord(store);
    store.run((s) => s.actions.openDispute(record.id, "reason"));
    const dispute = store.result.current.state.disputes[0];

    store.run((s) => s.actions.resolveDispute(dispute.id, "rejected", "Score stands"));
    expect(store.result.current.state.records[0].corrected).toBeUndefined();
    expect(store.result.current.state.disputes[0].status).toBe("rejected");
  });

  it("ignores resolutions for unknown disputes", () => {
    const store = mountAsManager();
    const before = store.result.current.state;
    store.run((s) => s.actions.resolveDispute("ghost", "approved", "n/a", 50));
    expect(store.result.current.state).toBe(before);
  });
});

describe("coaching notes", () => {
  it("adds a note attributed to the author", () => {
    const store = mountAsManager();
    store.run((s) => s.actions.addNote("Thandi Nkosi", "CCS01", "strength", "Excellent empathy"));
    expect(store.result.current.state.notes[0]).toMatchObject({
      agentName: "Thandi Nkosi",
      author: "Nomsa Manager",
      type: "strength",
      text: "Excellent empathy",
    });
    expect(store.result.current.state.audit[0].action).toBe("coaching_note_added");
  });
});

describe("users and teams", () => {
  it("adds, updates and deletes users", () => {
    const store = mountAsManager();
    store.run((s) => s.actions.addUser("Sipho Dlamini", "CCS02", "agent", "s@capitecbank.co.za"));
    const user = store.result.current.state.users.at(-1)!;
    expect(user).toMatchObject({ name: "Sipho Dlamini", team: "CCS02", role: "agent" });

    store.run((s) => s.actions.updateUser(user.id, { role: "leader" }));
    expect(store.result.current.state.users.at(-1)!.role).toBe("leader");

    store.run((s) => s.actions.deleteUser(user.id));
    expect(store.result.current.state.users.some((u) => u.id === user.id)).toBe(false);
    expect(store.result.current.state.audit.map((a) => a.action)).toEqual([
      "user_deleted",
      "user_updated",
      "user_created",
      "platform_initialised",
    ]);
  });

  it("adds and deletes teams", () => {
    const store = mountAsManager();
    store.run((s) => s.actions.addTeam("CCS13"));
    const team = store.result.current.state.teams.at(-1)!;
    store.run((s) => s.actions.deleteTeam(team.id));
    expect(store.result.current.state.teams.some((t) => t.id === team.id)).toBe(false);
  });

  it("ignores updates to unknown users and teams", () => {
    const store = mountAsManager();
    const before = store.result.current.state;
    store.run((s) => {
      s.actions.updateUser("ghost", { role: "admin" });
      s.actions.deleteUser("ghost");
      s.actions.deleteTeam("ghost");
    });
    expect(store.result.current.state).toBe(before);
  });
});

describe("settings", () => {
  it("sets the theme and cloud settings without auditing", () => {
    const store = mountAsManager();
    const auditLength = store.result.current.state.audit.length;
    store.run((s) => s.actions.setTheme("dark"));
    store.run((s) => s.actions.setCloud({ connected: true, firebaseConfig: { projectId: "p" } }));
    expect(store.result.current.state.settings.theme).toBe("dark");
    expect(store.result.current.state.settings.cloud).toMatchObject({ connected: true });
    expect(store.result.current.state.audit).toHaveLength(auditLength);
  });

  it("audits manual ticking changes and ignores no-op toggles", () => {
    const store = mountAsManager();
    const before = store.result.current.state;
    store.run((s) => s.actions.setManualTick(false));
    expect(store.result.current.state).toBe(before);

    store.run((s) => s.actions.setManualTick(true));
    expect(store.result.current.state.settings.manualTickEnabled).toBe(true);
    expect(store.result.current.state.audit[0]).toMatchObject({
      action: "manual_ticking_changed",
      newValue: { manualTickEnabled: true },
    });
  });
});

describe("checklist editing", () => {
  it("adds, renames and deletes categories, cascading to their phrases", () => {
    const store = mountAsManager();
    store.run((s) => s.actions.addCategory("Rapport"));
    const category = store.result.current.state.categories.at(-1)!;

    store.run((s) => s.actions.addPhrase(category.id, "How is your day?", ["how is your day"], ["How are you?"]));
    expect(store.result.current.state.phrases.at(-1)).toMatchObject({ categoryId: category.id });

    store.run((s) => s.actions.updateCategory(category.id, "Rapport building"));
    expect(store.result.current.state.categories.at(-1)!.name).toBe("Rapport building");

    store.run((s) => s.actions.deleteCategory(category.id));
    expect(store.result.current.state.categories.some((c) => c.id === category.id)).toBe(false);
    expect(store.result.current.state.phrases.some((p) => p.categoryId === category.id)).toBe(false);
    expect(store.result.current.state.audit[0]).toMatchObject({
      action: "category_deleted",
      oldValue: { name: "Rapport building", phrases: 1 },
    });
  });

  it("updates and deletes phrases", () => {
    const store = mountAsManager();
    const phrase = store.result.current.state.phrases[0];

    store.run((s) => s.actions.updatePhrase(phrase.id, { keywords: ["hello there"] }));
    expect(store.result.current.state.phrases[0].keywords).toEqual(["hello there"]);
    expect(store.result.current.state.audit[0]).toMatchObject({ action: "phrase_updated" });

    store.run((s) => s.actions.deletePhrase(phrase.id));
    expect(store.result.current.state.phrases.some((p) => p.id === phrase.id)).toBe(false);
  });

  it("ignores edits to unknown categories and phrases", () => {
    const store = mountAsManager();
    const before = store.result.current.state;
    store.run((s) => {
      s.actions.updateCategory("ghost", "Nope");
      s.actions.deleteCategory("ghost");
      s.actions.updatePhrase("ghost", { text: "Nope" });
      s.actions.deletePhrase("ghost");
    });
    expect(store.result.current.state).toBe(before);
  });
});

describe("data management", () => {
  it("loads sample data", () => {
    const store = mountAsManager();
    store.run((s) => s.actions.loadSampleData());
    expect(store.result.current.state.records.length).toBeGreaterThan(0);
    expect(store.result.current.state.settings.sampleDataLoaded).toBe(true);
  });

  it("restores a backup, keeping the current checklist when the backup has none", () => {
    const store = mountAsManager();
    const currentPhrases = store.result.current.state.phrases;
    store.run((s) =>
      s.actions.restoreBackup({
        users: [{ id: "u1", name: "Backup Admin", team: "CCS01", role: "admin", createdAt: 1 }],
        teams: [{ id: "t1", name: "CCS01" }],
        records: [makeRecord({ id: "backup-record" })],
        disputes: [],
        notes: [],
        audit: [],
      }),
    );
    const state = store.result.current.state;
    expect(state.users.map((u) => u.name)).toEqual(["Backup Admin"]);
    expect(state.records.map((r) => r.id)).toEqual(["backup-record"]);
    expect(state.phrases).toBe(currentPhrases);
    expect(state.audit[0]).toMatchObject({ action: "backup_restored", newValue: { users: 1, records: 1 } });
  });

  it("restores a backup's checklist and settings when present", () => {
    const store = mountAsManager();
    store.run((s) =>
      s.actions.restoreBackup({
        users: [],
        teams: [],
        categories: [{ id: "c1", name: "Only category" }],
        phrases: [{ id: "p1", categoryId: "c1", text: "Only phrase", keywords: [], alternatives: [] }],
        records: [],
        disputes: [],
        notes: [],
        audit: [],
        settings: { theme: "dark" } as Partial<AppState["settings"]>,
      }),
    );
    expect(store.result.current.state.categories).toEqual([{ id: "c1", name: "Only category" }]);
    expect(store.result.current.state.phrases).toHaveLength(1);
    expect(store.result.current.state.settings.theme).toBe("dark");
    expect(store.result.current.state.settings.manualTickEnabled).toBe(false);
  });

  it("resets everything back to a fresh install", () => {
    const store = mountAsManager();
    saveRecord(store);
    store.run((s) => s.actions.resetAll());
    expect(store.result.current.state.records).toEqual([]);
    expect(store.result.current.state.session).toBeNull();
    expect(store.result.current.state.users).toHaveLength(1);
  });
});

describe("useFirstAccountRole", () => {
  it("is agent while an administrator exists and admin once none does", () => {
    const { result } = renderHook(
      () => ({ store: useStore(), role: useFirstAccountRole() }),
      { wrapper },
    );
    expect(result.current.role).toBe("agent");

    const adminId = result.current.store.state.users[0].id;
    act(() => result.current.store.actions.deleteUser(adminId));
    expect(result.current.role).toBe("admin");
  });
});
