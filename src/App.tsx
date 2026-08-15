import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { ToastProvider, useToast } from "./components/ui";
import { AppShell, canAccess, defaultRoute } from "./components/layout";
import { parseHash, routeToHash, type Route } from "./lib/router";
import { AuthView } from "./views/AuthView";
import { TrackerView } from "./views/TrackerView";
import { LeaderView } from "./views/LeaderView";
import { ManagerView } from "./views/ManagerView";
import { AdminView } from "./views/AdminView";
import { ReportsView } from "./views/ReportsView";
import { SettingsView } from "./views/SettingsView";
import { EngagementView } from "./views/EngagementView";
import { AgentProfileView } from "./views/AgentProfileView";
import { EngagementsView } from "./views/EngagementsView";

function ThemeSync() {
  const { state } = useStore();
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.settings.theme);
  }, [state.settings.theme]);
  return null;
}

function Router() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (r: Route) => {
    window.location.hash = routeToHash(r);
    setRoute(r);
    window.scrollTo({ top: 0 });
  };

  const session = state.session;

  if (!session) {
    return <AuthView onNavigate={navigate} />;
  }

  // Route guard: send the user to a route their role can access
  const allowed = canAccess(route.name, session.role);
  const effectiveRoute: Route = allowed ? route : defaultRoute(session.role);

  const logout = () => {
    actions.logout();
    toast.push("Signed out");
    navigate({ name: "auth" });
  };

  const view = (() => {
    switch (effectiveRoute.name) {
      case "tracker":
        return <TrackerView onNavigate={navigate} />;
      case "dashboard":
        return <LeaderView onNavigate={navigate} />;
      case "engagements":
        return <EngagementsView onNavigate={navigate} />;
      case "engagement":
        return <EngagementView id={effectiveRoute.params?.id ?? ""} onNavigate={navigate} />;
      case "agent":
        return <AgentProfileView name={effectiveRoute.params?.name ?? ""} team={effectiveRoute.params?.team ?? ""} onNavigate={navigate} />;
      case "manager":
        return <ManagerView onNavigate={navigate} />;
      case "admin":
        return <AdminView />;
      case "reports":
        return <ReportsView />;
      case "settings":
        return <SettingsView />;
      default:
        return <TrackerView onNavigate={navigate} />;
    }
  })();

  return (
    <AppShell route={effectiveRoute} onNavigate={navigate} onLogout={logout}>
      {view}
    </AppShell>
  );
}

/** Visible crash screen instead of a silent blank page — surfaces any runtime error. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[app] crashed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f2f6fa",
            color: "#16283c",
            fontFamily: "Segoe UI, Arial, sans-serif",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 520, textAlign: "center" }}>
            <h1 style={{ fontSize: 22, marginBottom: 10 }}>Something went wrong</h1>
            <p style={{ fontSize: 14, marginBottom: 18, wordBreak: "break-word" }}>{String(this.state.error.message || this.state.error)}</p>
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                } catch {
                  /* storage unavailable */
                }
                window.location.reload();
              }}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: "#003865",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset app data &amp; reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <ToastProvider>
          <ThemeSync />
          <Router />
        </ToastProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
}
