import { useRef, useState } from "react";
import type { RoastResult } from "../lib/roast";
import { buildReport, reportFileName, type ReportFormat } from "../lib/report";

interface Props {
  result: RoastResult;
  baseUrl: string;
}

export default function ExportBar({ result, baseUrl }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<number | null>(null);

  const flash = (message: string) => {
    setNote(message);
    if (noteTimer.current !== null) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 2400);
  };

  const download = (format: ReportFormat) => {
    const text = buildReport(result, format, baseUrl);
    const type = format === "json" ? "application/json" : "text/markdown";
    const blob = new Blob([text], { type: `${type};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = reportFileName(result, format);
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    flash(`${format === "json" ? "JSON" : "Markdown"} report downloaded ✓`);
  };

  const copy = async (format: ReportFormat) => {
    try {
      await navigator.clipboard.writeText(buildReport(result, format, baseUrl));
      flash(`${format === "json" ? "JSON" : "Markdown"} copied ✓`);
    } catch {
      flash("Clipboard blocked — use the download button.");
    }
  };

  return (
    <section className="rounded-2xl border border-ink-line bg-ink-soft/60 p-4">
      <h2 className="mb-2.5 font-mono text-[10px] font-bold tracking-[0.2em] text-white/40">
        EXPORT REPORT
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => download("markdown")}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/35 hover:text-white"
        >
          Download .md
        </button>
        <button
          type="button"
          onClick={() => download("json")}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/35 hover:text-white"
        >
          Download .json
        </button>
        <button
          type="button"
          onClick={() => void copy("markdown")}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[12px] text-white/70 transition hover:border-white/35 hover:text-white"
        >
          Copy markdown
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/25">
        {note ?? "A full report with every finding, its category, and the fix — ready for a PR or a ticket."}
      </p>
    </section>
  );
}
