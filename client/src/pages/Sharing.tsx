import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Download,
  ArrowUpRight,
  LockKeyhole,
  QrCode,
  Printer,
} from "lucide-react";
import { Link } from "wouter";
import { copyText, NewsletterButton } from "@/components/Actions";
import type { WorkspaceData } from "./Editor";

export default function Sharing({ data: d }: { data: WorkspaceData }) {
  const url = `${window.location.origin}/c/wholelife`;
  const qr = useRef<HTMLDivElement>(null);
  function download() {
    const svg = qr.current?.querySelector("svg");
    if (!svg) return;
    const copy = svg.cloneNode(true) as SVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const raw = new XMLSerializer().serializeToString(copy);
    const blob = new Blob([raw], { type: "image/svg+xml" });
    const target = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = target;
    a.download = "wholelife-bulletin-qr.svg";
    a.click();
    setTimeout(() => URL.revokeObjectURL(target), 1000);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A SIMPLE WAY TO STAY CONNECTED</span>
          <h1>One link. Every Sunday.</h1>
          <p>Share the bulletin, not a new URL every week.</p>
        </div>
      </div>
      <div className="sharing-grid">
        <section className="form-card qr-card">
          <span className="eyebrow">SCAN. READ. CONNECT.</span>
          <h2>Sunday starts here.</h2>
          <div className="qr-wrap" ref={qr}>
            <QRCodeSVG
              value={url}
              size={220}
              level="M"
              marginSize={4}
              title="WholeLife stable congregation bulletin URL"
              fgColor="#14283F"
              bgColor="#FFFFFF"
            />
          </div>
          <h3>WholeLife Community Church</h3>
          <p className="muted">Weekly bulletin · Totowa, NJ</p>
          <button className="button primary" onClick={download}>
            <Download size={16} /> Download QR code
          </button>
          <span className="fine-print">
            SVG format · scales cleanly for print
          </span>
        </section>
        <div>
          <section className="form-card">
            <div className="form-card-heading">
              <QrCode size={19} />
              <h2>Your congregation link</h2>
            </div>
            <p>
              This route always shows the latest published bulletin. Publishing
              next Sunday’s draft will not change this link.
            </p>
            <label>
              Stable pilot bulletin URL
              <input
                value={url}
                readOnly
                onFocus={e => e.target.select()}
                aria-label="Stable congregation URL"
              />
            </label>
            <div className="button-row">
              <button className="button primary" onClick={() => copyText(url)}>
                <Copy size={16} /> Copy link
              </button>
              <Link href="/c/wholelife" className="button secondary">
                Open bulletin <ArrowUpRight size={16} />
              </Link>
            </div>
          </section>
          <div className="quiet-card">
            <LockKeyhole size={23} />
            <div>
              <h3>Private by design.</h3>
              <p>
                This QR does not contain an access secret. Invited testers first
                open their private invitation in the same browser. The bulletin
                stays restricted.
              </p>
              <p>
                The Preview origin belongs to this development environment; a
                permanent production origin and public congregation access wait
                for launch approval. A new environment origin requires
                regenerating the QR.
              </p>
              <Link className="text-button" href="/admin/access">
                Create a tester invitation <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
          <section className="form-card">
            <h2>Other ways to share</h2>
            <p>
              Print a clean bulletin or copy a plain-text newsletter from the
              published snapshot. No emails are sent by the app.
            </p>
            <div className="button-row">
              <Link href="/c/wholelife" className="button secondary">
                <Printer size={16} /> Open to print
              </Link>
              {d.published && (
                <NewsletterButton bulletin={d.published} church={d.church} />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
