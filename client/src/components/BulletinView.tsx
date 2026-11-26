import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock3,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Trash2,
  HeartHandshake,
  Video,
} from "lucide-react";
import { formatDate, type Bulletin, type ChurchInfo } from "@shared/bulletin";
import { Modal } from "./Actions";
import { ChurchLogo, ChurchContact } from "./ChurchReference";

export function LocalNotes({
  bulletin,
  church,
}: {
  bulletin: Bulletin;
  church: ChurchInfo;
}) {
  const key = `churchconnect:notes:${church.slug}:${bulletin.serviceDate}`;
  const [notes, setNotes] = useState("");
  const [stored, setStored] = useState(true);
  const [clear, setClear] = useState(false);
  useEffect(() => {
    try {
      setNotes(localStorage.getItem(key) || "");
      setStored(true);
    } catch {
      setStored(false);
    }
  }, [key]);
  function change(value: string) {
    setNotes(value);
    try {
      localStorage.setItem(key, value);
      setStored(true);
    } catch {
      setStored(false);
    }
  }
  return (
    <section className="notes-section no-print" id="notes">
      <div className="section-heading">
        <div>
          <span className="eyebrow">A MOMENT TO REFLECT</span>
          <h2>My sermon notes</h2>
        </div>
        <ShieldCheck size={24} />
      </div>
      <p className="muted">
        Just for you. Saved on this browser only — never sent to the church or
        our servers.
      </p>
      <textarea
        value={notes}
        onChange={e => change(e.target.value)}
        aria-label="Private sermon notes"
        placeholder="What stood out to you today?"
        rows={7}
      />
      <div className="notes-footer">
        <span className={stored ? "success-text" : "error-text"}>
          {stored ? (
            <>
              <Check size={14} /> Saved on this device
            </>
          ) : (
            "Local storage unavailable — notes will be lost when you leave."
          )}
        </span>
        <button
          className="text-button"
          onClick={() => setClear(true)}
          disabled={!notes}
        >
          <Trash2 size={14} /> Clear notes
        </button>
      </div>
      <p className="fine-print">
        Notes are not encrypted or synced. Anyone using this browser profile can
        read them. Clearing browser data removes them. Copy your notes somewhere
        safe if you need a backup.
      </p>
      <Modal
        open={clear}
        onClose={() => setClear(false)}
        title="Clear this week’s notes?"
        description="This removes the notes from this browser. There is no server backup."
      >
        <div className="button-row">
          <button className="button secondary" onClick={() => setClear(false)}>
            Keep notes
          </button>
          <button
            className="button primary"
            onClick={() => {
              change("");
              setClear(false);
            }}
          >
            Clear notes
          </button>
        </div>
      </Modal>
    </section>
  );
}
export default function BulletinView({
  bulletin: b,
  church,
  notes = false,
  compact = false,
}: {
  bulletin: Bulletin;
  church: ChurchInfo;
  notes?: boolean;
  compact?: boolean;
}) {
  return (
    <article
      className={`bulletin-document ${compact ? "compact-bulletin" : ""}`}
    >
      {b.sampleData && (
        <div className="sample-notice">
          <span className="sample-dot" /> SAMPLE BULLETIN{" "}
          <span>Illustrative content, not confirmed church information.</span>
        </div>
      )}
      <header className="bulletin-intro">
        <ChurchLogo className="bulletin-church-logo" />
        <span className="eyebrow">SUNDAY AT WHOLELIFE</span>
        <h1>{church.name}</h1>
        <p>
          <Clock3 size={14} />
          Sunday · {b.serviceTime}
        </p>
        <ChurchContact className="bulletin-contact" />
        <div className="bulletin-date">{formatDate(b.serviceDate)}</div>
      </header>
      <section className="sermon-section">
        <span className="eyebrow">
          <BookOpen size={15} /> THIS WEEK’S MESSAGE
        </span>
        <h2>{b.sermonTitle}</h2>
        <div className="scripture-reference">{b.scripture}</div>
        {b.speaker && <p className="speaker">With {b.speaker}</p>}
        {b.sermonSummary && <p className="sermon-summary">{b.sermonSummary}</p>}
      </section>
      <section className="document-section">
        <div className="section-heading">
          <h2>Life in our community</h2>
          <span className="eyebrow">ANNOUNCEMENTS</span>
        </div>
        {b.announcements.length ? (
          b.announcements.map((a, index) => (
            <div className="announcement" key={a.id}>
              <span className="announcement-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{a.title}</h3>
                <p>{a.body}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No announcements this week.</p>
        )}
      </section>
      <section className="document-section">
        <div className="section-heading">
          <h2>Coming together</h2>
          <CalendarDays size={20} />
        </div>
        {b.events.length ? (
          b.events.map(e => (
            <div className="event" key={e.id}>
              <div className="event-date">
                <span>
                  {new Date(`${e.date}T12:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                  })}
                </span>
                <strong>{new Date(`${e.date}T12:00:00`).getDate()}</strong>
              </div>
              <div>
                <h3>{e.title}</h3>
                <p className="event-meta">
                  {e.time} · {e.location}
                </p>
                <p>{e.description}</p>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">No events listed this week.</p>
        )}
      </section>
      <section className="member-links">
        <div>
          <HeartHandshake size={21} />
          <h3>Give with purpose</h3>
          {b.givingUrl ? (
            <a
              className="text-button"
              href={b.givingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open church giving <ArrowUpRight size={15} />
            </a>
          ) : (
            <p>Giving link not yet provided by the church.</p>
          )}
        </div>
        <div>
          <Video size={21} />
          <h3>Join from wherever you are</h3>
          {b.livestreamUrl ? (
            <a
              className="text-button"
              href={b.livestreamUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Watch the livestream <ArrowUpRight size={15} />
            </a>
          ) : (
            <p>Livestream link not yet provided by the church.</p>
          )}
        </div>
      </section>
      {notes && <LocalNotes bulletin={b} church={church} />}
      <footer className="bulletin-footer">
        Connecting the Church Beyond Sunday.
        <span>LifeLine · Powered by The O Factor</span>
      </footer>
    </article>
  );
}
