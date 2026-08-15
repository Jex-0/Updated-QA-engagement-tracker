import { useState } from "react";
import { useStore } from "../lib/store";
import { Badge, Button, Card, CardHeader, Field, Input, Modal, Switch, Textarea, useToast } from "../components/ui";
import { Icon } from "../components/icons";

function parseList(raw: string): string[] {
  return raw
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ManagerChecklist() {
  const { state, actions } = useStore();
  const toast = useToast();

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const [phraseModal, setPhraseModal] = useState<null | { phraseId?: string; categoryId: string }>(null);
  const [phraseText, setPhraseText] = useState("");
  const [phraseKeywords, setPhraseKeywords] = useState("");
  const [phraseAlts, setPhraseAlts] = useState("");

  const manualEnabled = state.settings.manualTickEnabled;

  const addCategory = () => {
    const name = newCat.trim();
    if (!name) return toast.push("Enter a category name", "error");
    if (state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      return toast.push("A category with that name already exists", "error");
    }
    actions.addCategory(name);
    toast.push(`Category “${name}” created — add phrases to it`);
    setNewCat("");
    setAddCatOpen(false);
  };

  const saveRename = () => {
    if (!renameId) return;
    const name = renameVal.trim();
    if (!name) return toast.push("Category name cannot be empty", "error");
    actions.updateCategory(renameId, name);
    toast.push("Category renamed (audited)");
    setRenameId(null);
  };

  const deleteCategory = (id: string, name: string, count: number) => {
    if (window.confirm(`Delete category “${name}” and its ${count} phrase(s)? Existing engagement history is preserved, but the phrases will no longer be assessed.`)) {
      actions.deleteCategory(id);
      toast.push("Category deleted (audited)");
    }
  };

  const openAddPhrase = (categoryId: string) => {
    setPhraseText("");
    setPhraseKeywords("");
    setPhraseAlts("");
    setPhraseModal({ categoryId });
  };

  const openEditPhrase = (phraseId: string, categoryId: string) => {
    const p = state.phrases.find((x) => x.id === phraseId);
    if (!p) return;
    setPhraseText(p.text);
    setPhraseKeywords(p.keywords.join(", "));
    setPhraseAlts(p.alternatives.join(", "));
    setPhraseModal({ phraseId, categoryId });
  };

  const savePhrase = () => {
    if (!phraseModal) return;
    const text = phraseText.trim();
    if (!text) return toast.push("Phrase text is required", "error");
    const keywords = parseList(phraseKeywords);
    const alternatives = parseList(phraseAlts);
    if (phraseModal.phraseId) {
      actions.updatePhrase(phraseModal.phraseId, { text, keywords, alternatives });
      toast.push("Phrase updated (audited)");
    } else {
      actions.addPhrase(phraseModal.categoryId, text, keywords, alternatives);
      toast.push("Phrase added (audited)");
    }
    setPhraseModal(null);
  };

  const deletePhrase = (id: string, text: string) => {
    if (window.confirm(`Delete phrase “${text.slice(0, 60)}…”? Historical engagements keep their records, but this phrase stops being assessed from now on.`)) {
      actions.deletePhrase(id);
      toast.push("Phrase deleted (audited)");
    }
  };

  const editing = phraseModal?.phraseId ? state.phrases.find((p) => p.id === phraseModal.phraseId) : null;

  return (
    <div className="checklist-editor">
      <Card className="toggle-card">
        <div className="toggle-icon"><Icon name="checklist" size={18} /></div>
        <div className="toggle-body">
          <strong>Manual ticking</strong>
          <p>
            {manualEnabled
              ? "Agents can tap phrases and pick the variation that was said. Turn it off to force speech-only capture."
              : "Agents cannot tick phrases by hand — the speech assistant captures everything. Turn it on to let agents mark phrases (with an alternative-phrase picker)."}
          </p>
        </div>
        <Switch
          checked={manualEnabled}
          onChange={(v) => {
            actions.setManualTick(v);
            toast.push(v ? "Manual ticking enabled for everyone (audited)" : "Manual ticking disabled for everyone (audited)");
          }}
          label={manualEnabled ? "On — applies to all agents" : "Off — speech capture only"}
        />
      </Card>

      <Card>
        <CardHeader
          title="Phrases & categories"
          subtitle="Build the engagement rubric — speech keywords auto-tick phrases, alternatives appear in the agent picker"
          actions={<Button size="sm" icon="plus" onClick={() => setAddCatOpen(true)}>Add category</Button>}
        />
        <div className="category-list">
          {state.categories.map((cat) => {
            const catPhrases = state.phrases.filter((p) => p.categoryId === cat.id);
            return (
              <div key={cat.id} className="category-card">
                <div className="category-head">
                  <span className="category-name"><Icon name="grid" size={15} /> {cat.name}</span>
                  <Badge tone="neutral">{catPhrases.length} phrase{catPhrases.length === 1 ? "" : "s"}</Badge>
                  <div className="row-actions">
                    <button type="button" className="icon-btn" title="Rename category" onClick={() => { setRenameId(cat.id); setRenameVal(cat.name); }}>
                      <Icon name="edit" size={15} />
                    </button>
                    <button type="button" className="icon-btn danger" title="Delete category" onClick={() => deleteCategory(cat.id, cat.name, catPhrases.length)}>
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
                {catPhrases.length === 0 ? (
                  <p className="category-empty">No phrases yet — add the first one.</p>
                ) : (
                  <div className="phrase-list">
                    {catPhrases.map((p) => (
                      <div key={p.id} className="phrase-row">
                        <div className="phrase-main">
                          <strong>{p.text}</strong>
                          <div className="phrase-meta">
                            <span><Icon name="mic" size={12} /> {p.keywords.length ? p.keywords.join(", ") : "no speech keywords"}</span>
                            {p.alternatives.length ? (
                              <span><Icon name="check" size={12} /> {p.alternatives.length} alternative{p.alternatives.length === 1 ? "" : "s"}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="Edit phrase" onClick={() => openEditPhrase(p.id, cat.id)}>
                            <Icon name="edit" size={15} />
                          </button>
                          <button type="button" className="icon-btn danger" title="Delete phrase" onClick={() => deletePhrase(p.id, p.text)}>
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button variant="ghost" size="sm" icon="plus" onClick={() => openAddPhrase(cat.id)}>Add phrase</Button>
              </div>
            );
          })}
        </div>
        <p className="table-hint"><Icon name="info" size={13} /> Every category and phrase change is written to the audit log with your name and timestamp.</p>
      </Card>

      {/* Add category modal */}
      <Modal open={addCatOpen} onClose={() => setAddCatOpen(false)} title="Add category">
        <Field label="Category name" hint="e.g. Objection Handling, Call Wrap-up">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Category name" autoFocus />
        </Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setAddCatOpen(false)}>Cancel</Button>
          <Button icon="plus" onClick={addCategory}>Create category</Button>
        </div>
      </Modal>

      {/* Rename category modal */}
      <Modal open={renameId != null} onClose={() => setRenameId(null)} title="Rename category">
        <Field label="Category name">
          <Input value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
        </Field>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setRenameId(null)}>Cancel</Button>
          <Button icon="check" onClick={saveRename}>Save</Button>
        </div>
      </Modal>

      {/* Add / edit phrase modal */}
      <Modal open={phraseModal != null} onClose={() => setPhraseModal(null)} title={editing ? "Edit phrase" : "Add phrase"} wide>
        {phraseModal ? (
          <>
            <Field label="Phrase text" hint="The exact wording agents should use. Shown in the checklist and timeline.">
              <Textarea rows={2} value={phraseText} onChange={(e) => setPhraseText(e.target.value)} placeholder="e.g. Thank you for calling Capitec Bank, how may I assist?" />
            </Field>
            <Field label="Speech keywords" hint="Comma-separated phrases the speech assistant listens for (auto-tick). Leave empty to disable auto-detection.">
              <Textarea rows={2} value={phraseKeywords} onChange={(e) => setPhraseKeywords(e.target.value)} placeholder="e.g. thank you for calling, how may i assist" />
            </Field>
            <Field label="Alternative phrasings" hint="Acceptable variations shown in the agent picker. Choosing one still ticks the box.">
              <Textarea rows={3} value={phraseAlts} onChange={(e) => setPhraseAlts(e.target.value)} placeholder="One alternative per line, e.g.&#10;Good morning, welcome to Capitec Bank.&#10;Thanks for holding." />
            </Field>
            <div className="modal-actions">
              <Button variant="ghost" onClick={() => setPhraseModal(null)}>Cancel</Button>
              {editing ? <Button variant="danger" icon="trash" onClick={() => { if (editing) deletePhrase(editing.id, editing.text); setPhraseModal(null); }}>Delete</Button> : null}
              <Button icon="check" onClick={savePhrase}>{editing ? "Save changes" : "Add phrase"}</Button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
