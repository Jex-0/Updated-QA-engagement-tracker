export type Role = "agent" | "leader" | "manager" | "admin";

export const ROLES: Role[] = ["agent", "leader", "manager", "admin"];

export const ROLE_LABEL: Record<Role, string> = {
  agent: "Agent",
  leader: "Team Leader",
  manager: "Manager",
  admin: "Administrator",
};

export interface Team {
  id: string;
  name: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email?: string;
  team: string;
  role: Role;
  createdAt: number;
  online?: boolean;
  lastSeen?: number;
}

/** A QA category (e.g. "Greeting", "Empathy"). Managers can add, rename and remove these. */
export interface ChecklistCategory {
  id: string;
  name: string;
}

/**
 * A single tickable phrase inside a category.
 * - `keywords` drive the live speech assistant (auto-tick when spoken).
 * - `alternatives` are acceptable variations agents can pick from the dropdown
 *   when manual ticking is enabled — the box still ticks, the variation is recorded.
 */
export interface Phrase {
  id: string;
  categoryId: string;
  text: string;
  keywords: string[];
  alternatives: string[];
}

export type EventType =
  | "greeting"
  | "empathy"
  | "compliance"
  | "objection"
  | "quality"
  | "upsell"
  | "coaching"
  | "pulse"
  | "system";

export interface TimelineEvent {
  id: string;
  /** seconds from call start */
  seconds: number;
  type: EventType;
  label: string;
  detail: string;
  /** how the moment was captured */
  source?: "speech" | "manual";
  /** the alternative phrasing the agent said (manual ticks) */
  variant?: string;
  /** true when the moment represents a missed opportunity / coaching point */
  missed?: boolean;
}

export interface ReviewNote {
  by: string;
  at: number;
  note: string;
}

export interface ScoreCorrection {
  by: string;
  at: number;
  oldScore: number;
  newScore: number;
  reason: string;
}

export interface EngagementRecord {
  id: string;
  userName: string;
  team: string;
  uid?: string | null;
  dateTime: string;
  isoDate: string;
  savedAt: number;
  completed: number;
  total: number;
  score: number;
  pulseCompleted: boolean;
  dropped: boolean;
  /** phrase ids (legacy records may contain category names) */
  checkedItems: string[];
  missedItems: string[];
  transcript?: string;
  timeline?: TimelineEvent[];
  notes?: string;
  reviewed?: ReviewNote | null;
  status: "active" | "archived";
  archivedAt?: number;
  archivedBy?: string;
  corrected?: ScoreCorrection | null;
}

export type DisputeStatus = "open" | "approved" | "rejected";

export interface Dispute {
  id: string;
  engagementId: string;
  agentName: string;
  team: string;
  score: number;
  reason: string;
  openedBy: string;
  openedAt: number;
  status: DisputeStatus;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: number;
  adjustedScore?: number;
}

export interface CoachingNote {
  id: string;
  agentName: string;
  team: string;
  author: string;
  ts: number;
  type: "strength" | "improvement";
  text: string;
}

export interface AuditEntry {
  id: string;
  ts: number;
  actor: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface Session {
  name: string;
  team: string;
  role: Role;
  email?: string;
}

export interface CloudSettings {
  /** raw firebaseConfig object pasted by the user, or null */
  firebaseConfig: unknown | null;
  connected: boolean;
  lastSyncAt?: number;
}

export interface AppSettings {
  theme: "light" | "dark";
  cloud: CloudSettings;
  sampleDataLoaded: boolean;
  /**
   * Manual ticking is OFF by default — phrases are captured automatically by the
   * speech assistant. Only managers/admins can re-enable it (one click, global).
   */
  manualTickEnabled: boolean;
}

export interface AppState {
  session: Session | null;
  users: UserAccount[];
  teams: Team[];
  categories: ChecklistCategory[];
  phrases: Phrase[];
  records: EngagementRecord[];
  disputes: Dispute[];
  notes: CoachingNote[];
  audit: AuditEntry[];
  settings: AppSettings;
}

export interface RecordDraft {
  userName: string;
  team: string;
  checkedItems: string[];
  missedItems: string[];
  pulseCompleted: boolean;
  dropped: boolean;
  transcript?: string;
  timeline?: TimelineEvent[];
  notes?: string;
}
