import type { AppState, EngagementRecord, Role, Team, UserAccount } from "./types";
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from "./checklist";

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
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    phrases: DEFAULT_PHRASES.map((p) => ({ ...p, keywords: [...p.keywords], alternatives: [...p.alternatives] })),
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
        newValue: { version: "2.1.0", note: "Editable checklist, timestamped timeline, team-leader overview. Manual ticking is off until a manager enables it." },
      },
    ],
    settings: {
      theme: "light",
      cloud: { firebaseConfig: null, connected: false },
      sampleDataLoaded: false,
      manualTickEnabled: false,
    },
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
  const pool = [...DEFAULT_PHRASES];
  const out: string[] = [];
  const count = 5 + Math.floor(Math.random() * (DEFAULT_PHRASES.length - 4)); // 5..all
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
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
      const missed = DEFAULT_PHRASES.filter((p) => !checked.includes(p.id)).map((p) => p.id);
      const base = Math.round((checked.length / DEFAULT_PHRASES.length) * 100);
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
        total: DEFAULT_PHRASES.length,
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
