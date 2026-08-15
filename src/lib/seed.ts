import type { AppState, EngagementRecord, Role, Team, UserAccount } from "./types";
import { ENGAGEMENT_ITEMS } from "./checklist";

export const DEFAULT_TEAMS: Team[] = Array.from({ length: 12 }, (_, i) => ({
  id: `ccs${String(i + 1).padStart(2, "0")}`,
  name: `CCS${String(i + 1).padStart(2, "0")}`,
}));

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeUser(partial: Partial<UserAccount> & { name: string }): UserAccount {
  return {
    id: uid(),
    email: undefined,
    team: DEFAULT_TEAMS[0].name,
    role: "agent",
    createdAt: Date.now(),
    ...partial,
  };
}

/** Initial state for a fresh install. Seeds one administrator so roles can be managed. */
export function initialState(): AppState {
  const now = Date.now();
  const admin: UserAccount = makeUser({
    name: "Platform Admin",
    email: "admin@capitecbank.co.za",
    team: "CCS01",
    role: "admin",
    createdAt: now,
  });
  return {
    session: null,
    users: [admin],
    teams: DEFAULT_TEAMS,
    records: [],
    disputes: [],
    notes: [],
    audit: [
      {
        id: uid(),
        ts: now,
        actor: "system",
        action: "platform_initialised",
        entity: "platform",
        newValue: { version: "2.0.0", note: "First account (or seeded admin) owns role management." },
      },
    ],
    settings: { theme: "light", cloud: { firebaseConfig: null, connected: false }, sampleDataLoaded: false },
  };
}

/* ------------------------------------------------------------------ */
/* Sample data (optional, loaded on request from Settings)            */
/* ------------------------------------------------------------------ */

const SAMPLE_AGENTS: { name: string; team: string }[] = [
  { name: "Thandi Nkosi", team: "CCS01" },
  { name: "Lerato Mokoena", team: "CCS01" },
  { name: "Sipho Dlamini", team: "CCS01" },
  { name: "Priya Naidoo", team: "CCS02" },
  { name: "Anele Khumalo", team: "CCS02" },
  { name: "Riaan van Wyk", team: "CCS03" },
];

function pickChecked(): string[] {
  const pool = [...ENGAGEMENT_ITEMS];
  const out: string[] = [];
  const count = 5 + Math.floor(Math.random() * 7); // 5..11 of 11
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].category);
  }
  return out;
}

function makeSampleRecords(): EngagementRecord[] {
  const records: EngagementRecord[] = [];
  const now = Date.now();
  for (const agent of SAMPLE_AGENTS) {
    const streak = agent.name === "Thandi Nkosi" ? 0.85 : agent.name === "Riaan van Wyk" ? 0.5 : 0.7;
    for (let i = 0; i < 14; i++) {
      const dayOffset = 13 - i;
      const savedAt = now - dayOffset * 86_400_000 - Math.floor(Math.random() * 5_000_000);
      const checked = pickChecked();
      const missed = ENGAGEMENT_ITEMS.filter((it) => !checked.includes(it.category)).map((it) => it.category);
      const base = Math.round((checked.length / ENGAGEMENT_ITEMS.length) * 100);
      const drift = Math.round((Math.random() - 0.45) * 12);
      const score = Math.max(18, Math.min(100, Math.round(base * (0.55 + streak * 0.45) + drift)));
      const d = new Date(savedAt);
      records.push({
        id: uid(),
        userName: agent.name,
        team: agent.team,
        dateTime: d.toLocaleString("en-ZA"),
        isoDate: d.toISOString().slice(0, 10),
        savedAt,
        completed: checked.length,
        total: ENGAGEMENT_ITEMS.length,
        score,
        pulseCompleted: Math.random() > 0.35,
        dropped: Math.random() < 0.08,
        checkedItems: checked,
        missedItems: missed,
        status: "active",
      });
    }
  }
  return records;
}

/** Load a realistic sample dataset so dashboards are demoable immediately. */
export function withSampleData(state: AppState): AppState {
  const agents = SAMPLE_AGENTS.map((a, i) =>
    makeUser({
      name: a.name,
      team: a.team,
      role: i < 2 ? "leader" : "agent",
      email: `${a.name.toLowerCase().replace(/\s+/g, ".")}@capitecbank.co.za`,
    }),
  );
  const leader = agents[1];
  const notes = agents.slice(0, 3).flatMap((a) => [
    {
      id: uid(),
      agentName: a.name,
      team: a.team,
      author: leader.name,
      ts: Date.now() - 2 * 86_400_000,
      type: "strength" as const,
      text: "Consistently opens calls with the standard greeting and confirms the next steps clearly.",
    },
    {
      id: uid(),
      agentName: a.name,
      team: a.team,
      author: leader.name,
      ts: Date.now() - 1 * 86_400_000,
      type: "improvement" as const,
      text: "Work on empathetic statements earlier in the call and probe for underlying objections.",
    },
  ]);
  return {
    ...state,
    users: [...state.users, ...agents],
    records: makeSampleRecords(),
    notes,
    settings: { ...state.settings, sampleDataLoaded: true },
  };
}

/** Role used for the very first sign-up when no admin exists yet. */
export function firstAccountRole(state: AppState): Role {
  return state.users.some((u) => u.role === "admin") ? "agent" : "admin";
}
