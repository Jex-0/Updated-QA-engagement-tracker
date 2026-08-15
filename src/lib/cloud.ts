import type { EngagementRecord } from "./types";

/**
 * Optional cloud sync adapter. Restores the original app's Firebase Firestore
 * data path without a build-time dependency: the compat SDK is loaded from
 * Google's CDN only when the user pastes a config and connects.
 */

type FirebaseNamespace = {
  apps: { length: number };
  initializeApp(config: unknown): void;
  firestore(): FirestoreLike;
};

interface FirestoreLike {
  collection(name: string): CollectionLike;
}

interface CollectionLike {
  get(): Promise<{ docs: { id: string; data(): Record<string, unknown> }[] }>;
  add(data: Record<string, unknown>): Promise<unknown>;
}

declare global {
  interface Window {
    firebase?: FirebaseNamespace;
  }
}

let db: FirestoreLike | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function connectCloud(config: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!window.firebase) {
      await loadScript("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js");
    }
    if (!window.firebase) throw new Error("Firebase SDK could not be loaded");
    if (!window.firebase.apps.length) window.firebase.initializeApp(config);
    db = window.firebase.firestore();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function recordFromDoc(doc: { id: string; data(): Record<string, unknown> }): EngagementRecord | null {
  const d = doc.data();
  if (!d || typeof d.score !== "number") return null;
  return {
    id: doc.id.startsWith("engagement:") ? doc.id : doc.id,
    userName: String(d.userName ?? "Unknown"),
    team: String(d.team ?? "CCS01"),
    uid: d.uid ? String(d.uid) : null,
    dateTime: String(d.dateTime ?? ""),
    isoDate: String(d.isoDate ?? new Date().toISOString().slice(0, 10)),
    savedAt: Number(d.savedAt ?? Date.now()),
    completed: Number(d.completed ?? 0),
    total: Number(d.total ?? 0),
    score: Number(d.score ?? 0),
    pulseCompleted: !!d.pulseCompleted,
    dropped: !!d.dropped,
    checkedItems: Array.isArray(d.checkedItems) ? d.checkedItems.map(String) : [],
    missedItems: Array.isArray(d.missedItems) ? d.missedItems.map(String) : [],
    transcript: d.transcript ? String(d.transcript) : undefined,
    status: "active",
  };
}

export async function pullCloudRecords(): Promise<EngagementRecord[]> {
  if (!db) throw new Error("Not connected");
  const snap = await db.collection("engagements").get();
  return snap.docs.map(recordFromDoc).filter((r): r is EngagementRecord => r != null);
}

export async function pushCloudRecords(records: EngagementRecord[]): Promise<number> {
  if (!db) throw new Error("Not connected");
  let pushed = 0;
  for (const r of records) {
    const { id: _id, status: _status, ...payload } = r;
    await db.collection("engagements").add({ ...payload, cloudId: r.id });
    pushed++;
  }
  return pushed;
}

export function disconnectCloud(): void {
  db = null;
}
