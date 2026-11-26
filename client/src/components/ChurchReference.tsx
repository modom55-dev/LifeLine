import { ArrowUpRight, ChevronDown, MapPin, BookOpen } from "lucide-react";
import { WHOLELIFE_REFERENCE as church } from "@shared/identity";

export function ChurchLogo({
  className = "church-logo",
}: {
  className?: string;
}) {
  return (
    <img
      className={className}
      src={church.logo}
      alt="WholeLife Community Church logo"
      width={720}
      height={675}
    />
  );
}
export function ChurchContact({ className = "" }: { className?: string }) {
  return (
    <div className={`church-contact ${className}`}>
      <span>
        <MapPin size={13} />
        {church.address}
      </span>
      <a href={church.website} target="_blank" rel="noopener noreferrer">
        www.wholelifechurch.org <ArrowUpRight size={12} />
      </a>
    </div>
  );
}
export default function ChurchReference({
  owner = false,
}: {
  owner?: boolean;
}) {
  return (
    <details className="church-reference no-print" open={owner || undefined}>
      <summary>
        <ChurchLogo className="church-reference-logo" />
        <div>
          <span className="eyebrow">OUR CHURCH</span>
          <strong>WholeLife, beyond the bulletin.</strong>
        </div>
        <ChevronDown size={18} />
      </summary>
      <div className="church-reference-content">
        <div className="reference-mission">
          <span className="eyebrow">RECONCILIATION & RESTORATION</span>
          <p>“{church.mission}”</p>
          <span className="reference-scripture">
            <BookOpen size={13} /> 1 Thessalonians 5:23
          </span>
          <div className="reference-address">
            <MapPin size={14} />
            {church.address}
          </div>
          <a
            className="text-button"
            href={church.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit the official church website <ArrowUpRight size={14} />
          </a>
        </div>
        <div className="reference-leadership">
          <h3>Serving the WholeLife family</h3>
          <span>Senior Pastor</span>
          <strong>{church.seniorPastor}</strong>
          <span>Executive Pastor</span>
          <strong>{church.executivePastor}</strong>
          <p className="fine-print">
            Church identity from wholelifechurch.org. Weekly sermon,
            announcement and event content in this pilot is still sample data.
          </p>
        </div>
        <div className="ministry-reference">
          <div className="ministry-logo-frame">
            <img
              src={church.morningMannaLogo}
              alt="Morning Manna — Bishop Michael H. Odom, Sr., logo from the supplied intro video"
              width={860}
              height={430}
              loading="lazy"
            />
          </div>
          <div>
            <span className="eyebrow">CONNECTED MINISTRY · MORNING MANNA</span>
            <p>Strength for the journey, grace for the calling,</p>
            <span className="ministry-time">{church.morningMannaTime}</span>
            <p className="fine-print">
              Original ministry logo from your supplied video; schedule from the
              official church website. No streaming destination has been added.
            </p>
          </div>
        </div>
        <p className="reference-source">
          Official reference checked {church.checkedDate}.{" "}
          <a href={church.aboutUrl} target="_blank" rel="noopener noreferrer">
            Church & leadership source <ArrowUpRight size={11} />
          </a>
        </p>
      </div>
    </details>
  );
}
