import { APP_IDENTITY, WHOLELIFE_REFERENCE } from "@shared/identity";

// Retained for loading states only; the wordmark uses the official WholeLife logo.
export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M7 28V16a9 9 0 0 1 18 0v12"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M15 28V16a9 9 0 0 1 18 0v12"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <path
        d="M7 28h26M20 9v14M15 18h10"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <img
          className="lifeline-church-logo"
          src={WHOLELIFE_REFERENCE.logo}
          alt="WholeLife Community Church logo"
          width={720}
          height={675}
        />
      </span>
      <div>
        <span className="wordmark">
          Life<span>Line</span>
        </span>
        {!compact && (
          <>
            <span className="brand-tagline">{APP_IDENTITY.tagline}</span>
            <span className="brand-byline">{APP_IDENTITY.attribution}</span>
          </>
        )}
      </div>
    </div>
  );
}
