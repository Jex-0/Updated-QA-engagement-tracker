import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type {
  AppState,
  AuditEntry,
  ChecklistCategory,
  CoachingNote,
  Dispute,
  EngagementRecord,
  Phrase,
  RecordDraft,
  Role,
  Team,
  UserAccount,
} from "./types";
import { firstAccountRole, initialState, uid, withSampleData } from "./seed";
import { DEFAULT_CATEGORIES, DEFAULT_PHRASES } from "./checklist";

const STORAGE_KEY = "qe-platform-v2";

/* ------------------------------- helpers ------------------------------ */

function audit(action: string, entity: string, actor: string, oldValue?: unknown, newValue?: unknown, entityId?: string): AuditEntry {
  return { id: uid(), ts: Date.now(), actor, action, entity, entityId, oldValue, newValue };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppState>;
      if (parsed && parsed.users && parsed.teams && parsed.settings) {
        const base = initialState();
        return {
          ...base,
          ...parsed,
          // newer fields merged so old saved state keeps working
          categories: parsed.categories?.length ? parsed.categories : base.categories,
          phrases: parsed.phrases?.length ? parsed.phrases : base.phrases,
          settings: { ...base.settings, ...parsed.settings },
        };
      }
    }
  } catch {
    /* corrupted state — fall through to a fresh install */
  }
  return initialState();
}

/* ------------------------------- reducer ------------------------------ */

type Action =
  | { type: "LOGIN"; session: AppState["session"] }
  | { type: "LOGOUT" }
  | { type: "SAVE_RECORD"; record: EngagementRecord; actor: string }
  | { type: "DELETE_RECORD"; id: string; actor: string; hard?: boolean }
  | { type: "ARCHIVE_RECORD"; id: string; actor: string }
  | { type: "RESTORE_RECORD"; id: string; actor: string }
  | { type: "CORRECT_SCORE"; id: string; newScore: number; reason: string; actor: string }
  | { type: "REVIEW_RECORD"; id: string; note: string; actor: string }
  | { type: "OPEN_DISPUTE"; dispute: Dispute; actor: string }
  | { type: "RESOLVE_DISPUTE"; id: string; status: "approved" | "rejected"; resolution: string; adjustedScore?: number; actor: string }
  | { type: "ADD_NOTE"; note: CoachingNote; actor: string }
  | { type: "ADD_USER"; user: UserAccount; actor: string }
  | { type: "UPDATE_USER"; id: string; patch: Partial<UserAccount>; actor: string }
  | { type: "DELETE_USER"; id: string; actor: string }
  | { type: "ADD_TEAM"; team: Team; actor: string }
  | { type: "DELETE_TEAM"; id: string; actor: string }
  | { type: "SET_THEME"; theme: "light" | "dark" }
  | { type: "SET_CLOUD"; patch: Partial<AppState["settings"]["cloud"]> }
  | { type: "SET_MANUAL_TICK"; enabled: boolean; actor: string }
  | { type: "ADD_CATEGORY"; category: ChecklistCategory; actor: string }
  | { type: "UPDATE_CATEGORY"; id: string; name: string; actor: string }
  | { type: "DELETE_CATEGORY"; id: string; actor: string }
  | { type: "ADD_PHRASE"; phrase: Phrase; actor: string }
  | { type: "UPDATE_PHRASE"; id: string; patch: Partial<Phrase>; actor: string }
  | { type: "DELETE_PHRASE"; id: string; actor: string }
  | { type: "LOAD_SAMPLE_DATA" }
  | { type: "IMPORT_RECORDS"; records: EngagementRecord[]; actor: string }
  | { type: "RESTORE_BACKUP"; backup: { users: UserAccount[]; teams: Team[]; categories?: ChecklistCategory[]; phrases?: Phrase[]; records: EngagementRecord[]; disputes: Dispute[]; notes: CoachingNote[]; audit: AuditEntry[]; settings?: Partial<AppState["settings"]> }; actor: string }
  | { type: "RESET_ALL" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "LOGIN":
      return { ...state, session: action.session };
    case "LOGOUT":
      return { ...state, session: null };
    case "SAVE_RECORD": {
      const entry = audit("engagement_saved", "engagement", action.actor, undefined, {
        id: action.record.id,
        score: action.record.score,
      });
      return { ...state, records: [action.record, ...state.records], audit: [entry, ...state.audit] };
    }
    case "DELETE_RECORD": {
      const rec = state.records.find((r) => r.id === action.id);
      if (!rec) return state;
      const entry = audit("engagement_deleted", "engagement", action.actor, rec, undefined, action.id);
      return { ...state, records: state.records.filter((r) => r.id !== action.id), audit: [entry, ...state.audit] };
    }
    case "ARCHIVE_RECORD": {
      const rec = state.records.find((r) => r.id === action.id);
      if (!rec || rec.status === "archived") return state;
      const updated = { ...rec, status: "archived" as const, archivedAt: Date.now(), archivedBy: action.actor };
      const entry = audit("engagement_archived", "engagement", action.actor, { status: rec.status }, { status: "archived" }, action.id);
      return {
        ...state,
        records: state.records.map((r) => (r.id === action.id ? updated : r)),
        audit: [entry, ...state.audit],
      };
    }
    case "RESTORE_RECORD": {
      const rec = state.records.find((r) => r.id === action.id);
      if (!rec || rec.status !== "archived") return state;
      const updated = { ...rec, status: "active" as const, archivedAt: undefined, archivedBy: undefined };
      const entry = audit("engagement_restored", "engagement", action.actor, { status: rec.status }, { status: "active" }, action.id);
      return {
        ...state,
        records: state.records.map((r) => (r.id === action.id ? updated : r)),
        audit: [entry, ...state.audit],
      };
    }
    case "CORRECT_SCORE": {
      const rec = state.records.find((r) => r.id === action.id);
      if (!rec) return state;
      const updated = {
        ...rec,
        corrected: { by: action.actor, at: Date.now(), oldScore: rec.score, newScore: action.newScore, reason: action.reason },
      };
      const entry = audit("engagement_score_corrected", "engagement", action.actor, { score: rec.score }, { score: action.newScore, reason: action.reason }, action.id);
      return { ...state, records: state.records.map((r) => (r.id === action.id ? updated : r)), audit: [entry, ...state.audit] };
    }
    case "REVIEW_RECORD": {
      const rec = state.records.find((r) => r.id === action.id);
      if (!rec) return state;
      const updated = { ...rec, reviewed: { by: action.actor, at: Date.now(), note: action.note } };
      const entry = audit("engagement_reviewed", "engagement", action.actor, undefined, { note: action.note }, action.id);
      return { ...state, records: state.records.map((r) => (r.id === action.id ? updated : r)), audit: [entry, ...state.audit] };
    }
    case "OPEN_DISPUTE": {
      const entry = audit("dispute_opened", "dispute", action.actor, undefined, { reason: action.dispute.reason }, action.dispute.id);
      return { ...state, disputes: [action.dispute, ...state.disputes], audit: [entry, ...state.audit] };
    }
    case "RESOLVE_DISPUTE": {
      const d = state.disputes.find((x) => x.id === action.id);
      if (!d) return state;
      const adjScore = action.adjustedScore;
      const resolved: Dispute = {
        ...d,
        status: action.status,
        resolution: action.resolution,
        resolvedBy: action.actor,
        resolvedAt: Date.now(),
        adjustedScore: adjScore ?? d.adjustedScore,
      };
      let records = state.records;
      let auditList = state.audit;
      if (action.status === "approved" && adjScore != null) {
        const rec = state.records.find((r) => r.id === d.engagementId);
        if (rec) {
          records = state.records.map((r) =>
            r.id === d.engagementId
              ? { ...r, corrected: { by: action.actor, at: Date.now(), oldScore: rec.score, newScore: adjScore, reason: `Dispute approved: ${action.resolution}` } }
              : r,
          );
          auditList = [
            audit("engagement_score_corrected", "engagement", action.actor, { score: rec.score }, { score: adjScore, reason: "dispute approval" }, rec.id),
            ...auditList,
          ];
        }
      }
      const entry = audit("dispute_resolved", "dispute", action.actor, { status: d.status }, { status: action.status, resolution: action.resolution }, action.id);
      return { ...state, disputes: state.disputes.map((x) => (x.id === action.id ? resolved : x)), records, audit: [entry, ...auditList] };
    }
    case "ADD_NOTE": {
      const entry = audit("coaching_note_added", "coaching", action.actor, undefined, { note: action.note.text, agent: action.note.agentName });
      return { ...state, notes: [action.note, ...state.notes], audit: [entry, ...state.audit] };
    }
    case "ADD_USER": {
      const entry = audit("user_created", "user", action.actor, undefined, { name: action.user.name, role: action.user.role, team: action.user.team }, action.user.id);
      return { ...state, users: [...state.users, action.user], audit: [entry, ...state.audit] };
    }
    case "UPDATE_USER": {
      const prev = state.users.find((u) => u.id === action.id);
      if (!prev) return state;
      const updated = { ...prev, ...action.patch };
      const entry = audit("user_updated", "user", action.actor, { name: prev.name, role: prev.role, team: prev.team }, action.patch, action.id);
      return { ...state, users: state.users.map((u) => (u.id === action.id ? updated : u)), audit: [entry, ...state.audit] };
    }
    case "DELETE_USER": {
      const prev = state.users.find((u) => u.id === action.id);
      if (!prev) return state;
      const entry = audit("user_deleted", "user", action.actor, { name: prev.name, role: prev.role }, undefined, action.id);
      return { ...state, users: state.users.filter((u) => u.id !== action.id), audit: [entry, ...state.audit] };
    }
    case "ADD_TEAM": {
      const entry = audit("team_created", "team", action.actor, undefined, { name: action.team.name }, action.team.id);
      return { ...state, teams: [...state.teams, action.team], audit: [entry, ...state.audit] };
    }
    case "DELETE_TEAM": {
      const prev = state.teams.find((t) => t.id === action.id);
      if (!prev) return state;
      const entry = audit("team_deleted", "team", action.actor, { name: prev.name }, undefined, action.id);
      return { ...state, teams: state.teams.filter((t) => t.id !== action.id), audit: [entry, ...state.audit] };
    }
    case "SET_THEME":
      return { ...state, settings: { ...state.settings, theme: action.theme } };
    case "SET_CLOUD":
      return { ...state, settings: { ...state.settings, cloud: { ...state.settings.cloud, ...action.patch } } };
    case "SET_MANUAL_TICK": {
      if (state.settings.manualTickEnabled === action.enabled) return state;
      const entry = audit("manual_ticking_changed", "settings", action.actor, { manualTickEnabled: state.settings.manualTickEnabled }, { manualTickEnabled: action.enabled });
      return { ...state, settings: { ...state.settings, manualTickEnabled: action.enabled }, audit: [entry, ...state.audit] };
    }
    case "ADD_CATEGORY": {
      const entry = audit("category_created", "checklist", action.actor, undefined, { name: action.category.name }, action.category.id);
      return { ...state, categories: [...state.categories, action.category], audit: [entry, ...state.audit] };
    }
    case "UPDATE_CATEGORY": {
      const prev = state.categories.find((c) => c.id === action.id);
      if (!prev) return state;
      const updated = { ...prev, name: action.name };
      const entry = audit("category_updated", "checklist", action.actor, { name: prev.name }, { name: action.name }, action.id);
      return { ...state, categories: state.categories.map((c) => (c.id === action.id ? updated : c)), audit: [entry, ...state.audit] };
    }
    case "DELETE_CATEGORY": {
      const prev = state.categories.find((c) => c.id === action.id);
      if (!prev) return state;
      const removedPhrases = state.phrases.filter((p) => p.categoryId === action.id);
      const entry = audit(
        "category_deleted",
        "checklist",
        action.actor,
        { name: prev.name, phrases: removedPhrases.length },
        undefined,
        action.id,
      );
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        phrases: state.phrases.filter((p) => p.categoryId !== action.id),
        audit: [entry, ...state.audit],
      };
    }
    case "ADD_PHRASE": {
      const entry = audit("phrase_created", "checklist", action.actor, undefined, { text: action.phrase.text, categoryId: action.phrase.categoryId }, action.phrase.id);
      return { ...state, phrases: [...state.phrases, action.phrase], audit: [entry, ...state.audit] };
    }
    case "UPDATE_PHRASE": {
      const prev = state.phrases.find((p) => p.id === action.id);
      if (!prev) return state;
      const updated = { ...prev, ...action.patch };
      const entry = audit("phrase_updated", "checklist", action.actor, { text: prev.text, keywords: prev.keywords, alternatives: prev.alternatives }, action.patch, action.id);
      return { ...state, phrases: state.phrases.map((p) => (p.id === action.id ? updated : p)), audit: [entry, ...state.audit] };
    }
    case "DELETE_PHRASE": {
      const prev = state.phrases.find((p) => p.id === action.id);
      if (!prev) return state;
      const entry = audit("phrase_deleted", "checklist", action.actor, { text: prev.text }, undefined, action.id);
      return { ...state, phrases: state.phrases.filter((p) => p.id !== action.id), audit: [entry, ...state.audit] };
    }
    case "LOAD_SAMPLE_DATA":
      return withSampleData(state);
    case "IMPORT_RECORDS": {
      const entry = audit("records_imported", "engagement", action.actor, undefined, { count: action.records.length });
      return { ...state, records: [...action.records, ...state.records], audit: [entry, ...state.audit] };
    }
    case "RESTORE_BACKUP": {
      const entry = audit("backup_restored", "platform", action.actor, undefined, {
        users: action.backup.users.length,
        records: action.backup.records.length,
      });
      const base = initialState();
      return {
        ...state,
        users: action.backup.users,
        teams: action.backup.teams,
        categories: action.backup.categories?.length ? action.backup.categories : state.categories,
        phrases: action.backup.phrases?.length ? action.backup.phrases : state.phrases,
        records: action.backup.records,
        disputes: action.backup.disputes,
        notes: action.backup.notes,
        audit: [entry, ...action.backup.audit],
        settings: action.backup.settings ? { ...base.settings, ...state.settings, ...action.backup.settings } : state.settings,
      };
    }
    case "RESET_ALL":
      return initialState();
    default:
      return state;
  }
}

/* -------------------------------- context ----------------------------- */

interface StoreValue {
  state: AppState;
  dispatch: (action: Action) => void;
  actions: {
    login(name: string, team: string, role: Role, email?: string): void;
    logout(): void;
    saveEngagement(draft: RecordDraft): EngagementRecord;
    deleteEngagement(id: string, hard?: boolean): void;
    archiveEngagement(id: string): void;
    restoreEngagement(id: string): void;
    correctScore(id: string, newScore: number, reason: string): void;
    reviewEngagement(id: string, note: string): void;
    openDispute(engagementId: string, reason: string): void;
    resolveDispute(id: string, status: "approved" | "rejected", resolution: string, adjustedScore?: number): void;
    addNote(agentName: string, team: string, type: "strength" | "improvement", text: string): void;
    addUser(name: string, team: string, role: Role, email?: string): void;
    updateUser(id: string, patch: Partial<UserAccount>): void;
    deleteUser(id: string): void;
    addTeam(name: string): void;
    deleteTeam(id: string): void;
    setTheme(theme: "light" | "dark"): void;
    setCloud(patch: Partial<AppState["settings"]["cloud"]>): void;
    setManualTick(enabled: boolean): void;
    addCategory(name: string): void;
    updateCategory(id: string, name: string): void;
    deleteCategory(id: string): void;
    addPhrase(categoryId: string, text: string, keywords: string[], alternatives: string[]): void;
    updatePhrase(id: string, patch: Partial<Phrase>): void;
    deletePhrase(id: string): void;
    loadSampleData(): void;
    importRecords(records: EngagementRecord[]): void;
    restoreBackup(backup: { users: UserAccount[]; teams: Team[]; categories?: ChecklistCategory[]; phrases?: Phrase[]; records: EngagementRecord[]; disputes: Dispute[]; notes: CoachingNote[]; audit: AuditEntry[]; settings?: Partial<AppState["settings"]> }): void;
    resetAll(): void;
  };
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable — app continues in memory */
    }
  }, [state]);

  const value = useMemo<StoreValue>(() => {
    const actor = state.session?.name ?? "system";
    const actions: StoreValue["actions"] = {
      login(name, team, role, email) {
        dispatch({ type: "LOGIN", session: { name, team, role, email } });
      },
      logout() {
        dispatch({ type: "LOGOUT" });
      },
      saveEngagement(draft) {
        const checkedItems = [...draft.checkedItems];
        const missedItems = [...draft.missedItems];
        const total = Math.max(state.phrases.length, 1);
        const completed = checkedItems.length;
        const score = Math.round((completed / total) * 100);
        const savedAt = Date.now();
        const record: EngagementRecord = {
          id: uid(),
          userName: draft.userName,
          team: draft.team,
          dateTime: new Date().toLocaleString("en-ZA"),
          isoDate: new Date().toISOString().slice(0, 10),
          savedAt,
          completed,
          total,
          score,
          pulseCompleted: draft.pulseCompleted,
          dropped: draft.dropped,
          checkedItems,
          missedItems,
          transcript: draft.transcript,
          timeline: draft.timeline,
          notes: draft.notes,
          status: "active",
        };
        dispatch({ type: "SAVE_RECORD", record, actor });
        return record;
      },
      deleteEngagement(id, hard) {
        dispatch({ type: "DELETE_RECORD", id, actor, hard });
      },
      archiveEngagement(id) {
        dispatch({ type: "ARCHIVE_RECORD", id, actor });
      },
      restoreEngagement(id) {
        dispatch({ type: "RESTORE_RECORD", id, actor });
      },
      correctScore(id, newScore, reason) {
        dispatch({ type: "CORRECT_SCORE", id, newScore, reason, actor });
      },
      reviewEngagement(id, note) {
        dispatch({ type: "REVIEW_RECORD", id, note, actor });
      },
      openDispute(engagementId, reason) {
        const rec = state.records.find((r) => r.id === engagementId);
        if (!rec) return;
        const dispute: Dispute = {
          id: uid(),
          engagementId,
          agentName: rec.userName,
          team: rec.team,
          score: rec.corrected?.newScore ?? rec.score,
          reason,
          openedBy: actor,
          openedAt: Date.now(),
          status: "open",
        };
        dispatch({ type: "OPEN_DISPUTE", dispute, actor });
      },
      resolveDispute(id, status, resolution, adjustedScore) {
        dispatch({ type: "RESOLVE_DISPUTE", id, status, resolution, adjustedScore, actor });
      },
      addNote(agentName, team, type, text) {
        const note: CoachingNote = { id: uid(), agentName, team, author: actor, ts: Date.now(), type, text };
        dispatch({ type: "ADD_NOTE", note, actor });
      },
      addUser(name, team, role, email) {
        const user: UserAccount = { id: uid(), name, team, role, email, createdAt: Date.now() };
        dispatch({ type: "ADD_USER", user, actor });
      },
      updateUser(id, patch) {
        dispatch({ type: "UPDATE_USER", id, patch, actor });
      },
      deleteUser(id) {
        dispatch({ type: "DELETE_USER", id, actor });
      },
      addTeam(name) {
        dispatch({ type: "ADD_TEAM", team: { id: uid(), name }, actor });
      },
      deleteTeam(id) {
        dispatch({ type: "DELETE_TEAM", id, actor });
      },
      setTheme(theme) {
        dispatch({ type: "SET_THEME", theme });
      },
      setCloud(patch) {
        dispatch({ type: "SET_CLOUD", patch });
      },
      setManualTick(enabled) {
        dispatch({ type: "SET_MANUAL_TICK", enabled, actor });
      },
      addCategory(name) {
        const category: ChecklistCategory = { id: uid(), name };
        dispatch({ type: "ADD_CATEGORY", category, actor });
      },
      updateCategory(id, name) {
        dispatch({ type: "UPDATE_CATEGORY", id, name, actor });
      },
      deleteCategory(id) {
        dispatch({ type: "DELETE_CATEGORY", id, actor });
      },
      addPhrase(categoryId, text, keywords, alternatives) {
        const phrase: Phrase = { id: uid(), categoryId, text, keywords, alternatives };
        dispatch({ type: "ADD_PHRASE", phrase, actor });
      },
      updatePhrase(id, patch) {
        dispatch({ type: "UPDATE_PHRASE", id, patch, actor });
      },
      deletePhrase(id) {
        dispatch({ type: "DELETE_PHRASE", id, actor });
      },
      loadSampleData() {
        dispatch({ type: "LOAD_SAMPLE_DATA" });
      },
      importRecords(records) {
        dispatch({ type: "IMPORT_RECORDS", records, actor });
      },
      restoreBackup(backup) {
        dispatch({ type: "RESTORE_BACKUP", backup, actor });
      },
      resetAll() {
        dispatch({ type: "RESET_ALL" });
      },
    };
    return { state, dispatch, actions };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** Convenience: the role the very first sign-up should receive. */
export function useFirstAccountRole(): Role {
  const { state } = useStore();
  return firstAccountRole(state);
}

export type { Action };

export { DEFAULT_CATEGORIES, DEFAULT_PHRASES };
