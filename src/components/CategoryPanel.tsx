import type { Category, CategoryScore } from "../lib/roast";

const CATEGORY_ICON: Record<Category, string> = {
  security: "🔒",
  correctness: "🎯",
  performance: "⚡",
  maintainability: "🧱",
  accessibility: "♿",
  style: "🎨",
};

function barColor(score: number): string {
  if (score >= 90) return "bg-[#22d3a7]";
  if (score >= 75) return "bg-[#a3e635]";
  if (score >= 55) return "bg-[#facc15]";
  if (score >= 35) return "bg-[#fb923c]";
  return "bg-[#ff2d55]";
}

interface Props {
  categories: CategoryScore[];
  active: Category | null;
  onSelect: (category: Category | null) => void;
}

export default function CategoryPanel({ categories, active, onSelect }: Props) {
  const scored = categories.filter((c) => c.count > 0);
  if (scored.length === 0) return null;

  return (
    <section className="rounded-2xl border border-ink-line bg-ink-soft/60 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[10px] font-bold tracking-[0.2em] text-white/40">
          BY CATEGORY
        </h2>
        {active && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="rounded-full border border-white/15 px-2.5 py-0.5 font-mono text-[10px] text-white/50 transition hover:border-white/30 hover:text-white/80"
          >
            clear filter ✕
          </button>
        )}
      </div>

      <ul className="space-y-1.5">
        {scored.map((c) => {
          const isActive = active === c.category;
          return (
            <li key={c.category}>
              <button
                type="button"
                onClick={() => onSelect(isActive ? null : c.category)}
                aria-pressed={isActive}
                className={`group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
                  isActive ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                }`}
              >
                <span aria-hidden className="w-4 shrink-0 text-center text-[11px]">
                  {CATEGORY_ICON[c.category]}
                </span>
                <span
                  className={`w-[104px] shrink-0 truncate text-[12px] ${
                    isActive ? "text-white" : "text-white/65"
                  }`}
                >
                  {c.label}
                </span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                  <span
                    className={`block h-full rounded-full transition-[width] duration-500 ${barColor(c.score)}`}
                    style={{ width: `${Math.max(2, c.score)}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-white/45">
                  {c.score}
                </span>
                <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums text-white/25">
                  ×{c.count}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
