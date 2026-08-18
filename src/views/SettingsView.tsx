import { useState } from "react";
import { useStore } from "../lib/store";
import { Button, Card, CardHeader, Switch, Textarea, useToast } from "../components/ui";
import { Icon } from "../components/icons";
import { CloudPushError, connectCloud, disconnectCloud, pullCloudRecords, pushCloudRecords } from "../lib/cloud";
import { fmtDateTime } from "../lib/format";
import { logError } from "../lib/errors";

export function SettingsView() {
  const { state, actions } = useStore();
  const toast = useToast();
  const [configText, setConfigText] = useState(
    state.settings.cloud.firebaseConfig ? `const firebaseConfig = ${JSON.stringify(state.settings.cloud.firebaseConfig, null, 2)};` : "",
  );
  const [busy, setBusy] = useState(false);

  const cloud = state.settings.cloud;

  const connect = async () => {
    try {
      const start = configText.indexOf("{");
      const end = configText.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Paste the firebaseConfig object first");
      let cfg: unknown;
      try {
        cfg = new Function("return (" + configText.slice(start, end + 1) + ")")();
      } catch (e) {
        throw new Error(`That does not look like a valid firebaseConfig object: ${logError("settings.parseConfig", e)}`);
      }
      if (!cfg || typeof cfg !== "object") throw new Error("The pasted firebaseConfig is not an object");
      setBusy(true);
      const res = await connectCloud(cfg);
      if (!res.ok) throw new Error(res.error ?? "connection failed");
      actions.setCloud({ firebaseConfig: cfg, connected: true, lastSyncAt: Date.now() });
      const pulled = await pullCloudRecords();
      const known = new Set(state.records.map((r) => r.id));
      const fresh = pulled.filter((r) => !known.has(r.id));
      if (fresh.length) actions.importRecords(fresh);
      toast.push(`Connected — ${fresh.length} cloud engagement${fresh.length === 1 ? "" : "s"} imported`);
    } catch (e) {
      toast.push(logError("settings.connectCloud", e), "error");
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    try {
      setBusy(true);
      const pushed = await pushCloudRecords(state.records.filter((r) => r.status === "active"));
      actions.setCloud({ lastSyncAt: Date.now() });
      toast.push(`${pushed} engagement${pushed === 1 ? "" : "s"} pushed to the cloud`);
    } catch (e) {
      // A partial push still synced some engagements, so keep the sync stamp.
      if (e instanceof CloudPushError && e.pushed > 0) actions.setCloud({ lastSyncAt: Date.now() });
      toast.push(`Push failed: ${logError("settings.pushCloud", e)}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    disconnectCloud();
    actions.setCloud({ connected: false, firebaseConfig: null });
    toast.push("Cloud sync disabled — running local-only");
  };

  return (
    <div className="settings-page">
      <Card>
        <CardHeader title="Appearance" subtitle="Light and dark themes apply instantly across the platform" />
        <div className="setting-row">
          <div>
            <strong>Dark mode</strong>
            <p>Reduce glare during long QA sessions.</p>
          </div>
          <Switch checked={state.settings.theme === "dark"} onChange={(v) => actions.setTheme(v ? "dark" : "light")} label="Dark mode" />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Cloud sync (Firebase)"
          subtitle="Optional — restores the original app's shared cloud database. Without it the platform runs fully local on this device."
          actions={
            cloud.connected ? (
              <span className="badge badge-success"><Icon name="checkCircle" size={12} /> Connected</span>
            ) : (
              <span className="badge badge-neutral"><Icon name="x" size={12} /> Local only</span>
            )
          }
        />
        {cloud.connected ? (
          <>
            <p className="setting-copy">
              Syncing with <strong>{String((cloud.firebaseConfig as { projectId?: string } | null)?.projectId ?? "Firebase project")}</strong>.
              {cloud.lastSyncAt ? ` Last sync ${fmtDateTime(cloud.lastSyncAt)}.` : ""}
            </p>
            <div className="setting-actions">
              <Button variant="secondary" icon="download" onClick={push} disabled={busy}>Push local records</Button>
              <Button variant="ghost" icon="x" onClick={disconnect}>Disconnect</Button>
            </div>
          </>
        ) : (
          <>
            <p className="setting-copy">
              Paste the <code>firebaseConfig</code> object from your Firebase console (Project settings → Your apps → Web)
              to enable the shared database. The collection <code>engagements</code> is used, matching the original app.
            </p>
            <Textarea rows={6} value={configText} onChange={(e) => setConfigText(e.target.value)} placeholder='const firebaseConfig = { apiKey: "...", authDomain: "...", projectId: "..." };' />
            <div className="setting-actions">
              <Button icon="refresh" onClick={connect} disabled={busy || !configText.trim()}>
                {busy ? "Connecting…" : "Connect & sync"}
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardHeader title="Data" subtitle="Sample data, backups and reset live under Administration → Data & backup" />
        <div className="setting-row">
          <div>
            <strong>Sample data</strong>
            <p>{state.settings.sampleDataLoaded ? "Sample dataset loaded — dashboards are populated." : "Load a realistic demo team to explore every dashboard instantly."}</p>
          </div>
          <Button
            variant="secondary"
            icon="sparkles"
            disabled={state.settings.sampleDataLoaded}
            onClick={() => {
              actions.loadSampleData();
              toast.push("Sample data loaded");
            }}
          >
            {state.settings.sampleDataLoaded ? "Loaded" : "Load sample data"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
