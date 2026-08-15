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

export interface ChecklistItem {
  category: string;
  phrase: string;
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
}

export interface AppState {
  session: Session | null;
  users: UserAccount[];
  teams: Team[];
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
