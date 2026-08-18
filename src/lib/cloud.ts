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

const CONFIG_KEYS = [
  "apiKey",
  "authDomain",
  "databaseURL",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
  "measurementId",
] as const;

export type FirebaseConfig = Partial<Record<(typeof CONFIG_KEYS)[number], string>>;

/**
 * Read a pasted `firebaseConfig` object without executing it: the JS object
 * literal is normalised to JSON, parsed, and every key/value is validated.
 */
export function parseFirebaseConfig(text: string): FirebaseConfig {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Paste the firebaseConfig object first");
  const json = text
    .slice(start, end + 1)
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/'([^'\\\n]*)'/g, '"$1"')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/,(\s*[}\]])/g, "$1");

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That does not look like a firebaseConfig object — copy it from the Firebase console");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a firebaseConfig object");
  }

  const config: FirebaseConfig = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!(CONFIG_KEYS as readonly string[]).includes(key)) continue;
    if (typeof value !== "string") throw new Error(`Config value for "${key}" must be text`);
    config[key as keyof FirebaseConfig] = value;
  }
  if (!config.apiKey || !config.projectId) throw new Error("Config needs at least apiKey and projectId");
  return config;
}

/** Pinned SDK bundles with their Subresource Integrity digests. */
const FIREBASE_SDK = [
  {
    src: "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js",
    integrity: "sha384-yuGdyIzzYtOBlBG6JOWn+Ey9kpq7HocusNuxEGyyohr1eEyXpeEyehIIXC/hznw4",
  },
  {
    src: "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js",
    integrity: "sha384-nwX2Qpkhc2sv6L0ZPkLefLGguao67toSowvePuQvGF6cG+8MUphGI2uI94Ls3JF7",
  },
];

function loadScript(src: string, integrity: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.integrity = integrity;
    s.crossOrigin = "anonymous";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export async function connectCloud(config: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!window.firebase) {
      for (const { src, integrity } of FIREBASE_SDK) await loadScript(src, integrity);
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
