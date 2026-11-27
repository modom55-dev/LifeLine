import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  FileText,
  QrCode,
  ShieldCheck,
  BookOpen,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  MapPin,
  Eye,
  ArrowRight,
  Check,
  LockKeyhole,
  Printer,
  LogOut,
  Menu,
  X,
  CalendarDays,
  Send,
  Inbox,
  Globe2,
} from "lucide-react";
import { useState } from "react";
import ChurchReference, {
  ChurchLogo,
  ChurchContact,
} from "@/components/ChurchReference";
import Brand, { Mark } from "@/components/Brand";
import BulletinView from "@/components/BulletinView";
import { NewsletterButton } from "@/components/Actions";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@shared/bulletin";
import Editor, { type WorkspaceData } from "./Editor";
import Sharing from "./Sharing";
import PilotAccess from "./PilotAccess";
import Cards from "./Cards";
import Access, { LoadingState, ErrorState } from "./Access";

const navigation = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard },
  { path: "/admin/editor", label: "Weekly bulletin", icon: FileText },
  { path: "/admin/cards", label: "Connection cards", icon: Inbox },
  { path: "/admin/share", label: "Sharing & QR code", icon: QrCode },
  { path: "/admin/access", label: "Access", icon: ShieldCheck },
];
function relativeTime(date: Date) {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function Overview({ data: d, launched }: { data: WorkspaceData; launched: boolean }) {
  const bulletin = d.published || d.draft;
  const hasDraftChanges =
    JSON.stringify(d.draft) !== JSON.stringify(d.published);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR CHURCH. CONNECTED.</span>
          <h1>Ready for Sunday.</h1>
          <p>A thoughtful bulletin. A more connected community.</p>
        </div>
        <Link href="/admin/editor" className="button primary">
          <FileText size={17} /> Edit bulletin <ArrowRight size={16} />
        </Link>
      </div>
      {hasDraftChanges && (
        <div className="publish-banner" role="status">
          <div>
            <strong>“{d.draft.sermonTitle}” is ready but not live yet.</strong>
            <span>
              {launched
                ? "The congregation still sees the last published bulletin."
                : "Invited testers still see the last published bulletin."}
            </span>
          </div>
          <Link href="/admin/editor" className="button primary publish-button">
            Review &amp; publish <ArrowRight size={18} />
          </Link>
        </div>
      )}
      <div className="overview-grid">
        <div className="overview-left">
          <div className="sunday-card">
            <div className="sunday-card-top">
              <span className="eyebrow">THIS WEEK AT WHOLELIFE</span>
              <span className="light-status">
                <span className="status-dot" />
                {d.published ? "Published" : "Draft only"}
              </span>
            </div>
            <p className="sunday-date">
              {formatDate(bulletin.serviceDate)}{" "}
              <span>· {bulletin.serviceTime}</span>
            </p>
            <h2>{bulletin.sermonTitle}</h2>
            <p className="sunday-scripture">{bulletin.scripture}</p>
            <div className="sunday-card-bottom">
              {bulletin.sampleData ? (
                <span className="sample-pill">SAMPLE CONTENT</span>
              ) : (
                <span className="sample-pill live-pill">THIS SUNDAY</span>
              )}
              <Link href="/c/wholelife">
                View member bulletin <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="card-watermark">
              <Mark size={170} />
            </div>
          </div>
          <div className="status-cards">
            <div>
              <span className="status-card-icon">
                <FileText size={19} />
              </span>
              <span className="eyebrow">BULLETIN STATUS</span>
              <h3>{hasDraftChanges ? "Draft changes" : "Up to date"}</h3>
              <p>
                {hasDraftChanges
                  ? "Saved draft differs from member view"
                  : "Saved and published versions match"}
              </p>
            </div>
            <div>
              <span className="status-card-icon">
                <ShieldCheck size={19} />
              </span>
              <span className="eyebrow">ACCESS</span>
              <h3>{launched ? "Open to the congregation" : "Invite only"}</h3>
              <p>
                {launched
                  ? "Anyone with the bulletin link can read it."
                  : "Private preview. No public launch."}
              </p>
            </div>
          </div>
          <section className="workspace-section">
            <div className="section-heading">
              <h2>A few details. A fuller Sunday.</h2>
              <Link className="text-button" href="/admin/editor">
                Manage bulletin <ArrowRight size={15} />
              </Link>
            </div>
            <div className="detail-list">
              <Link href="/admin/editor">
                <span className="detail-icon">
                  <BookOpen size={20} />
                </span>
                <div>
                  <strong>Message & scripture</strong>
                  <span>
                    {d.draft.sermonTitle} · {d.draft.scripture}
                  </span>
                </div>
                <ArrowRight size={17} />
              </Link>
              <Link href="/admin/editor">
                <span className="detail-icon">
                  <FileText size={20} />
                </span>
                <div>
                  <strong>Life in our community</strong>
                  <span>
                    {d.draft.announcements.length} announcements ready for your
                    bulletin
                  </span>
                </div>
                <ArrowRight size={17} />
              </Link>
              <Link href="/admin/editor">
                <span className="detail-icon">
                  <CalendarDays size={20} />
                </span>
                <div>
                  <strong>Coming together</strong>
                  <span>
                    {d.draft.events.length} upcoming{" "}
                    {d.draft.sampleData ? "sample " : ""}events
                  </span>
                </div>
                <ArrowRight size={17} />
              </Link>
            </div>
          </section>
          <div className="last-saved">
            <Check size={14} /> Draft saved {relativeTime(d.savedAt)}
            <span>Revision {d.revision}</span>
          </div>
        </div>
        <aside className="member-preview-card">
          <div className="section-heading">
            <span className="eyebrow">THE MEMBER EXPERIENCE</span>
            <span className="tiny-pill">MOBILE FIRST</span>
          </div>
          <h2>Sunday, in their hands.</h2>
          <p className="muted">
            A simple bulletin. No member account.
            <br />
            No AI subscription. Just connection.
          </p>
          <div className="phone-preview">
            <div className="phone-notch" />
            <div className="phone-content">
              <div className="phone-brand">
                <ChurchLogo className="phone-church-logo" />
                <span>WholeLife</span>
              </div>
              {bulletin.sampleData && (
                <span className="phone-sample">SAMPLE BULLETIN</span>
              )}
              <span className="eyebrow">SUNDAY AT WHOLELIFE</span>
              <h3>
                WholeLife
                <br />
                Community Church
              </h3>
              <div className="phone-meta">
                Totowa, NJ · {bulletin.serviceTime}
              </div>
              <div className="phone-rule" />
              <span className="eyebrow">THIS WEEK’S MESSAGE</span>
              <h4>{bulletin.sermonTitle}</h4>
              <p className="phone-scripture">{bulletin.scripture}</p>
              <p className="phone-summary">{bulletin.sermonSummary}</p>
              <div className="phone-rule" />
              <h5>Life in our community</h5>
              <p className="phone-summary">
                {bulletin.announcements[0]?.title ||
                  "Your weekly announcements"}
              </p>
            </div>
          </div>
          <Link href="/c/wholelife" className="button secondary wide">
            <Eye size={16} /> Open member view <ArrowUpRight size={16} />
          </Link>
        </aside>
      </div>
      <div className="bottom-note">
        <span className="bottom-note-icon">
          <QrCode size={22} />
        </span>
        <div>
          <strong>One link. Every Sunday.</strong>
          <p>
            Your congregation’s bulletin URL stays the same when a new week is
            published.
          </p>
        </div>
        <Link href="/admin/share" className="text-button">
          Get your QR code <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
function Guide() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A SMALL GUIDE TO A GOOD START</span>
          <h1>Make Sunday simple.</h1>
          <p>Your owner onboarding, without the overwhelm.</p>
        </div>
      </div>
      <div className="guide-content">
        <ChurchReference owner />
        <section className="form-card">
          <h2>Your weekly rhythm</h2>
          <ol className="guide-steps">
            <li>
              <strong>Open Weekly bulletin.</strong>
              <p>
                Edit the service date, time, sermon title, scripture,
                announcements and events. All pilot content stays labeled sample
                data.
              </p>
            </li>
            <li>
              <strong>Save a draft.</strong>
              <p>
                This persists your work to the database. Members continue to see
                the previous published snapshot. If another tab saves, a
                revision conflict preserves your unsaved work rather than
                overwriting it.
              </p>
            </li>
            <li>
              <strong>Preview, then publish.</strong>
              <p>
                Preview saves and shows the draft. Publish copies the saved
                version to the member view. Publishing a bulletin never changes
                the website’s private access setting.
              </p>
            </li>
            <li>
              <strong>Invite only authorized testers.</strong>
              <p>
                Pilot access creates a private seven-day invitation. Copy and
                share it yourself; the app sends no emails. Revoke it at any
                time. Testers need no account.
              </p>
            </li>
            <li>
              <strong>Reuse your QR code.</strong>
              <p>
                Sharing & QR code gives you the stable congregation route. It
                contains no invitation secret, so a tester first needs to redeem
                their private invitation in the same browser.
              </p>
            </li>
          </ol>
        </section>
        <section className="form-card">
          <h2>What stays private</h2>
          <p>
            Only your activated Google account can edit and publish. Tester
            invitations allow only the published member bulletin. Private notes
            are browser-local and never transmitted. Anyone using the same
            browser profile can read them, and clearing browser data removes
            them.
          </p>
          <h3>Before real church use</h3>
          <p>
            Replace all samples with church-approved content; verify giving and
            livestream HTTPS URLs directly with the church. The pilot leaves
            them blank. A public launch, permanent domain and production
            security review require separate approval.
          </p>
          <div className="quiet-card">
            <ShieldCheck size={22} />
            <p>
              No AI dependency, subscriptions, payment processing, analytics
              dashboard, or outbound emails. QR generation, print and newsletter
              formatting work without AI.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
export default function Workspace() {
  const [location, navigate] = useLocation();
  const [menu, setMenu] = useState(false);
  const status = trpc.pilot.status.useQuery();
  const query = trpc.bulletin.workspace.useQuery(undefined, {
    enabled: !!status.data?.isOwner,
  });
  const unread = trpc.connect.unread.useQuery(undefined, {
    enabled: !!status.data?.isOwner,
    refetchInterval: 60_000,
  });
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {}
      await utils.pilot.status.invalidate();
      utils.bulletin.workspace.reset();
      navigate("/access");
    },
  });
  if (status.isLoading) return <LoadingState />;
  if (status.error)
    return (
      <ErrorState
        message={status.error.message}
        retry={() => status.refetch()}
      />
    );
  if (!status.data?.isOwner) return <Access />;
  if (query.isLoading) return <LoadingState />;
  if (query.error)
    return (
      <ErrorState message={query.error.message} retry={() => query.refetch()} />
    );
  if (!query.data) return <LoadingState />;
  const d = query.data;
  const section = location.split("/")[2] || "overview";
  return (
    <div
      className={`workspace ${menu ? "mobile-menu-open" : ""} ${section === "preview" ? "draft-preview-page" : ""}`}
    >
      <aside className="sidebar no-print">
        <Link href="/admin" aria-label="LifeLine overview">
          <Brand />
        </Link>
        <button
          className="icon-button sidebar-close"
          onClick={() => setMenu(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="church-switcher">
          <span className="church-avatar">
            <ChurchLogo className="switcher-church-logo" />
          </span>
          <div>
            <strong>WholeLife Community</strong>
            <span>Totowa, New Jersey</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <ChurchContact className="sidebar-contact" />
        <span className="nav-eyebrow">YOUR WORKSPACE</span>
        <nav>
          {navigation.map(n => (
            <Link
              key={n.path}
              href={n.path}
              className={
                (section === "overview" && n.path === "/admin") ||
                location === n.path
                  ? "active"
                  : ""
              }
              onClick={() => setMenu(false)}
            >
              <n.icon size={18} />
              {n.label}
              {n.path === "/admin/editor" && <span className="nav-dot" />}
              {n.path === "/admin/cards" && !!unread.data && (
                <span className="nav-count">{unread.data}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="pilot-sidebar-card">
            {status.data.launched ? (
              <>
                <span>
                  <Globe2 size={17} /> Live for WholeLife
                </span>
                <p>
                  Open to the congregation.
                  <br />
                  Editing stays with you.
                </p>
              </>
            ) : (
              <>
                <span>
                  <ShieldCheck size={17} /> A thoughtful pilot
                </span>
                <p>
                  A private space to get things right.
                  <br />
                  Sample data. Invited testers only.
                </p>
              </>
            )}
            <Link href="/admin/access">
              Manage access <ArrowRight size={14} />
            </Link>
          </div>
          <Link
            href="/admin/guide"
            className="sidebar-help"
            onClick={() => setMenu(false)}
          >
            <BookOpen size={18} /> Owner guide
          </Link>
          <button
            className="sidebar-help"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut size={18} /> Sign out
          </button>
          <div className="owner-profile">
            <span>{(status.data.userName || "Owner").charAt(0)}</span>
            <div>
              <strong>{status.data.userName || "Church owner"}</strong>
              <small>Church administrator</small>
            </div>
            <span className="owner-dot" />
          </div>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-header no-print">
          <div>
            <button
              className="icon-button mobile-menu-button"
              onClick={() => setMenu(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span className="header-church">WholeLife Community Church</span>
            <span className="header-separator" />
            <span className="header-location">
              <MapPin size={13} /> Totowa, NJ
            </span>
          </div>
          <div>
            <span className="header-service">
              <Clock3 size={14} /> Sunday · {d.church.serviceTime}
            </span>
            {status.data.launched ? (
              <span className="pilot-chip live-chip">
                <Globe2 size={12} /> LIVE
              </span>
            ) : (
              <span className="pilot-chip">
                <LockKeyhole size={12} /> PRIVATE PILOT
              </span>
            )}
          </div>
        </header>
        {!status.data.launched && (
          <div className="sample-banner no-print">
            <span>
              <span className="sample-dot" />
              <strong>A space to explore.</strong> You’re viewing sample data,
              not confirmed church information.
            </span>
            <span>
              No public launch <ShieldCheck size={13} />
            </span>
          </div>
        )}
        <main className="workspace-main">
          {section === "editor" ? (
            <Editor data={d} />
          ) : section === "share" ? (
            <Sharing data={d} />
          ) : section === "cards" ? (
            <Cards />
          ) : section === "access" ? (
            <PilotAccess />
          ) : section === "guide" ? (
            <Guide />
          ) : section === "preview" ? (
            <>
              <div className="page-heading no-print">
                <div>
                  <span className="eyebrow">
                    DRAFT PREVIEW · NOT MEMBER-PUBLISHED
                  </span>
                  <h1>A Sunday worth sharing.</h1>
                  <p>You’re reading the saved draft, revision {d.revision}.</p>
                </div>
                <div className="button-row">
                  <Link href="/admin/editor" className="button secondary">
                    Back to editor
                  </Link>
                  <button
                    className="button secondary"
                    onClick={() => window.print()}
                  >
                    <Printer size={16} /> Print
                  </button>
                  <NewsletterButton bulletin={d.draft} church={d.church} />
                </div>
              </div>
              <div className="draft-document">
                <div className="draft-print-marker">
                  UNPUBLISHED SAVED DRAFT · Revision {d.revision} · Not the
                  member-published bulletin
                </div>
                <BulletinView bulletin={d.draft} church={d.church} />
              </div>
            </>
          ) : section === "overview" ? (
            <Overview data={d} launched={!!status.data.launched} />
          ) : (
            <ErrorState
              message="That workspace section does not exist."
              retry={() => navigate("/admin")}
            />
          )}
        </main>
        <footer className="workspace-footer no-print">
          <span>Made for community. Built with care.</span>
          <span>
            LIFELINE <span className="footer-divider" /> POWERED BY THE O FACTOR
          </span>
        </footer>
      </div>
    </div>
  );
}
