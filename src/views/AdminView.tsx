import { useMemo, useState } from "react";
import { useStore } from "../lib/store";
import { Avatar, Badge, Button, Card, CardHeader, Field, Input, Modal, Select, Tabs, useToast } from "../components/ui";
import { ROLE_LABEL, type Role } from "../lib/types";
import { Icon } from "../components/icons";
import { fmtDate } from "../lib/format";
import { logError } from "../lib/errors";
import type { AppState } from "../lib/types";

type Tab = "users" | "teams" | "data";

export function AdminView() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("users");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("CCS01");
  const [role, setRole] = useState<Role>("agent");
  const [resetOpen, setResetOpen] = useState(false);

  const users = useMemo(() => [...state.users].sort((a, b) => a.name.localeCompare(b.name)), [state.users]);
  const session = state.session!;

  const submitAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return toast.push("Enter a name", "error");
    if (state.users.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) return toast.push("That user already exists", "error");
    actions.addUser(trimmed, team, role, email.trim() || undefined);
    toast.push(`${trimmed} added as ${ROLE_LABEL[role]}`);
    setAddOpen(false);
    setName("");
    setEmail("");
  };

  const changeRole = (id: string, newRole: Role) => {
    actions.updateUser(id, { role: newRole });
    toast.push("Role updated (audited)");
  };

  const downloadBackup = () => {
    const backup: Partial<AppState> = {
      users: state.users,
      teams: state.teams,
      categories: state.categories,
      phrases: state.phrases,
      records: state.records,
      disputes: state.disputes,
      notes: state.notes,
      audit: state.audit,
      settings: { ...state.settings },
    };
    try {
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `engagement-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      toast.push("Backup downloaded");
    } catch (e) {
      toast.push(`Backup export failed: ${logError("admin.exportBackup", e)}`, "error");
    }
  };

  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onerror = () => {
      toast.push(`Could not read ${file.name}: ${logError("admin.importBackup", reader.error ?? new Error("file read failed"))}`, "error");
    };
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Partial<AppState>;
        if (!Array.isArray(data.users) || !Array.isArray(data.teams) || !Array.isArray(data.records)) {
          throw new Error("the file is missing the users, teams or records sections");
        }
        actions.restoreBackup({
          users: data.users,
          teams: data.teams,
          categories: data.categories,
          phrases: data.phrases,
          records: data.records,
          disputes: data.disputes ?? [],
          notes: data.notes ?? [],
          audit: data.audit ?? [],
          settings: data.settings,
        });
        toast.push("Backup restored");
      } catch (e) {
        toast.push(`Could not restore backup: ${logError("admin.importBackup", e, { file: file.name })}`, "error");
      }
    };
    try {
      reader.readAsText(file);
    } catch (e) {
      toast.push(`Could not open ${file.name}: ${logError("admin.importBackup", e)}`, "error");
    }
  };

  return (
    <div className="manager-page">
      <Tabs
        tabs={[
          { id: "users", label: "Users & roles", icon: "users" },
          { id: "teams", label: "Teams", icon: "grid" },
          { id: "data", label: "Data & backup", icon: "shield" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "users" ? (
        <Card>
          <CardHeader
            title="Users & roles"
            subtitle="Assign roles: agents see their own data, leaders see team dashboards, managers run the console"
            actions={<Button size="sm" icon="plus" onClick={() => setAddOpen(true)}>Add user</Button>}
          />
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th aria-label="Actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="cell-agent"><Avatar name={u.name} size={26} /><strong>{u.name}</strong>{u.id === session.name ? <Badge tone="info">you</Badge> : null}</span>
                    </td>
                    <td>
                      <Select value={u.team} onChange={(e) => actions.updateUser(u.id, { team: e.target.value })} aria-label={`Team for ${u.name}`} className="compact-select">
                        {state.teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </Select>
                    </td>
                    <td>
                      <Select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)} aria-label={`Role for ${u.name}`} className="compact-select">
                        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </Select>
                    </td>
                    <td>{fmtDate(u.createdAt)}</td>
                    <td>
                      {u.id !== session.name ? (
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete user"
                          onClick={() => {
                            if (window.confirm(`Delete ${u.name}? Their engagements remain in history.`)) {
                              actions.deleteUser(u.id);
                              toast.push("User deleted (audited)");
                            }
                          }}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === "teams" ? (
        <Card>
          <CardHeader title="Teams" subtitle="Teams group agents for leader dashboards and reports" />
          <div className="team-grid">
            {state.teams.map((t) => (
              <div key={t.id} className="team-tile">
                <strong>{t.name}</strong>
                <span>{state.users.filter((u) => u.team === t.name).length} member{(state.users.filter((u) => u.team === t.name).length) === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Delete team"
                  onClick={() => {
                    if (window.confirm(`Delete team ${t.name}? Existing records keep the name but it leaves the team list.`)) {
                      actions.deleteTeam(t.id);
                      toast.push("Team deleted");
                    }
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))}
          </div>
          <AddTeamForm />
        </Card>
      ) : null}

      {tab === "data" ? (
        <Card>
          <CardHeader title="Data & backup" subtitle="Export, import and maintenance for the platform data" />
          <div className="admin-actions">
            <div className="admin-action-row">
              <div>
                <strong>Export backup</strong>
                <p>Download all users, engagements, disputes, notes and the audit log as JSON.</p>
              </div>
              <Button variant="secondary" icon="download" onClick={downloadBackup}>Export JSON</Button>
            </div>
            <div className="admin-action-row">
              <div>
                <strong>Import backup</strong>
                <p>Restore from a previously exported file. Replaces the current dataset.</p>
              </div>
              <label className="btn btn-secondary btn-md file-btn">
                <Icon name="upload" size={16} /> Import JSON
                <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
              </label>
            </div>
            <div className="admin-action-row">
              <div>
                <strong>Load sample data</strong>
                <p>Populate the platform with a realistic demo team so dashboards are instantly explorable.</p>
              </div>
              <Button
                variant="secondary"
                icon="sparkles"
                disabled={state.settings.sampleDataLoaded}
                onClick={() => {
                  actions.loadSampleData();
                  toast.push("Sample data loaded — explore the dashboards");
                }}
              >
                {state.settings.sampleDataLoaded ? "Loaded" : "Load sample data"}
              </Button>
            </div>
            <div className="admin-action-row danger-row">
              <div>
                <strong>Reset platform</strong>
                <p>Permanently erase all users, engagements, disputes and audit history. Cannot be undone.</p>
              </div>
              <Button variant="danger" icon="trash" onClick={() => setResetOpen(true)}>Reset all data</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add user">
        <Field label="Full name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Thandi Nkosi" />
        </Field>
        <Field label="Work email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@capitecbank.co.za" />
        </Field>
        <div className="auth-grid-2">
          <Field label="Team">
            <Select value={team} onChange={(e) => setTeam(e.target.value)}>
              {state.teams.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button icon="plus" onClick={submitAdd}>Add user</Button>
        </div>
      </Modal>

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Reset all data?">
        <p className="modal-intro">
          This permanently deletes every user, engagement, dispute, note and audit entry on this device. Export a backup
          first if there is anything you need. Type <strong>RESET</strong> to confirm.
        </p>
        <ResetConfirm
          onConfirm={() => {
            actions.resetAll();
            toast.push("Platform reset");
            setResetOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}

function AddTeamForm() {
  const { actions } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const submit = () => {
    const trimmed = name.trim().toUpperCase();
    if (!trimmed) return toast.push("Enter a team name", "error");
    actions.addTeam(trimmed);
    toast.push(`Team ${trimmed} added`);
    setName("");
  };
  return (
    <div className="team-add">
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New team name, e.g. CCS13" onKeyDown={(e) => e.key === "Enter" && submit()} />
      <Button icon="plus" onClick={submit}>Add team</Button>
    </div>
  );
}

function ResetConfirm({ onConfirm }: { onConfirm: () => void }) {
  const [text, setText] = useState("");
  return (
    <div className="modal-actions">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type RESET" className="reset-input" />
      <Button variant="danger" icon="trash" disabled={text !== "RESET"} onClick={onConfirm}>Reset everything</Button>
    </div>
  );
}
