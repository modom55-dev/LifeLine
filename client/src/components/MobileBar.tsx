import { useEffect, useState } from "react";
import { HandHeart, MonitorPlay, HeartHandshake, NotebookPen, X, Share, SquarePlus } from "lucide-react";

/** Phone-only bar fixed to the bottom of the screen: Give · Watch · Connect · Notes. */
export function MobileActionBar({
  givingUrl,
  livestreamUrl,
}: {
  givingUrl?: string;
  livestreamUrl?: string;
}) {
  return (
    <nav className="mobile-action-bar no-print" aria-label="Quick actions">
      {givingUrl ? (
        <a href={givingUrl} target="_blank" rel="noopener noreferrer">
          <HandHeart size={24} />
          <span>Give</span>
        </a>
      ) : null}
      {livestreamUrl ? (
        <a href={livestreamUrl} target="_blank" rel="noopener noreferrer">
          <MonitorPlay size={24} />
          <span>Watch Live</span>
        </a>
      ) : null}
      <a href="#connect">
        <HeartHandshake size={24} />
        <span>Connect</span>
      </a>
      <a href="#notes">
        <NotebookPen size={24} />
        <span>Notes</span>
      </a>
    </nav>
  );
}

const TIP_KEY = "lifeline:homescreen-tip-dismissed";

/** One-time tip on phones explaining how to put the WholeLife icon on the home screen. */
export function HomeScreenTip() {
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    try {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      const phone = window.matchMedia("(max-width: 720px)").matches;
      const dismissed = localStorage.getItem(TIP_KEY) === "1";
      setIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
      setShow(phone && !standalone && !dismissed);
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  const close = () => {
    setShow(false);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      /* ignore */
    }
  };
  return (
    <aside className="homescreen-tip no-print">
      <img src="/brand/apple-touch-icon.png" alt="" />
      <div>
        <strong>Keep WholeLife one tap away</strong>
        {ios ? (
          <p>
            Tap <Share size={16} aria-label="Share" /> at the bottom of Safari, then{" "}
            <b>Add to Home Screen</b> <SquarePlus size={16} aria-hidden />.
          </p>
        ) : (
          <p>
            Tap the <b>⋮</b> menu at the top of your browser, then{" "}
            <b>Add to Home screen</b>.
          </p>
        )}
      </div>
      <button onClick={close} aria-label="Close tip">
        <X size={20} />
      </button>
    </aside>
  );
}
