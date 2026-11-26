import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Save,
  Eye,
  Send,
  Plus,
  Trash2,
  Check,
  Loader2,
  BookOpen,
  Megaphone,
  CalendarDays,
  Link2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Bulletin,
  type ChurchInfo,
  bulletinSchema,
} from "@shared/bulletin";
import { trpc } from "@/lib/trpc";
import { Modal, copyText } from "@/components/Actions";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

export type WorkspaceData = {
  church: ChurchInfo;
  draft: Bulletin;
  published: Bulletin | null;
  revision: number;
  savedAt: Date;
  publishedAt: Date | null;
};
export default function Editor({ data }: { data: WorkspaceData }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<Bulletin>(data.draft);
  const [baseline, setBaseline] = useState<Bulletin>(data.draft);
  const [conflicted, setConflicted] = useState(false);
  const [backup, setBackup] = useState(false);
  const [revision, setRevision] = useState(data.revision);
  const [publishing, setPublishing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty);
  const update = <K extends keyof Bulletin>(key: K, value: Bulletin[K]) =>
    setDraft(d => ({ ...d, [key]: value }));
  useEffect(() => {
    if (!dirty) {
      setDraft(data.draft);
      setBaseline(data.draft);
      setRevision(data.revision);
    }
  }, [data.revision, dirty]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const save = trpc.bulletin.save.useMutation({
    onSuccess: async d => {
      setRevision(d.revision);
      setDraft(d.draft);
      setBaseline(d.draft);
      setConflicted(false);
      utils.bulletin.workspace.setData(undefined, d);
      toast.success("Draft saved. The member bulletin is unchanged.");
    },
    onError: e => {
      if (e.data?.code === "CONFLICT") setConflicted(true);
      toast.error(e.message);
    },
  });
  const publish = trpc.bulletin.publish.useMutation({
    onSuccess: async d => {
      utils.bulletin.workspace.setData(undefined, d);
      await utils.bulletin.member.invalidate();
      setPublishing(false);
      toast.success("Published to the restricted pilot member view.");
    },
    onError: e => toast.error(e.message),
  });
  async function saveDraft(preview = false) {
    const result = bulletinSchema.safeParse(draft);
    if (!result.success) {
      setErrors(
        result.error.issues.map(e => `${e.path.join(" → ")}: ${e.message}`)
      );
      toast.error("Please review the highlighted bulletin details.");
      return;
    }
    setErrors([]);
    try {
      await save.mutateAsync({ bulletin: result.data, revision });
      if (preview) navigate("/admin/preview");
    } catch {
      /* Mutation displays the error; preserve unsaved text. */
    }
  }
  const busy = save.isPending || publish.isPending;
  async function loadLatest() {
    if (
      dirty &&
      !window.confirm(
        "Load the latest saved draft? Your current unsaved text will be replaced. Copy it first if you need it."
      )
    )
      return;
    try {
      const latest = await utils.bulletin.workspace.fetch();
      setDraft(latest.draft);
      setBaseline(latest.draft);
      setRevision(latest.revision);
      setConflicted(false);
      utils.bulletin.workspace.setData(undefined, latest);
    } catch (e) {
      toast.error("Could not load the latest draft. Your text has been kept.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR SUNDAY</span>
          <h1>Weekly bulletin</h1>
          <p>Shape the details. Save a draft. Share when you’re ready.</p>
        </div>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => saveDraft(true)}
            disabled={busy}
          >
            <Eye size={16} /> Preview
          </button>
          <button
            className="button primary"
            onClick={() => saveDraft()}
            disabled={busy}
          >
            {save.isPending ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Save size={16} />
            )}{" "}
            Save draft
          </button>
        </div>
      </div>
      <div className="editor-status">
        <span>
          {dirty ? (
            <>
              <span className="status-dot amber" /> Unsaved changes
            </>
          ) : (
            <>
              <Check size={15} /> Draft saved
            </>
          )}
        </span>
        <span>
          Revision {revision} <span className="small-divider" /> Sample data
          only
        </span>
        <button
          className="text-button"
          onClick={() => setPublishing(true)}
          disabled={busy || dirty}
        >
          <Send size={14} /> Publish saved draft
        </button>
      </div>
      {errors.length > 0 && (
        <div className="validation-errors" role="alert">
          <AlertCircle size={20} />
          <div>
            <strong>Check these details before saving</strong>
            {errors.map((e, i) => (
              <p key={i}>{e}</p>
            ))}
          </div>
        </div>
      )}
      {(conflicted || (dirty && data.revision !== revision)) && (
        <div className="conflict-banner" role="alert">
          <p>
            Another session saved a newer version. Your unsaved work is still
            here. Copy it before loading the latest draft.
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() => setBackup(true)}
            >
              Copy my unsaved draft
            </button>
            <button className="button secondary" onClick={loadLatest}>
              Load latest saved version
            </button>
          </div>
        </div>
      )}
      <div className="editor-columns">
        <fieldset className="editor-forms" disabled={busy}>
          <section className="form-card">
            <div className="form-card-heading">
              <BookOpen size={19} />
              <h2>Service & message</h2>
              <span>01</span>
            </div>
            <div className="form-grid">
              <label>
                Service date
                <input
                  type="date"
                  value={draft.serviceDate}
                  onChange={e => update("serviceDate", e.target.value)}
                />
              </label>
              <label>
                Service time
                <input
                  value={draft.serviceTime}
                  onChange={e => update("serviceTime", e.target.value)}
                  maxLength={40}
                />
              </label>
            </div>
            <label>
              Sermon title <span className="required">*</span>
              <input
                value={draft.sermonTitle}
                onChange={e => update("sermonTitle", e.target.value)}
                maxLength={180}
                placeholder="The heart of this week's message"
              />
            </label>
            <div className="form-grid">
              <label>
                Scripture reference <span className="required">*</span>
                <input
                  value={draft.scripture}
                  onChange={e => update("scripture", e.target.value)}
                  maxLength={180}
                  placeholder="e.g. Colossians 2:6–7"
                />
              </label>
              <label>
                Speaker <span className="optional">Optional</span>
                <input
                  value={draft.speaker}
                  onChange={e => update("speaker", e.target.value)}
                  maxLength={120}
                />
              </label>
            </div>
            <label>
              Message introduction <span className="optional">Optional</span>
              <textarea
                value={draft.sermonSummary}
                onChange={e => update("sermonSummary", e.target.value)}
                maxLength={2000}
                rows={4}
              />
            </label>
          </section>
          <section className="form-card">
            <div className="form-card-heading">
              <Megaphone size={19} />
              <h2>Announcements</h2>
              <span>02</span>
            </div>
            {draft.announcements.map((a, i) => (
              <div className="editable-item" key={a.id}>
                <div className="item-label">
                  <span>ANNOUNCEMENT {String(i + 1).padStart(2, "0")}</span>
                  <button
                    className="icon-button"
                    onClick={() =>
                      update(
                        "announcements",
                        draft.announcements.filter((_, n) => n !== i)
                      )
                    }
                    aria-label={`Remove announcement ${i + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <label>
                  Title
                  <input
                    value={a.title}
                    onChange={e =>
                      update(
                        "announcements",
                        draft.announcements.map((x, n) =>
                          n === i ? { ...x, title: e.target.value } : x
                        )
                      )
                    }
                    maxLength={160}
                  />
                </label>
                <label>
                  Details
                  <textarea
                    value={a.body}
                    onChange={e =>
                      update(
                        "announcements",
                        draft.announcements.map((x, n) =>
                          n === i ? { ...x, body: e.target.value } : x
                        )
                      )
                    }
                    rows={3}
                    maxLength={2000}
                  />
                </label>
              </div>
            ))}
            <button
              className="button add-button"
              disabled={draft.announcements.length >= 30}
              onClick={() =>
                update("announcements", [
                  ...draft.announcements,
                  { id: crypto.randomUUID(), title: "", body: "" },
                ])
              }
            >
              <Plus size={16} /> Add announcement
            </button>
          </section>
          <section className="form-card">
            <div className="form-card-heading">
              <CalendarDays size={19} />
              <h2>Upcoming events</h2>
              <span>03</span>
            </div>
            {draft.events.map((e, i) => (
              <div className="editable-item" key={e.id}>
                <div className="item-label">
                  <span>EVENT {String(i + 1).padStart(2, "0")}</span>
                  <button
                    className="icon-button"
                    onClick={() =>
                      update(
                        "events",
                        draft.events.filter((_, n) => n !== i)
                      )
                    }
                    aria-label={`Remove event ${i + 1}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <label>
                  Event name
                  <input
                    value={e.title}
                    onChange={ev =>
                      update(
                        "events",
                        draft.events.map((x, n) =>
                          n === i ? { ...x, title: ev.target.value } : x
                        )
                      )
                    }
                    maxLength={160}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Date
                    <input
                      type="date"
                      value={e.date}
                      onChange={ev =>
                        update(
                          "events",
                          draft.events.map((x, n) =>
                            n === i ? { ...x, date: ev.target.value } : x
                          )
                        )
                      }
                    />
                  </label>
                  <label>
                    Time
                    <input
                      value={e.time}
                      onChange={ev =>
                        update(
                          "events",
                          draft.events.map((x, n) =>
                            n === i ? { ...x, time: ev.target.value } : x
                          )
                        )
                      }
                      maxLength={80}
                    />
                  </label>
                </div>
                <label>
                  Location
                  <input
                    value={e.location}
                    onChange={ev =>
                      update(
                        "events",
                        draft.events.map((x, n) =>
                          n === i ? { ...x, location: ev.target.value } : x
                        )
                      )
                    }
                    maxLength={180}
                  />
                </label>
                <label>
                  Details
                  <textarea
                    value={e.description}
                    onChange={ev =>
                      update(
                        "events",
                        draft.events.map((x, n) =>
                          n === i ? { ...x, description: ev.target.value } : x
                        )
                      )
                    }
                    rows={3}
                    maxLength={2000}
                  />
                </label>
              </div>
            ))}
            <button
              className="button add-button"
              disabled={draft.events.length >= 30}
              onClick={() =>
                update("events", [
                  ...draft.events,
                  {
                    id: crypto.randomUUID(),
                    title: "",
                    date: draft.serviceDate,
                    time: "",
                    location: "",
                    description: "",
                  },
                ])
              }
            >
              <Plus size={16} /> Add event
            </button>
          </section>
          <section className="form-card">
            <div className="form-card-heading">
              <Link2 size={19} />
              <h2>Church links</h2>
              <span>04</span>
            </div>
            <p className="muted">
              Use only verified, owner-supplied HTTPS links. Leave blank until
              the church provides them.
            </p>
            <label>
              Giving URL <span className="optional">Optional</span>
              <input
                type="url"
                value={draft.givingUrl}
                onChange={e => update("givingUrl", e.target.value)}
                placeholder="Not provided — leave blank"
              />
            </label>
            <label>
              Livestream URL <span className="optional">Optional</span>
              <input
                type="url"
                value={draft.livestreamUrl}
                onChange={e => update("livestreamUrl", e.target.value)}
                placeholder="Not provided — leave blank"
              />
            </label>
          </section>
        </fieldset>
        <aside className="editor-aside">
          <div className="aside-note">
            <span className="eyebrow">A SIMPLE SUNDAY RHYTHM</span>
            <h2>
              Make it yours.
              <br />
              Then make it known.
            </h2>
            <ol>
              <li>
                <strong>Edit the details</strong>
                <span>All pilot content is labeled sample data.</span>
              </li>
              <li>
                <strong>Save your draft</strong>
                <span>
                  Your changes persist without changing the member view.
                </span>
              </li>
              <li>
                <strong>Take a look</strong>
                <span>
                  Preview the saved bulletin as a member would read it.
                </span>
              </li>
              <li>
                <strong>Publish with care</strong>
                <span>
                  Only invited testers can see the published pilot bulletin.
                </span>
              </li>
            </ol>
          </div>
          <div className="quiet-card">
            <AlertCircle size={18} />
            <p>
              <strong>Preview is not a public launch.</strong> Publishing a
              bulletin updates this restricted pilot only. Public access still
              requires approval.
            </p>
          </div>
          <button
            className="button primary wide"
            onClick={() => setPublishing(true)}
            disabled={busy || dirty}
          >
            <Send size={16} /> Publish saved draft
          </button>
          {dirty && (
            <p className="fine-print center">
              Save your changes before publishing.
            </p>
          )}
        </aside>
      </div>
      <Modal
        open={backup}
        onClose={() => setBackup(false)}
        title="Keep a copy of your changes"
        description="Copy this JSON before loading the latest saved version. This is a local backup, not a saved bulletin."
      >
        <textarea
          className="newsletter-text"
          readOnly
          value={JSON.stringify(draft, null, 2)}
          aria-label="Unsaved draft backup"
        />
        <button
          className="button primary"
          onClick={() => copyText(JSON.stringify(draft, null, 2))}
        >
          Copy unsaved draft
        </button>
      </Modal>
      <Modal
        open={publishing}
        onClose={() => setPublishing(false)}
        title="Ready for this Sunday?"
        description="This publishes the saved draft to invited pilot testers. It does not launch a public website."
      >
        <div className="publish-summary">
          <span className="eyebrow">SAMPLE BULLETIN</span>
          <h3>{data.draft.sermonTitle}</h3>
          <p>
            {data.draft.scripture} · {data.draft.serviceTime}
          </p>
        </div>
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => setPublishing(false)}
          >
            Keep as draft
          </button>
          <button
            className="button primary"
            onClick={() => publish.mutate({ revision })}
            disabled={publish.isPending}
          >
            <Send size={16} />
            {publish.isPending ? "Publishing…" : "Publish bulletin"}
          </button>
        </div>
      </Modal>
    </>
  );
}
