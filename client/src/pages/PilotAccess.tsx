import { useState } from "react";
import {
  ShieldCheck,
  Plus,
  Copy,
  Clock3,
  XCircle,
  Loader2,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { copyText, Modal } from "@/components/Actions";

function LaunchCard() {
  const status = trpc.pilot.status.useQuery();
  const utils = trpc.useUtils();
  const [confirm, setConfirm] = useState(false);
  const setLaunched = trpc.pilot.setLaunched.useMutation({
    onSuccess: async d => {
      setConfirm(false);
      await utils.pilot.status.invalidate();
      await utils.bulletin.member.invalidate();
      toast.success(
        d.launched
          ? "LifeLine is open to the congregation."
          : "LifeLine is back to a private pilot."
      );
    },
    onError: e => toast.error(e.message),
  });
  const launched = !!status.data?.launched;
  return (
    <section className={`launch-card ${launched ? "is-live" : ""}`}>
      <div>
        <span className="eyebrow">{launched ? "LIVE" : "PRIVATE PILOT"}</span>
        <h2>
          {launched
            ? "Open to the congregation"
            : "Ready to share with the congregation?"}
        </h2>
        <p>
          {launched
            ? "Anyone with the bulletin link or QR code can read the published bulletin and send a Connection Card. Editing stays with your account only."
            : "Opening LifeLine lets anyone with the bulletin link or QR code read it, without an invitation. It also lets you load real content from the team sheet and turns on Connection Cards."}
        </p>
      </div>
      <button
        className={launched ? "button secondary" : "button primary"}
        onClick={() => setConfirm(true)}
        disabled={status.isLoading || setLaunched.isPending}
      >
        {launched ? "Return to private pilot" : "Open to the congregation"}
      </button>
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={launched ? "Return to a private pilot?" : "Open LifeLine to the congregation?"}
        description={
          launched
            ? "Members without an invitation will no longer see the bulletin, and new Connection Cards will pause. Saved cards stay in your inbox."
            : "The published bulletin becomes readable by anyone with the link. Make sure this week's content is real and approved before you publish."
        }
      >
        <div className="button-row">
          <button className="button secondary" onClick={() => setConfirm(false)}>
            Cancel
          </button>
          <button
            className="button primary"
            onClick={() => setLaunched.mutate({ open: !launched })}
            disabled={setLaunched.isPending}
          >
            {setLaunched.isPending ? (
              <Loader2 className="spin" size={16} />
            ) : null}
            {launched ? "Return to pilot" : "Yes, open it"}
          </button>
        </div>
      </Modal>
    </section>
  );
}

export default function PilotAccess() {
  const liveStatus = trpc.pilot.status.useQuery();
  const query = trpc.pilot.invites.useQuery();
  const utils = trpc.useUtils();
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<{
    token: string;
    expiresAt: Date;
  } | null>(null);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const create = trpc.pilot.createInvite.useMutation({
    onSuccess: async d => {
      setCreated(d);
      setLabel("");
      await utils.pilot.invites.invalidate();
      toast.success("Private tester invitation created");
    },
    onError: e => toast.error(e.message),
  });
  const revoke = trpc.pilot.revokeInvite.useMutation({
    onSuccess: async () => {
      setRevokeId(null);
      await utils.pilot.invites.invalidate();
      toast.success("Invitation revoked. Tester access is closed.");
    },
    onError: e => toast.error(e.message),
  });
  const invitation = created
    ? `${window.location.origin}/access#token=${encodeURIComponent(created.token)}`
    : "";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A PRIVATE SPACE TO GET THINGS RIGHT</span>
          <h1>Invite a little feedback.</h1>
          <p>Keep your pilot in the hands of people you trust.</p>
        </div>
        <span className="large-status">
          <ShieldCheck size={18} />{" "}
          {liveStatus.data?.launched
            ? "Open to the congregation"
            : "Restricted to authorized testers"}
        </span>
      </div>
      <LaunchCard />
      <div className="access-management-grid">
        <section className="form-card">
          <div className="form-card-heading">
            <Plus size={19} />
            <h2>Create a tester invitation</h2>
          </div>
          <p>
            Share a private, seven-day invitation with an authorized tester. It
            opens only the published bulletin — never the owner workspace.
          </p>
          <form
            onSubmit={e => {
              e.preventDefault();
              create.mutate({ label: label.trim() });
            }}
          >
            <label>
              Invitation label
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                required
                maxLength={100}
                placeholder="e.g. Sunday welcome team"
              />
            </label>
            <button
              className="button primary"
              disabled={create.isPending || !label.trim()}
            >
              {create.isPending ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Plus size={16} />
              )}{" "}
              Create private invitation
            </button>
          </form>
          {created && (
            <div className="created-invite">
              <span className="eyebrow">COPY NOW — SHOWN ONCE</span>
              <h3>Your tester link is ready.</h3>
              <label>
                Private invitation URL
                <textarea
                  readOnly
                  value={invitation}
                  rows={3}
                  onFocus={e => e.target.select()}
                />
              </label>
              <button
                className="button primary"
                onClick={() => copyText(invitation)}
              >
                <Copy size={15} /> Copy invitation link
              </button>
              <details>
                <summary>Show access code for manual entry</summary>
                <textarea
                  readOnly
                  value={created.token}
                  aria-label="Private tester access code"
                  rows={2}
                />
              </details>
              <p className="fine-print">
                Expires {new Date(created.expiresAt).toLocaleString()}. Anyone
                with this link can use it until expiry or revocation. Share only
                with authorized testers. The app sends no email.
              </p>
            </div>
          )}
        </section>
        <aside className="aside-note">
          <LockKeyhole size={25} />
          <h2>
            Connection,
            <br />
            with boundaries.
          </h2>
          <p>
            Members need no account. A private invitation gives this browser
            temporary access to the published sample bulletin.
          </p>
          <p>
            Invitations can be reused by your intended testing group. Create
            separate labeled invitations if you need to revoke testers
            separately.
          </p>
          <p>
            No admin rights are granted. No billing. No AI. No email automation.
          </p>
        </aside>
      </div>
      <section className="form-card invitation-list">
        <div className="section-heading">
          <h2>Your invitations</h2>
          <span className="eyebrow">OWNER ONLY</span>
        </div>
        {query.isLoading ? (
          <p>Loading invitations…</p>
        ) : query.error ? (
          <div role="alert">
            <p>{query.error.message}</p>
            <button
              className="button secondary"
              onClick={() => query.refetch()}
            >
              Try again
            </button>
          </div>
        ) : !query.data?.length ? (
          <div className="empty-invites">
            <ShieldCheck size={28} />
            <h3>Start with someone you trust.</h3>
            <p>There are no tester invitations yet.</p>
          </div>
        ) : (
          query.data.map(inv => {
            const expired = new Date(inv.expiresAt).getTime() < Date.now();
            return (
              <div className="invitation-row" key={inv.id}>
                <span className="detail-icon">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <strong>{inv.label}</strong>
                  <p>
                    <Clock3 size={13} /> Expires{" "}
                    {new Date(inv.expiresAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`invitation-status ${inv.revoked || expired ? "inactive" : ""}`}
                >
                  {inv.revoked ? "Revoked" : expired ? "Expired" : "Active"}
                </span>
                <button
                  className="text-button"
                  disabled={inv.revoked || expired || revoke.isPending}
                  onClick={() => setRevokeId(inv.id)}
                >
                  <XCircle size={15} /> Revoke
                </button>
              </div>
            );
          })
        )}
      </section>
      <Modal
        open={revokeId !== null}
        onClose={() => setRevokeId(null)}
        title="Close this invitation?"
        description="Further server requests using this invitation will be denied. An already-open bulletin may remain visible until refresh. You can create a new invitation later."
      >
        <div className="button-row">
          <button
            className="button secondary"
            onClick={() => setRevokeId(null)}
          >
            Keep active
          </button>
          <button
            className="button primary"
            disabled={revoke.isPending}
            onClick={() => revokeId !== null && revoke.mutate({ id: revokeId })}
          >
            Revoke invitation
          </button>
        </div>
      </Modal>
    </>
  );
}
