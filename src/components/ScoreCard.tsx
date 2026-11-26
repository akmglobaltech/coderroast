import type { RoastResult } from "../lib/roast";
import { gradeColor } from "../lib/share";
import { CodeSpinner } from "./Analyzing";

interface Props {
  result: RoastResult;
  pending?: boolean;
}

export default function ScoreCard({ result, pending = false }: Props) {
  const accent = gradeColor(result.grade);
  const circumference = 2 * Math.PI * 78;
  const dash = (result.score / 100) * circumference;

  return (
    <div className="animate-rise rounded-2xl border border-ink-line bg-ink-soft/80 p-6 backdrop-blur">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div className="relative h-44 w-44 shrink-0">
          <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
            <circle
              cx="90"
              cy="90"
              r="78"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="12"
            />
            <circle
              cx="90"
              cy="90"
              r="78"
              fill="none"
              stroke={accent}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-5xl font-extrabold tabular-nums" style={{ color: accent }}>
              {result.score}
            </span>
            <span className="font-mono text-[11px] tracking-widest text-white/35">/ 100</span>
          </div>
          {pending && (
            <div className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full border border-ink-line bg-ink text-flame shadow-lg">
              <CodeSpinner size={16} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="mb-2 flex items-center justify-center gap-3 sm:justify-start">
            <span
              className="grid h-11 w-11 place-items-center rounded-xl font-mono text-2xl font-extrabold text-ink"
              style={{ background: accent }}
            >
              {result.grade}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/40">
              {result.language}
            </span>
          </div>
          <h2 className="text-2xl font-bold leading-tight text-white">{result.headline}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{result.verdict}</p>
        </div>
      </div>
    </div>
  );
}
