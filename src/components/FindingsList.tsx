import { SEVERITY_LABEL, type Finding, type Severity } from "../lib/roast";

const SEVERITY_STYLE: Record<Severity, { dot: string; text: string; ring: string }> = {
  critical: { dot: "bg-[#ff2d55]", text: "text-[#ff6b8a]", ring: "border-[#ff2d55]/35" },
  high: { dot: "bg-[#ff6b35]", text: "text-[#ff9a6b]", ring: "border-[#ff6b35]/30" },
  medium: { dot: "bg-[#facc15]", text: "text-[#f5d76e]", ring: "border-[#facc15]/25" },
  low: { dot: "bg-[#60a5fa]", text: "text-[#93c5fd]", ring: "border-[#60a5fa]/25" },
  nit: { dot: "bg-white/35", text: "text-white/50", ring: "border-white/10" },
};

interface Props {
  findings: Finding[];
}

export default function FindingsList({ findings }: Props) {
  if (findings.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-300">Nothing to roast.</p>
        <p className="mt-1 text-sm text-white/50">
          Either this code is genuinely clean, or it is too short to embarrass itself.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {findings.map((f, i) => {
        const style = SEVERITY_STYLE[f.severity];
        return (
          <li
            key={`${f.id}-${i}`}
            className={`animate-rise rounded-xl border ${style.ring} bg-ink-soft/70 p-4`}
            style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className={`font-mono text-[10px] font-bold tracking-[0.15em] ${style.text}`}>
                    {SEVERITY_LABEL[f.severity]}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  {f.line !== undefined && (
                    <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-white/40">
                      L{f.line}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[10px] text-white/25">-{f.penalty}</span>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/55">{f.detail}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
