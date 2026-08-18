import { describe, expect, it } from "vitest";
import { parseHash, routeToHash, type Route, type RouteName } from "./router";

const SIMPLE: RouteName[] = ["auth", "tracker", "dashboard", "engagements", "manager", "admin", "reports", "settings"];

describe("routeToHash", () => {
  it("maps parameterless routes to their hash", () => {
    for (const name of SIMPLE) expect(routeToHash({ name })).toBe(`#/${name}`);
  });

  it("encodes engagement and agent params", () => {
    expect(routeToHash({ name: "engagement", params: { id: "abc/1" } })).toBe("#/engagement/abc%2F1");
    expect(routeToHash({ name: "agent", params: { name: "Riaan van Wyk", team: "CCS 03" } })).toBe(
      "#/agent/Riaan%20van%20Wyk/CCS%2003",
    );
  });

  it("falls back to empty params when they are missing", () => {
    expect(routeToHash({ name: "engagement" })).toBe("#/engagement/");
    expect(routeToHash({ name: "agent" })).toBe("#/agent//");
  });

  it("returns the root hash for unknown routes", () => {
    expect(routeToHash({ name: "nope" } as unknown as Route)).toBe("#/");
  });
});

describe("parseHash", () => {
  it("parses parameterless routes", () => {
    for (const name of SIMPLE) expect(parseHash(`#/${name}`)).toEqual({ name });
  });

  it("tolerates missing hash and slash prefixes", () => {
    expect(parseHash("tracker")).toEqual({ name: "tracker" });
    expect(parseHash("#tracker")).toEqual({ name: "tracker" });
    expect(parseHash("#/tracker/")).toEqual({ name: "tracker" });
  });

  it("decodes engagement and agent params", () => {
    expect(parseHash("#/engagement/abc%2F1")).toEqual({ name: "engagement", params: { id: "abc/1" } });
    expect(parseHash("#/agent/Riaan%20van%20Wyk/CCS%2003")).toEqual({
      name: "agent",
      params: { name: "Riaan van Wyk", team: "CCS 03" },
    });
  });

  it("defaults missing params to empty strings", () => {
    expect(parseHash("#/engagement")).toEqual({ name: "engagement", params: { id: "" } });
    expect(parseHash("#/agent")).toEqual({ name: "agent", params: { name: "", team: "" } });
    expect(parseHash("#/agent/Thandi")).toEqual({ name: "agent", params: { name: "Thandi", team: "" } });
  });

  it("falls back to auth for empty or unknown hashes", () => {
    expect(parseHash("")).toEqual({ name: "auth" });
    expect(parseHash("#/")).toEqual({ name: "auth" });
    expect(parseHash("#/does-not-exist")).toEqual({ name: "auth" });
  });

  it("round-trips every route through routeToHash", () => {
    const routes: Route[] = [
      ...SIMPLE.map((name) => ({ name })),
      { name: "engagement", params: { id: "e-42" } },
      { name: "agent", params: { name: "Priya Naidoo", team: "CCS02" } },
    ];
    for (const route of routes) expect(parseHash(routeToHash(route))).toEqual(route);
  });
});
