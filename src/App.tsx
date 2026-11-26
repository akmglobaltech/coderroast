import { useEffect, useMemo, useRef, useState } from "react";
import { AnalyzingBadge, CodeSpinner, LiveBadge, ScanBar } from "./components/Analyzing";
import CategoryPanel from "./components/CategoryPanel";
import ChallengeBar from "./components/ChallengeBar";
import ExportBar from "./components/ExportBar";
import FindingsList from "./components/FindingsList";
import GitHubLoader from "./components/GitHubLoader";
import HistoryPanel from "./components/HistoryPanel";
import ScoreCard from "./components/ScoreCard";
import ShareBar from "./components/ShareBar";
import StatsPanel from "./components/StatsPanel";
import {
  appendEntry,
  clearHistory,
  loadHistory,
  saveHistory,
  summarize,
  type HistoryEntry,
} from "./lib/history";
import { readRoastHash } from "./lib/permalink";
import { normalizeCode, shareText, type Category, type Language } from "./lib/roast";
import { SAMPLES } from "./lib/samples";
import { useLiveRoast } from "./lib/useLiveRoast";

const LANGUAGES: Array<{ value: Language | "auto"; label: string }> = [
  { value: "auto", label: "Auto-detect" },
  { value: "typescript", label: "TypeScript" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "sql", label: "SQL" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
];

// The app is served from a subpath on GitHub Pages, so `origin` alone would
// produce a link that 404s. Keep the trailing slash off for a clean share line.
function appUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, "");
}

export default function App() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language | "auto">("auto");
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<Category | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const resultsRef = useRef<HTMLDivElement>(null);

  // A shared challenge arrives in the hash, so it is never sent to a server.
  // Hydrate once on mount, then again if the hash changes (back/forward).
  useEffect(() => {
    const hydrate = () => {
      const link = readRoastHash(window.location.hash);
      if (!link) return;
      setCode(link.code);
      setLanguage(link.language);
    };
    hydrate();
    window.addEventListener("hashchange", hydrate);
    return () => window.removeEventListener("hashchange", hydrate);
  }, []);

  // Once the visitor edits a hydrated challenge, the hash no longer describes
  // what is on screen — drop it so a reload does not resurrect the old code.
  const editCode = (next: string) => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setFilter(null);
    setCode(next);
  };

  const { result, pending, flush } = useLiveRoast(code, language);

  // Record a settled roast. `appendEntry` ignores repeats, so typing does not
  // flood the list with forty identical rows.
  useEffect(() => {
    if (pending || !result || result.empty) return;
    setHistory((prev) => {
      const next = appendEntry(prev, result, code, Date.now());
      if (next === prev) return prev;
      saveHistory(next);
      return next;
    });
  }, [result, pending, code]);

  const historySummary = useMemo(() => summarize(history), [history]);

  const onClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const charCount = code.length;
  const lineCount = useMemo(
    () => (code.trim() ? normalizeCode(code).split("\n").length : 0),
    [code],
  );

  const reveal = () => {
    flush();
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      reveal();
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(shareText(result, appUrl()));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🔥</span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Code<span className="text-flame">Roast</span>
          </h1>
          <span className="ml-1 rounded-full border border-flame/30 bg-flame/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-flame">
            beta
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
          Paste your code. Get a score out of 100, a letter grade, and every crime it commits.
          Runs entirely in your browser — nothing is uploaded, nothing is stored.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* editor */}
        <section className="flex flex-col">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language | "auto")}
              className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 font-mono text-xs text-white/70 outline-none focus:border-flame/50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => editCode(SAMPLES[language])}
              title={`Load a deliberately bad ${language === "auto" ? "JavaScript" : LANGUAGES.find((l) => l.value === language)?.label} sample`}
              className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 font-mono text-xs text-white/60 transition hover:border-flame/40 hover:text-white"
            >
              Load sample
            </button>

            <button
              type="button"
              onClick={() => {
                editCode("");
              }}
              className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 font-mono text-xs text-white/60 transition hover:border-flame/40 hover:text-white"
            >
              Clear
            </button>

            <GitHubLoader
              onLoad={(file) => {
                editCode(file.code);
                if (file.language) setLanguage(file.language as Language);
              }}
            />

            <span className="ml-auto flex items-center gap-2 font-mono text-[11px] text-white/30">
              {code.trim() && (pending ? <AnalyzingBadge /> : <LiveBadge />)}
              {lineCount} lines · {charCount.toLocaleString()} chars
            </span>
          </div>

          <div className="relative">
            <textarea
              value={code}
              onChange={(e) => editCode(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              placeholder={"// paste your code here\n// the score updates as you type"}
              className="scroll-thin h-[420px] w-full resize-y rounded-xl border border-ink-line bg-ink-soft/70 p-4 font-mono text-[13px] leading-relaxed text-white/85 outline-none transition placeholder:text-white/20 focus:border-flame/50 lg:h-[520px]"
            />
            {pending && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-3">
                <ScanBar />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={reveal}
            disabled={!code.trim()}
            className={`mt-3 w-full rounded-xl px-6 py-3.5 text-sm font-bold tracking-wide transition ${
              !code.trim()
                ? "cursor-not-allowed bg-white/5 text-white/25"
                : "animate-pulse-ring bg-gradient-to-r from-flame to-flame-hot text-ink hover:brightness-110"
            }`}
          >
            Roast it 🔥
          </button>
          <p className="mt-2 text-center font-mono text-[10px] text-white/25">
            Live analysis · Ctrl / Cmd + Enter to jump to results
          </p>
        </section>

        {/* results */}
        <section ref={resultsRef} className="flex flex-col gap-4">
          {!result && (
            <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-ink-line bg-ink-soft/30 p-10 text-center">
              {pending ? (
                <div className="flex flex-col items-center">
                  <CodeSpinner size={72} ring />
                  <p className="mt-5 font-mono text-sm font-semibold text-flame/90">
                    Analyzing<span className="animate-dot inline-block">…</span>
                  </p>
                  <p className="mt-1 text-xs text-white/30">
                    Reading your code, counting the crimes.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 text-4xl opacity-40">🍳</div>
                  <p className="text-sm font-medium text-white/45">No roast yet.</p>
                  <p className="mt-1 text-xs text-white/25">
                    Paste code on the left — the score appears as you type.
                  </p>
                </div>
              )}
            </div>
          )}

          {result && !result.empty && (
            <>
              <ScoreCard result={result} pending={pending} />

              <ShareBar
                result={result}
                url={appUrl()}
                onCopyText={copy}
                copied={copied}
              />

              <ChallengeBar
                result={result}
                code={code}
                language={language}
                baseUrl={appUrl()}
              />

              <StatsPanel stats={result.stats} />

              <CategoryPanel
                categories={result.categories}
                active={filter}
                onSelect={setFilter}
              />

              <div>
                <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">
                  Crimes
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/50">
                    {filter
                      ? `${result.findings.filter((f) => f.category === filter).length}/${result.findings.length}`
                      : result.findings.length}
                  </span>
                  {result.recoverable > 0 && (
                    <span className="ml-auto normal-case tracking-normal text-white/25">
                      {result.recoverable} pts recoverable
                    </span>
                  )}
                </h2>
                <div className="scroll-thin max-h-[520px] overflow-y-auto pr-1">
                  <FindingsList findings={result.findings} filter={filter} />
                </div>
              </div>

              <ExportBar result={result} baseUrl={appUrl()} />
            </>
          )}

          {result?.empty && (
            <div className="rounded-2xl border border-ink-line bg-ink-soft/50 p-6 text-center text-sm text-white/45">
              {result.verdict}
            </div>
          )}

          <HistoryPanel entries={history} summary={historySummary} onClear={onClearHistory} />
        </section>
      </div>

      <footer className="mt-12 border-t border-ink-line pt-5 text-center font-mono text-[11px] text-white/25">
        CodeRoast · 100% client-side · no accounts, no uploads, no telemetry
      </footer>
    </div>
  );
}
