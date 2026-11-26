import { useEffect, useRef, useState } from "react";
import type { RoastResult } from "../lib/roast";
import { shareText } from "../lib/roast";
import {
  canCopyImage,
  canShareFiles,
  cardFileName,
  copyCardImage,
  downloadCard,
  renderShareCard,
  shareCard,
} from "../lib/share";
import { SHARE_TARGETS } from "../lib/shareTargets";

interface Props {
  result: RoastResult;
  url: string;
  onCopyText: () => void;
  copied: boolean;
}

interface Card {
  blob: Blob;
  name: string;
}

export default function ShareBar({ result, url, onCopyText, copied }: Props) {
  const [card, setCard] = useState<Card | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | undefined>(undefined);

  // Pre-render the PNG so the click handler can call navigator.share while the
  // user gesture is still active — awaiting a canvas encode first loses it.
  useEffect(() => {
    let cancelled = false;
    const name = cardFileName(result);
    const timer = window.setTimeout(() => {
      renderShareCard(result)
        .then((blob) => {
          if (!cancelled) setCard({ blob, name });
        })
        .catch(() => {
          if (!cancelled) setCard(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [result]);

  useEffect(() => () => window.clearTimeout(noteTimer.current), []);

  const flash = (message: string) => {
    setNote(message);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2400);
  };

  const text = shareText(result, url);
  const shareable = card !== null && canShareFiles(card.blob, card.name);
  const copyable = card !== null && canCopyImage();

  const onShare = async () => {
    if (!card) return;
    const outcome = await shareCard(card.blob, card.name, text, url);
    if (outcome === "unsupported") {
      downloadCard(card.blob, card.name);
      flash("Share sheet unavailable — card downloaded instead.");
    } else if (outcome === "shared") {
      flash("Shared ✓");
    }
  };

  const onCopyImage = async () => {
    if (!card) return;
    const ok = await copyCardImage(card.blob);
    flash(ok ? "Image copied — paste it anywhere ✓" : "Couldn't copy the image.");
  };

  const onDownload = () => {
    if (!card) return;
    downloadCard(card.blob, card.name);
    flash("Card downloaded ✓");
  };

  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/40 p-3">
      <div className="flex flex-wrap gap-2">
        {shareable && (
          <button
            type="button"
            onClick={onShare}
            className="flex-1 rounded-lg border border-flame/40 bg-flame/10 px-4 py-2.5 text-xs font-semibold text-flame transition hover:bg-flame/20"
          >
            Share card
          </button>
        )}
        {copyable && (
          <button
            type="button"
            onClick={onCopyImage}
            className="flex-1 rounded-lg border border-ink-line bg-ink-soft px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
          >
            Copy image
          </button>
        )}
        <button
          type="button"
          onClick={onDownload}
          disabled={!card}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-xs font-semibold transition ${
            shareable || copyable
              ? "border-ink-line bg-ink-soft text-white/70 hover:border-white/25 hover:text-white"
              : "border-flame/40 bg-flame/10 text-flame hover:bg-flame/20"
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          Download PNG
        </button>
        <button
          type="button"
          onClick={onCopyText}
          className="flex-1 rounded-lg border border-ink-line bg-ink-soft px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
        >
          {copied ? "Copied ✓" : "Copy result"}
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/25">
          Post to
        </span>
        {SHARE_TARGETS.map((t) => (
          <a
            key={t.id}
            href={t.href(text, url)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-ink-line bg-ink-soft px-2 py-1 font-mono text-[10px] text-white/55 transition hover:border-flame/40 hover:text-white"
          >
            {t.label}
          </a>
        ))}
      </div>

      <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/25">
        {note ??
          (shareable
            ? "Share card opens your device's share sheet with the image attached."
            : copyable
              ? "Copy image puts the card on your clipboard — paste it into any post."
              : "Post to a platform shares the link — the card image travels with the download.")}
      </p>
    </div>
  );
}
