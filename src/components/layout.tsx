import { useState, type ReactNode } from "react";
import { Avatar, cn } from "./ui";
import { Icon, type IconName } from "./icons";
import { useStore } from "../lib/store";
import { ROLE_LABEL, type Role } from "../lib/types";
import type { Route, RouteName } from "../lib/router";

export interface NavItem {
  id: RouteName;
  label: string;
  icon: IconName;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: "tracker", label: "My Tracker", icon: "checklist", roles: ["agent", "leader", "manager", "admin"] },
  { id: "dashboard", label: "Team Dashboard", icon: "dashboard", roles: ["leader", "manager", "admin"] },
  { id: "engagements", label: "Engagements", icon: "fileText", roles: ["leader", "manager", "admin"] },
  { id: "manager", label: "Manager Console", icon: "scale", roles: ["manager", "admin"] },
  { id: "admin", label: "Administration", icon: "shield", roles: ["admin"] },
  { id: "reports", label: "Reports", icon: "chart", roles: ["leader", "manager", "admin"] },
  { id: "settings", label: "Settings", icon: "sliders", roles: ["agent", "leader", "manager", "admin"] },
];

function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => n.roles.includes(role));
}

export function canAccess(route: RouteName, role: Role): boolean {
  if (route === "auth" || route === "settings" || route === "tracker") return true;
  const item = NAV_ITEMS.find((n) => n.id === route);
  return item ? item.roles.includes(role) : false;
}

export function defaultRoute(role: Role): Route {
  if (role === "agent") return { name: "tracker" };
  return { name: "dashboard" };
}

export function AppShell({
  route,
  onNavigate,
  onLogout,
  children,
}: {
  route: Route;
  onNavigate: (r: Route) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const { state, actions } = useStore();
  const session = state.session;
  const [mobileOpen, setMobileOpen] = useState(false);
  const dark = state.settings.theme === "dark";

  const toggleTheme = () => {
    actions.setTheme(dark ? "light" : "dark");
  };

  if (!session) return <>{children}</>;

  const items = navForRole(session.role);
  const title = items.find((i) => i.id === route.name)?.label ?? "Client Engagement Tracker";

  const nav = (
    <nav className="sidebar-nav" aria-label="Primary">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={cn("nav-item", route.name === item.id && "active")}
          onClick={() => {
            onNavigate({ name: item.id });
            setMobileOpen(false);
          }}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );

  const userChip = (
    <div className="user-chip">
      <Avatar name={session.name} size={34} />
      <div className="user-chip-text">
        <strong>{session.name}</strong>
        <span>
          {ROLE_LABEL[session.role]} · {session.team}
        </span>
      </div>
    </div>
  );

  return (
    <div className="shell">
      <aside className={cn("sidebar", mobileOpen && "open")}>
        <div className="brand">
          <img src="/CPI.JO-7f69f481.png" alt="" className="brand-logo" />
          <div className="brand-text">
            <strong>Engagement</strong>
            <span>Quality Tracker</span>
          </div>
        </div>
        {nav}
        <div className="sidebar-foot">{userChip}</div>
      </aside>

      {mobileOpen ? <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" /> : null}

      <div className="shell-main">
        <header className="topbar">
          <button type="button" className="icon-btn mobile-menu" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Icon name="menu" size={20} />
          </button>
          <h1 className="page-title">{title}</h1>
          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
            >
              <Icon name={dark ? "sun" : "moon"} size={18} />
            </button>
            <button type="button" className="icon-btn" aria-label="Sign out" onClick={onLogout} title="Sign out">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
