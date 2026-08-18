import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectCloud, disconnectCloud, pullCloudRecords, pushCloudRecords } from "./cloud";
import { makeRecord } from "../test/factories";

interface FakeDoc {
  id: string;
  data(): Record<string, unknown>;
}

function fakeFirebase(docs: FakeDoc[] = []) {
  const added: Record<string, unknown>[] = [];
  const collection = vi.fn(() => ({
    get: vi.fn(async () => ({ docs })),
    add: vi.fn(async (data: Record<string, unknown>) => {
      added.push(data);
    }),
  }));
  const firebase = {
    apps: { length: 0 },
    initializeApp: vi.fn(() => {
      firebase.apps.length = 1;
    }),
    firestore: vi.fn(() => ({ collection })),
  };
  return { firebase, added, collection };
}

function setFirebase(firebase: unknown) {
  (window as unknown as { firebase?: unknown }).firebase = firebase;
}

beforeEach(() => {
  setFirebase(undefined);
  disconnectCloud();
});

afterEach(() => {
  setFirebase(undefined);
  vi.restoreAllMocks();
});

describe("connectCloud", () => {
  it("initialises an app once the SDK is present", async () => {
    const { firebase } = fakeFirebase();
    setFirebase(firebase);
    await expect(connectCloud({ projectId: "p" })).resolves.toEqual({ ok: true });
    expect(firebase.initializeApp).toHaveBeenCalledWith({ projectId: "p" });
    expect(firebase.firestore).toHaveBeenCalledOnce();
  });

  it("reuses an already initialised app", async () => {
    const { firebase } = fakeFirebase();
    firebase.apps.length = 1;
    setFirebase(firebase);
    await connectCloud({});
    expect(firebase.initializeApp).not.toHaveBeenCalled();
  });

  it("loads the compat SDK from the CDN when it is missing", async () => {
    const { firebase } = fakeFirebase();
    const appended: string[] = [];
    vi.spyOn(document.head, "appendChild").mockImplementation(((node: Node) => {
      const script = node as HTMLScriptElement;
      appended.push(script.src);
      setFirebase(firebase);
      script.onload?.(new Event("load"));
      return node;
    }) as typeof document.head.appendChild);

    await expect(connectCloud({})).resolves.toEqual({ ok: true });
    expect(appended).toHaveLength(2);
    expect(appended[0]).toContain("firebase-app-compat.js");
    expect(appended[1]).toContain("firebase-firestore-compat.js");
  });

  it("reports a failed script load instead of throwing", async () => {
    vi.spyOn(document.head, "appendChild").mockImplementation(((node: Node) => {
      (node as HTMLScriptElement).onerror?.(new Event("error"));
      return node;
    }) as typeof document.head.appendChild);
    const result = await connectCloud({});
    expect(result.ok).toBe(false);
    expect(result.error).toContain("firebase-app-compat.js");
  });

  it("reports when the SDK loads but never registers itself", async () => {
    vi.spyOn(document.head, "appendChild").mockImplementation(((node: Node) => {
      (node as HTMLScriptElement).onload?.(new Event("load"));
      return node;
    }) as typeof document.head.appendChild);
    await expect(connectCloud({})).resolves.toEqual({
      ok: false,
      error: "Firebase SDK could not be loaded",
    });
  });
});

describe("pullCloudRecords", () => {
  it("throws until connected", async () => {
    await expect(pullCloudRecords()).rejects.toThrow("Not connected");
  });

  it("maps documents to engagement records with defaults", async () => {
    const { firebase } = fakeFirebase([
      { id: "doc-1", data: () => ({ score: 88, userName: "Thandi Nkosi", team: "CCS02", checkedItems: ["p-greeting"], transcript: "hello" }) },
      { id: "doc-2", data: () => ({ score: 0 }) },
    ]);
    setFirebase(firebase);
    await connectCloud({});

    const [full, sparse] = await pullCloudRecords();
    expect(full).toMatchObject({
      id: "doc-1",
      userName: "Thandi Nkosi",
      team: "CCS02",
      score: 88,
      checkedItems: ["p-greeting"],
      transcript: "hello",
      status: "active",
    });
    expect(sparse).toMatchObject({ userName: "Unknown", team: "CCS01", checkedItems: [], missedItems: [] });
    expect(sparse.isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sparse.transcript).toBeUndefined();
  });

  it("skips documents that are not engagements", async () => {
    const { firebase } = fakeFirebase([{ id: "junk", data: () => ({ note: "not an engagement" }) }]);
    setFirebase(firebase);
    await connectCloud({});
    await expect(pullCloudRecords()).resolves.toEqual([]);
  });
});

describe("pushCloudRecords", () => {
  it("throws until connected", async () => {
    await expect(pushCloudRecords([makeRecord()])).rejects.toThrow("Not connected");
  });

  it("uploads each record without its local id and status", async () => {
    const { firebase, added, collection } = fakeFirebase();
    setFirebase(firebase);
    await connectCloud({});

    const pushed = await pushCloudRecords([makeRecord({ id: "local-1" }), makeRecord({ id: "local-2" })]);
    expect(pushed).toBe(2);
    expect(collection).toHaveBeenCalledWith("engagements");
    expect(added[0]).toMatchObject({ cloudId: "local-1", userName: "Thandi Nkosi" });
    expect(added[0]).not.toHaveProperty("id");
    expect(added[0]).not.toHaveProperty("status");
  });
});

describe("disconnectCloud", () => {
  it("drops the connection", async () => {
    const { firebase } = fakeFirebase();
    setFirebase(firebase);
    await connectCloud({});
    disconnectCloud();
    await expect(pullCloudRecords()).rejects.toThrow("Not connected");
  });
});
