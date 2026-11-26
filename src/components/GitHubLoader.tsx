import { useState } from "react";
import {
  GitHubFetchError,
  fetchGitHubFile,
  parseGitHubUrl,
  type FetchedFile,
} from "../lib/github";

interface Props {
  onLoad: (file: FetchedFile) => void;
}

export default function GitHubLoader({ onLoad }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    const target = parseGitHubUrl(value);
    if (!target) {
      setError("Paste a github.com file link, or owner/repo/path/to/file.ts");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const file = await fetchGitHubFile(target);
      onLoad(file);
      setValue("");
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof GitHubFetchError
          ? err.message
          : "Something went wrong fetching that file.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 font-mono text-xs text-white/60 transition hover:border-flame/40 hover:text-white"
      >
        Roast a repo file
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-ink-line bg-ink-soft/70 p-3">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="https://github.com/owner/repo/blob/main/src/app.ts"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-ink-line bg-ink px-3 py-1.5 font-mono text-xs text-white/80 outline-none placeholder:text-white/20 focus:border-flame/50"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !value.trim()}
          className="shrink-0 rounded-lg bg-flame px-3 py-1.5 font-mono text-xs font-bold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25"
        >
          {busy ? "Fetching…" : "Fetch"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="shrink-0 rounded-lg border border-ink-line px-2.5 py-1.5 font-mono text-xs text-white/40 transition hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <p className="mt-2 font-mono text-[10px] leading-relaxed text-white/30">
        {error ? (
          <span className="text-flame-hot">{error}</span>
        ) : (
          "Public files only. Fetched straight from GitHub to your browser — no token, no proxy."
        )}
      </p>
    </div>
  );
}
