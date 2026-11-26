import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  Loader2,
  BookOpen,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { ChurchLogo, ChurchContact } from "@/components/ChurchReference";
import Brand, { Mark } from "@/components/Brand";
import { trpc } from "@/lib/trpc";
import { startLogin } from "@/const";

export function LoadingState() {
  return (
    <div className="loading-state">
      <Mark size={46} />
      <Loader2 className="spin" size={20} />
      <p>Opening your church workspace…</p>
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="loading-state">
      <ShieldCheck size={32} />
      <h2>We couldn’t load the pilot.</h2>
      <p>{message}</p>
      <button className="button primary" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export default function Access() {
  const [, navigate] = useLocation();
  const status = trpc.pilot.status.useQuery();
  const utils = trpc.useUtils();
  const [token, setToken] = useState("");
  const [key, setKey] = useState("");
  const [mode, setMode] = useState<"tester" | "owner">("owner");
  const redeemed = useRef(false);
  const redeem = trpc.pilot.redeem.useMutation({
    onSuccess: async () => {
      await utils.pilot.status.invalidate();
      navigate("/c/wholelife");
    },
    onError: e => toast.error(e.message),
  });
  const claim = trpc.pilot.claimOwner.useMutation({
    onSuccess: async () => {
      setKey("");
      await utils.pilot.status.invalidate();
      navigate("/admin");
      toast.success("Owner workspace activated");
    },
    onError: e => toast.error(e.message),
  });
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get(
      "token"
    );
    if (value && !redeemed.current) {
      redeemed.current = true;
      setMode("tester");
      window.history.replaceState(null, "", window.location.pathname);
      redeem.mutate({ token: value });
    }
  }, []);
  useEffect(() => {
    if (status.data?.isOwner && !window.location.hash) navigate("/admin");
  }, [status.data?.isOwner]);
  if (status.isLoading) return <LoadingState />;
  if (status.error)
    return (
      <ErrorState
        message={status.error.message}
        retry={() => status.refetch()}
      />
    );
  const s = status.data!;
  return (
    <div className="access-layout">
      <aside className="access-story">
        <Brand />
        <div className="access-story-main">
          <span className="eyebrow gold-text">THE WHOLELIFE PILOT</span>
          <h1>
            Connecting the Church
            <br />
            <em>Beyond Sunday.</em>
          </h1>
          <div className="story-rule" />
          <p>
            One place for the message, the moments,
            <br className="desktop-only" /> and the life of your church.
          </p>
          <div className="access-church">
            <ChurchLogo className="access-church-logo" />
            <div>
              <strong>WholeLife Community Church</strong>
              <span>Totowa, NJ · Sunday 11:00 AM</span>
            </div>
          </div>
          <ChurchContact className="access-contact" />
        </div>
        <footer>
          LIFELINE <span>POWERED BY THE O FACTOR</span>
        </footer>
      </aside>
      <main className="access-main">
        <span className="pilot-chip">
          <LockKeyhole size={13} /> RESTRICTED PILOT
        </span>
        <div className="access-card">
          <span className="eyebrow">A THOUGHTFUL START</span>
          <h2>
            Your Sunday,
            <br /> all in one place.
          </h2>
          <p className="muted">
            This is a private, sample-data pilot. Only the owner and invited
            testers can open the bulletin.
          </p>
          <div className="segmented">
            <button
              className={mode === "owner" ? "active" : ""}
              onClick={() => setMode("owner")}
            >
              <KeyRound size={15} /> Church owner
            </button>
            <button
              className={mode === "tester" ? "active" : ""}
              onClick={() => setMode("tester")}
            >
              <BookOpen size={15} /> Invited tester
            </button>
          </div>
          {mode === "owner" ? (
            <div className="access-form">
              {!s.authenticated ? (
                <>
                  <h3>Secure owner sign-in</h3>
                  <p className="muted">
                    Sign in with your Google account. Only the activated church
                    owner can edit or publish.
                  </p>
                  <button
                    className="button primary wide"
                    onClick={() => startLogin()}
                  >
                    Sign in securely <ArrowRight size={17} />
                  </button>
                </>
              ) : !s.ownerClaimed && s.canActivateByEmail ? (
                <div>
                  <h3>Activate your owner workspace</h3>
                  <p className="muted">
                    Signed in as <strong>{s.userEmail}</strong>, the account
                    approved as the church owner. Activate once to bind
                    LifeLine to this Google account.
                  </p>
                  <button
                    className="button primary wide"
                    disabled={claim.isPending}
                    onClick={() => claim.mutate({})}
                  >
                    {claim.isPending ? (
                      <Loader2 className="spin" size={17} />
                    ) : (
                      <KeyRound size={17} />
                    )}{" "}
                    Activate owner workspace
                  </button>
                </div>
              ) : !s.ownerClaimed ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    claim.mutate({ key });
                  }}
                >
                  <p className="muted">
                    Signed in as{" "}
                    <strong>{s.userEmail || s.userName || "your Google account"}</strong>. This
                    is not the approved owner account. If you have one, use
                    the private, one-time activation key in your owner
                    onboarding file to bind this church to your account.
                  </p>
                  <label>
                    Owner activation key
                    <input
                      type="password"
                      value={key}
                      onChange={e => setKey(e.target.value)}
                      autoComplete="off"
                      required
                      placeholder="Paste your private activation key"
                    />
                  </label>
                  <button
                    className="button primary wide"
                    disabled={claim.isPending || !key}
                  >
                    {claim.isPending ? (
                      <Loader2 className="spin" size={17} />
                    ) : (
                      <KeyRound size={17} />
                    )}{" "}
                    Activate owner workspace
                  </button>
                </form>
              ) : (
                <>
                  <h3>Owner access only</h3>
                  <p className="muted">
                    You’re signed in as {s.userEmail || s.userName}, but this account is not
                    the activated church owner. Use the owner account or a
                    tester invitation.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => startLogin()}
                  >
                    Sign in with the owner account
                  </button>
                </>
              )}
            </div>
          ) : (
            <form
              className="access-form"
              onSubmit={e => {
                e.preventDefault();
                redeem.mutate({ token: token.trim() });
              }}
            >
              <h3>You’re invited.</h3>
              <p className="muted">
                Open the private invitation your owner shared, or paste its
                access code below. No member account needed.
              </p>
              <label>
                Tester access code
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  autoComplete="off"
                  required
                  placeholder="Paste your invitation code"
                />
              </label>
              <button
                className="button primary wide"
                disabled={redeem.isPending || !token}
              >
                {redeem.isPending ? (
                  <Loader2 className="spin" size={17} />
                ) : (
                  <ArrowRight size={17} />
                )}{" "}
                Open the sample bulletin
              </button>
              {s.hasMemberAccess && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => navigate("/c/wholelife")}
                >
                  Return to your bulletin <ArrowRight size={15} />
                </button>
              )}
            </form>
          )}
          <div className="privacy-line">
            <ShieldCheck size={17} />
            <span>
              No AI. No billing. No emails.
              <br />
              Just your church, connected.
            </span>
          </div>
        </div>
        <span className="access-bottom">
          PRIVATE PREVIEW · NOT A PUBLIC CHURCH LAUNCH
        </span>
      </main>
    </div>
  );
}
