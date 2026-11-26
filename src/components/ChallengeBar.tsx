import { useEffect, useRef, useState } from "react";
import type { Language, RoastResult } from "../lib/roast";
import { badgeFileName, badgeMarkdown, badgeSvg } from "../lib/badge";
import { MAX_LINK_CODE, buildRoastUrl, challengeText } from "../lib/permalink";

interface Props {
  result: RoastResult;
  code: string;
  language: Language | "auto";
  baseUrl: string;
}

export default function ChallengeBar({ result, code, language, baseUrl }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  const flash = (message: string) => {
    setNote(message);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2400);
  };

  // Compressing on every keystroke would be wasteful, so the URL is built only
  // when the button is pressed. The length check is cheap enough to run always.
  const linkable = code.trim().length > 0 && code.length <= MAX_LINK_CODE;

  const copyChallenge = async () => {
    const url = buildRoastUrl(baseUrl, code, language);
    if (!url) {
      flash("This snippet is too long to fit in a link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(challengeText(result, url));
      flash("Challenge link copied — paste it anywhere ✓");
    } catch {
      flash("Couldn't reach the clipboard.");
    }
  };

  const downloadBadge = () => {
    const blob = new Blob([badgeSvg(result)], { type: "image/svg+xml;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = badgeFileName(result);
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
    flash("Badge downloaded — drop it in your README ✓");
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(badgeMarkdown(result));
      flash("Badge markdown copied ✓");
    } catch {
      flash("Couldn't reach the clipboard.");
    }
  };

  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/40 p-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyChallenge()}
          disabled={!linkable}
          className="flex-1 rounded-lg border border-flame/40 bg-flame/10 px-4 py-2.5 text-xs font-semibold text-flame transition hover:bg-flame/20 disabled:cursor-not-allowed disabled:border-ink-line disabled:bg-ink-soft disabled:text-white/25"
        >
          Copy challenge link
        </button>
        <button
          type="button"
          onClick={downloadBadge}
          className="flex-1 rounded-lg border border-ink-line bg-ink-soft px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Download badge
        </button>
        <button
          type="button"
          onClick={() => void copyMarkdown()}
          className="flex-1 rounded-lg border border-ink-line bg-ink-soft px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Copy badge markdown
        </button>
      </div>

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/25">
        {note ??
          (linkable
            ? "The challenge link carries your code in the URL hash — it never touches a server."
            : "This snippet is too long to fit in a link. Trim it to share a challenge.")}
      </p>
    </div>
  );
}
