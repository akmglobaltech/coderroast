import { sparklinePoints, type HistoryEntry, type HistorySummary } from "../lib/history";

interface Props {
  entries: HistoryEntry[];
  summary: HistorySummary;
  onClear: () => void;
}

function timeAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function HistoryPanel({ entries, summary, onClear }: Props) {
  if (entries.length === 0) return null;

  const now = Date.now();
  const recent = [...entries].slice(-8).reverse();
  const points = sparklinePoints(summary.series.slice(-24), 100, 28);
  const deltaLabel =
    summary.delta === 0 ? "no change" : summary.delta > 0 ? `+${summary.delta}` : `${summary.delta}`;
  const deltaTone =
    summary.delta > 0 ? "text-emerald-300" : summary.delta < 0 ? "text-[#ff6b8a]" : "text-white/40";

  return (
    <section className="rounded-2xl border border-ink-line bg-ink-soft/60 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[10px] font-bold tracking-[0.2em] text-white/40">
          YOUR HISTORY
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[10px] text-white/35 transition hover:border-white/25 hover:text-white/70"
        >
          clear
        </button>
      </div>

      <div className="mb-3 flex items-end gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-wider text-white/30">AVERAGE</p>
          <p className="font-mono text-2xl leading-none text-white tabular-nums">
            {summary.average}
            <span className={`ml-2 text-[11px] ${deltaTone}`}>{deltaLabel}</span>
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <svg
            viewBox="0 0 100 28"
            preserveAspectRatio="none"
            className="h-7 w-full"
            role="img"
            aria-label={`Score trend across ${summary.count} roasts`}
          >
            <polyline
              points={points}
              fill="none"
              stroke="url(#trend)"
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <defs>
              <linearGradient id="trend" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff6b35" />
                <stop offset="100%" stopColor="#22d3a7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <ul className="space-y-1">
        {recent.map((e) => (
          <li
            key={e.at}
            className="flex items-center gap-2.5 rounded-md px-1 py-1 font-mono text-[11px] text-white/45"
          >
            <span className="w-8 shrink-0 tabular-nums text-white/70">{e.score}</span>
            <span className="w-3 shrink-0 text-white/30">{e.grade}</span>
            <span className="min-w-0 flex-1 truncate text-white/30">{e.language}</span>
            <span className="shrink-0 text-white/25">{e.findings}×</span>
            <span className="w-14 shrink-0 text-right text-white/25">{timeAgo(e.at, now)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[10px] leading-relaxed text-white/25">
        Stored only in this browser. Nothing leaves your machine.
      </p>
    </section>
  );
}
