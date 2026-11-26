// Coding-themed loading graphics. Everything here is decorative, so it is
// hidden from assistive tech; the surrounding badge carries the live status.

const RING_GLYPHS = ["{ }", "</>", "=>", "()", "[]", "&&", ";;", "##"];

type SpinnerProps = {
  size?: number;
  /** Draw a rotating ring of code glyphs instead of a plain arc. */
  ring?: boolean;
};

export function CodeSpinner({ size = 16, ring = false }: SpinnerProps) {
  if (ring) {
    return (
      <span
        aria-hidden="true"
        className="relative inline-grid shrink-0 place-items-center"
        style={{ width: size, height: size }}
      >
        <span className="absolute inset-0 animate-spin" style={{ animationDuration: "3.6s" }}>
          {RING_GLYPHS.map((glyph, i) => (
            <span
              key={glyph}
              className="absolute left-1/2 top-1/2 font-mono font-bold text-flame/45"
              style={{
                fontSize: Math.max(8, Math.round(size * 0.16)),
                transform: `translate(-50%, -50%) rotate(${(i / RING_GLYPHS.length) * 360}deg) translateY(-${size * 0.42}px)`,
              }}
            >
              {glyph}
            </span>
          ))}
        </span>
        <span
          className="font-mono font-bold leading-none text-flame"
          style={{ fontSize: Math.round(size * 0.3) }}
        >
          {"</>"}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        className="absolute inset-0 h-full w-full animate-spin"
        style={{ animationDuration: "1s" }}
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="2.5"
        />
        <path
          d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <span
        className="font-mono font-bold leading-none"
        style={{ fontSize: Math.max(7, Math.round(size * 0.44)) }}
      >
        {"</>"}
      </span>
    </span>
  );
}

export function AnalyzingBadge() {
  return (
    <span
      role="status"
      aria-live="polite"
      title="Analyzing…"
      className="flex items-center gap-1.5 text-flame/80"
    >
      <CodeSpinner size={14} />
      <span>analyzing</span>
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="animate-dot h-1 w-1 rounded-full bg-flame"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </span>
  );
}

export function LiveBadge() {
  return (
    <span
      title="Score is up to date"
      className="flex items-center gap-1.5 text-emerald-400/60"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      <span>live</span>
    </span>
  );
}

/** Thin sweeping bar so the page itself shows motion while re-analyzing. */
export function ScanBar() {
  return (
    <div
      aria-hidden="true"
      className="h-0.5 w-full overflow-hidden rounded-full bg-white/5"
    >
      <div className="animate-scan h-full w-1/4 rounded-full bg-gradient-to-r from-transparent via-flame to-transparent" />
    </div>
  );
}
