import { useState } from "react";
import {
  Inbox,
  Mail,
  Phone,
  Sparkles,
  HandHeart,
  CheckCircle2,
  Clock3,
  AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { LoadingState, ErrorState } from "./Access";

const when = (d: Date | string) =>
  new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function Cards() {
  const query = trpc.connect.inbox.useQuery();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState<number | null>(null);
  const markRead = trpc.connect.markRead.useMutation({
    onSuccess: async () => {
      await utils.connect.inbox.invalidate();
      await utils.connect.unread.invalidate();
    },
  });
  if (query.isLoading) return <LoadingState />;
  if (query.error)
    return <ErrorState message={query.error.message} retry={() => query.refetch()} />;
  const d = query.data!;
  const unread = d.cards.filter((c: any) => !c.readAt).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE PEOPLE BEHIND EVERY SUNDAY</span>
          <h1>Connection cards</h1>
          <p>
            {d.cards.length
              ? `${d.cards.length} card${d.cards.length === 1 ? "" : "s"}${unread ? ` · ${unread} new` : ""}`
              : "Cards members send from the bulletin land here."}
          </p>
        </div>
      </div>
      {(!d.emailReady || !d.smsReady) && (
        <div className="setup-note">
          <AlertCircle size={18} />
          <p>
            {!d.emailReady && (
              <>
                <strong>Email isn't connected yet.</strong> Team alerts and
                first-time guest thank-yous are queued and will send once email
                is set up.{" "}
              </>
            )}
            {!d.smsReady && (
              <>
                <strong>Text alerts aren't connected yet.</strong> They start
                once the texting service is approved.
              </>
            )}
          </p>
        </div>
      )}
      {d.cards.length === 0 ? (
        <section className="empty-state">
          <Inbox size={30} />
          <h2>No cards yet.</h2>
          <p>
            When someone fills out the Connection Card on the member bulletin,
            it appears here and your team is alerted.
          </p>
        </section>
      ) : (
        <div className="card-inbox">
          {d.cards.map((c: any) => {
            const expanded = open === c.id;
            return (
              <article
                key={c.id}
                className={`inbox-card ${c.readAt ? "" : "unread"}`}
              >
                <button
                  className="inbox-row"
                  onClick={() => {
                    setOpen(expanded ? null : c.id);
                    if (!c.readAt) markRead.mutate({ id: c.id });
                  }}
                  aria-expanded={expanded}
                >
                  <span className="inbox-name">
                    {!c.readAt && <span className="unread-dot" />}
                    {c.name}
                  </span>
                  <span className="inbox-tags">
                    {c.firstTime && (
                      <span className="tag tag-guest">
                        <Sparkles size={12} /> First-time guest
                      </span>
                    )}
                    {c.prayerRequest && (
                      <span className="tag tag-prayer">
                        <HandHeart size={12} /> Prayer
                      </span>
                    )}
                  </span>
                  <span className="inbox-when">{when(c.createdAt)}</span>
                </button>
                {expanded && (
                  <div className="inbox-detail">
                    <div className="inbox-contact">
                      {c.email && (
                        <a href={`mailto:${c.email}`}>
                          <Mail size={15} /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>
                          <Phone size={15} /> {c.phone}
                        </a>
                      )}
                    </div>
                    <p>
                      <strong>Looking for:</strong>{" "}
                      {c.interests.length ? c.interests.join(", ") : "Nothing selected"}
                    </p>
                    {c.prayerRequest && (
                      <div className="prayer-box">
                        <strong>Prayer request</strong>
                        <p>{c.prayerRequest}</p>
                      </div>
                    )}
                    <p className="fine-print">
                      Email follow-up: {c.followUpOk ? "OK" : "Not requested"}
                    </p>
                    {c.followUps.length > 0 && (
                      <ul className="followups">
                        {c.followUps.map((f: any) => (
                          <li key={f.kind}>
                            {f.sentAt ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <Clock3 size={14} />
                            )}
                            {f.kind === "guest_thanks_1"
                              ? "Thank-you email"
                              : "One-week thank-you"}
                            {": "}
                            {f.sentAt
                              ? `sent ${when(f.sentAt)}`
                              : d.emailReady
                                ? `scheduled ${when(f.sendAfter)}`
                                : "waiting for email setup"}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
