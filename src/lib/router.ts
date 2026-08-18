import { logError } from "./errors";

export type RouteName =
  | "auth"
  | "tracker"
  | "dashboard"
  | "engagements"
  | "engagement"
  | "agent"
  | "manager"
  | "admin"
  | "reports"
  | "settings";

export interface Route {
  name: RouteName;
  params?: Record<string, string>;
}

export function routeToHash(r: Route): string {
  switch (r.name) {
    case "auth":
      return "#/auth";
    case "tracker":
      return "#/tracker";
    case "dashboard":
      return "#/dashboard";
    case "engagements":
      return "#/engagements";
    case "manager":
      return "#/manager";
    case "admin":
      return "#/admin";
    case "reports":
      return "#/reports";
    case "settings":
      return "#/settings";
    case "engagement":
      return `#/engagement/${encodeURIComponent(r.params?.id ?? "")}`;
    case "agent":
      return `#/agent/${encodeURIComponent(r.params?.name ?? "")}/${encodeURIComponent(r.params?.team ?? "")}`;
    default:
      return "#/";
  }
}

/** Malformed percent-escapes (hand-edited URLs) must not crash the router. */
function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch (e) {
    logError("router.parseHash", e, { part });
    return part;
  }
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(safeDecode);
  const [name, a, b] = parts;
  switch (name) {
    case "tracker":
      return { name: "tracker" };
    case "dashboard":
      return { name: "dashboard" };
    case "engagements":
      return { name: "engagements" };
    case "manager":
      return { name: "manager" };
    case "admin":
      return { name: "admin" };
    case "reports":
      return { name: "reports" };
    case "settings":
      return { name: "settings" };
    case "engagement":
      return { name: "engagement", params: { id: a ?? "" } };
    case "agent":
      return { name: "agent", params: { name: a ?? "", team: b ?? "" } };
    case "auth":
    default:
      return { name: "auth" };
  }
}
