import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Avatar, Badge, Button, Field, Input, Select, useToast } from "../components/ui";
import { ROLE_LABEL, type Role } from "../lib/types";
import { Icon } from "../components/icons";
import type { Route } from "../lib/router";

export function AuthView({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { state, actions } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("CCS01");
  const [role, setRole] = useState<Role>("agent");
  const [error, setError] = useState<string | null>(null);

  const firstIsAdmin = !state.users.some((u) => u.role === "admin");
  const demoUsers = useMemo(() => state.users.filter((u) => u.name !== "Platform Admin").slice(0, 6), [state.users]);

  const go = (r: Route) => {
    onNavigate(r);
  };

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter your name to continue.");
    const existing = state.users.find((u) => u.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      actions.login(existing.name, existing.team, existing.role, existing.email);
      toast.push(`Welcome back, ${existing.name}`);
      go({ name: existing.role === "agent" ? "tracker" : "dashboard" });
    } else {
      // Local mode: any name can enter with the chosen role (agent by default).
      actions.login(trimmed, team, role, email || undefined);
      toast.push(`Signed in as ${trimmed} (local mode)`);
      go({ name: role === "agent" ? "tracker" : "dashboard" });
    }
  };

  const doSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Enter your full name.");
    const existing = state.users.find((u) => u.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return setError("That name already exists. Sign in instead.");
    const effectiveRole: Role = firstIsAdmin ? "admin" : role;
    actions.addUser(trimmed, team, effectiveRole, email || undefined);
    actions.login(trimmed, team, effectiveRole, email || undefined);
    toast.push(firstIsAdmin ? "First account created — you are the Administrator." : `Account created for ${trimmed}.`);
    go({ name: effectiveRole === "agent" ? "tracker" : "dashboard" });
  };

  const demoLogin = (demoName: string) => {
    const u = state.users.find((x) => x.name === demoName);
    if (!u) return toast.push(`${demoName} is no longer in this workspace`, "error");
    actions.login(u.name, u.team, u.role, u.email);
    toast.push(`Browsing as ${u.name} (${ROLE_LABEL[u.role]})`);
    go({ name: u.role === "agent" ? "tracker" : "dashboard" });
  };

  return (
    <div className="auth-screen">
      <div className="auth-brand-panel">
        <div className="auth-brand-inner">
          <div className="auth-brand-logo">
            <img src="/CPI.JO-7f69f481.png" alt="Capitec Bank" />
          </div>
          <h1>Client Engagement Tracker</h1>
          <p className="auth-tagline">
            QA scoring, coaching intelligence and team analytics for world-class client engagements.
          </p>
          <ul className="auth-features">
            <li><Icon name="checkCircle" size={16} /> Checklist-driven engagement scoring</li>
            <li><Icon name="mic" size={16} /> Live speech assistant auto-captures quality markers</li>
            <li><Icon name="chart" size={16} /> Team dashboards, trends and leaderboards</li>
            <li><Icon name="scale" size={16} /> Disputes, corrections and full audit trail</li>
          </ul>
        </div>
      </div>

      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === "signin"} className={tab === "signin" ? "active" : ""} onClick={() => { setTab("signin"); setError(null); }}>
              Sign in
            </button>
            <button type="button" role="tab" aria-selected={tab === "signup"} className={tab === "signup" ? "active" : ""} onClick={() => { setTab("signup"); setError(null); }}>
              Create account
            </button>
          </div>

          {tab === "signin" ? (
            <form className="auth-form" onSubmit={doLogin}>
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thandi Nkosi" autoFocus />
              </Field>
              <div className="auth-grid-2">
                <Field label="Team">
                  <Select value={team} onChange={(e) => setTeam(e.target.value)}>
                    {state.teams.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Role">
                  <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {error ? <p className="auth-error">{error}</p> : null}
              <Button type="submit" className="auth-submit" size="lg">Enter tracker <Icon name="chevronRight" size={16} /></Button>
              <p className="auth-note">Existing users are recognised by name and take on their assigned role automatically.</p>
            </form>
          ) : (
            <form className="auth-form" onSubmit={doSignup}>
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thandi Nkosi" autoFocus />
              </Field>
              <Field label="Work email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@capitecbank.co.za" />
              </Field>
              <div className="auth-grid-2">
                <Field label="Team">
                  <Select value={team} onChange={(e) => setTeam(e.target.value)}>
                    {state.teams.map((t) => (
                      <option key={t.id} value={t.name}>{t.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Role">
                  <Select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={firstIsAdmin}>
                    {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              {firstIsAdmin ? <div className="auth-hint"><Icon name="shield" size={14} /> The first account becomes the Administrator.</div> : null}
              {error ? <p className="auth-error">{error}</p> : null}
              <Button type="submit" className="auth-submit" size="lg">Create account</Button>
              <p className="auth-note">Accounts are managed by your administrator. Roles can be changed anytime in Administration.</p>
            </form>
          )}

          {demoUsers.length > 0 ? (
            <div className="demo-panel">
              <span className="demo-label">Quick demo access</span>
              <div className="demo-users">
                {demoUsers.map((u) => (
                  <button key={u.id} type="button" className="demo-user" onClick={() => demoLogin(u.name)}>
                    <Avatar name={u.name} size={30} />
                    <span className="demo-user-name">{u.name}</span>
                    <Badge tone={u.role === "admin" ? "danger" : u.role === "manager" ? "warning" : u.role === "leader" ? "info" : "neutral"}>{ROLE_LABEL[u.role]}</Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="demo-panel">
              <span className="demo-label">No team yet</span>
              <p className="demo-empty">Create the first account above to become the Administrator, then add your team. You can also load sample data later from Settings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
