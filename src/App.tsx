import { useEffect, useState } from "react";
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

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <ThemeSync />
        <Router />
      </ToastProvider>
    </StoreProvider>
  );
}
