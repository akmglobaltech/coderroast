import type { Stats } from "../lib/roast";

interface Props {
  stats: Stats;
}

export default function StatsPanel({ stats }: Props) {
  const items: Array<{ label: string; value: string | number; warn?: boolean }> = [
    { label: "Lines", value: stats.lines },
    { label: "Code", value: stats.codeLines },
    { label: "Comments", value: stats.commentLines, warn: stats.commentLines === 0 },
    { label: "Blank", value: stats.blankLines },
    { label: "Max depth", value: stats.maxNesting, warn: stats.maxNesting >= 5 },
    { label: "Longest fn", value: stats.longestFunction, warn: stats.longestFunction > 60 },
    { label: "Branches", value: stats.decisionPoints, warn: stats.decisionPoints > 25 },
    { label: "Dupes", value: stats.duplicateLines, warn: stats.duplicateLines > 5 },
    { label: "Longest line", value: stats.longestLine, warn: stats.longestLine > 160 },
    { label: "Avg line", value: stats.avgLineLength },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-ink-line bg-ink-soft/60 px-3 py-2.5"
        >
          <div className="font-mono text-[10px] uppercase tracking-wider text-white/35">
            {item.label}
          </div>
          <div
            className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
              item.warn ? "text-[#ff9a6b]" : "text-white/85"
            }`}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
