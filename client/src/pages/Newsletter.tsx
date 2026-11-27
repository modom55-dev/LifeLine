import { ArrowLeft, Copy, Share2, HandHeart, MonitorPlay, CalendarDays, MapPin, Clock3 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatDate, newsletter } from "@shared/bulletin";
import { copyText } from "@/components/Actions";
import { ChurchLogo } from "@/components/ChurchReference";
import { trpc } from "@/lib/trpc";
import Access, { LoadingState, ErrorState } from "./Access";

/** A designed, phone-friendly newsletter built from the published bulletin. */
export default function Newsletter() {
  const [, navigate] = useLocation();
  const status = trpc.pilot.status.useQuery();
  const data = trpc.bulletin.member.useQuery(undefined, {
    enabled: !!status.data?.hasMemberAccess,
  });
  if (status.isLoading) return <LoadingState />;
  if (status.error)
    return <ErrorState message={status.error.message} retry={() => status.refetch()} />;
  if (!status.data?.hasMemberAccess) return <Access />;
  if (data.isLoading) return <LoadingState />;
  if (data.error)
    return <ErrorState message={data.error.message} retry={() => data.refetch()} />;
  const b = data.data?.bulletin;
  const church = data.data?.church;
  if (!b || !church) {
    navigate("/c/wholelife");
    return null;
  }
  const link = `${window.location.origin}/c/wholelife/newsletter`;
  async function share() {
    const shareData = {
      title: `The WholeLife Weekly · ${b!.sermonTitle}`,
      text: `This week at WholeLife Community Church: ${b!.sermonTitle}`,
      url: link,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
    } catch {
      return; /* the person closed the share sheet */
    }
    copyText(link);
    toast.success("Link copied. Paste it in a text or email.");
  }

  return (
    <div className="newsletter-page">
      <div className="newsletter-actions no-print">
        <button className="nl-chip" onClick={() => navigate("/c/wholelife")}>
          <ArrowLeft size={18} /> Bulletin
        </button>
        <div>
          <button className="nl-chip" onClick={() => copyText(newsletter(b, church))}>
            <Copy size={18} /> Copy text
          </button>
          <button className="nl-chip strong" onClick={share}>
            <Share2 size={18} /> Share
          </button>
        </div>
      </div>

      <article className="newsletter-sheet">
        <header className="nl-masthead">
          <ChurchLogo className="nl-logo" />
          <span className="nl-kicker">WholeLife Community Church</span>
          <h1>The WholeLife Weekly</h1>
          <p>
            {formatDate(b.serviceDate)} · {b.serviceTime}
          </p>
        </header>

        <section className="nl-message">
          <span className="nl-label">This week's message</span>
          <h2>{b.sermonTitle}</h2>
          <div className="nl-scripture">{b.scripture}</div>
          {b.speaker && <p className="nl-speaker">With {b.speaker}</p>}
          {b.sermonSummary && <p className="nl-summary">{b.sermonSummary}</p>}
        </section>

        {(b.givingUrl || b.livestreamUrl) && (
          <div className="nl-cta">
            {b.livestreamUrl && (
              <a className="nl-btn sky" href={b.livestreamUrl} target="_blank" rel="noopener noreferrer">
                <MonitorPlay size={20} /> Watch live
              </a>
            )}
            {b.givingUrl && (
              <a className="nl-btn ember" href={b.givingUrl} target="_blank" rel="noopener noreferrer">
                <HandHeart size={20} /> Give
              </a>
            )}
          </div>
        )}

        {b.announcements.length > 0 && (
          <section className="nl-section">
            <h3 className="nl-heading">Announcements</h3>
            {b.announcements.map(a => (
              <div className="nl-item" key={a.id}>
                <h4>{a.title}</h4>
                {a.body
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </div>
            ))}
          </section>
        )}

        {b.events.length > 0 && (
          <section className="nl-section">
            <h3 className="nl-heading">Coming up</h3>
            {[...b.events]
              .sort((x, y) => x.date.localeCompare(y.date))
              .map(e => (
                <div className="nl-event" key={e.id}>
                  <h4>{e.title}</h4>
                  <p className="nl-meta">
                    <span><CalendarDays size={16} /> {formatDate(e.date)}</span>
                    {e.time && <span><Clock3 size={16} /> {e.time}</span>}
                    {e.location && <span><MapPin size={16} /> {e.location}</span>}
                  </p>
                  {e.description && <p>{e.description}</p>}
                </div>
              ))}
          </section>
        )}

        <footer className="nl-footer">
          <strong>Connecting the Church Beyond Sunday.</strong>
          <span>105 Church Street, Totowa, NJ · wholelifechurch.org</span>
          <span>LifeLine · Powered by The O Factor</span>
        </footer>
      </article>
    </div>
  );
}
