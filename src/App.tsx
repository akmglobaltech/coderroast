import { useCallback, useMemo, useRef, useState } from "react";
import FindingsList from "./components/FindingsList";
import ScoreCard from "./components/ScoreCard";
import StatsPanel from "./components/StatsPanel";
import { analyze, shareText, type Language, type RoastResult } from "./lib/roast";
import { renderShareCard } from "./lib/share";

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

const SAMPLE = `var API_KEY = "sk_live_9f2b7c41aa8e4d3f";
var users = [];

function getUser(id) {
  var q = "SELECT * FROM users WHERE id = " + id;
  var res = db.query(q);
  if (res == null) {
    try {
      return JSON.parse(eval("(" + res + ")"));
    } catch (e) {}
  }
  for (var i = 0; i < res.length; i++) {
    for (var j = 0; j < res[i].items.length; j++) {
      for (var k = 0; k < res[i].items[j].tags.length; k++) {
        if (res[i].items[j].tags[k] == "vip") {
          if (res[i].items[j].price > 100) {
            if (res[i].items[j].stock != 0) {
              users.push(res[i].items[j]);
            }
          }
        }
      }
    }
  }
  document.getElementById("out").innerHTML = res;
  console.log("got users", users);
  console.log("count", users.length);
  console.log("done");
  console.log("really done");
  // return users;
  // users = [];
  return users;
}

function getUserAgain(id) {
  var q = "SELECT * FROM users WHERE id = " + id;
  var res = db.query(q);
  return res;
}

// TODO: fix this before launch
// FIXME: actually fix it
`;

export default function App() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState<Language | "auto">("auto");
  const [result, setResult] = useState<RoastResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const charCount = code.length;
  const lineCount = useMemo(() => (code ? code.split("\n").length : 0), [code]);

  const roast = useCallback(() => {
    if (!code.trim()) return;
    setBusy(true);
    // A short beat so the score animation reads as a reveal, not a flicker.
    window.setTimeout(() => {
      const next = analyze(code, language === "auto" ? undefined : language);
      setResult(next);
      setBusy(false);
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }, 260);
  }, [code, language]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      roast();
    }
  };

  const download = async () => {
    if (!result) return;
    const blob = await renderShareCard(result);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coderroast-${result.score}-${result.grade}.png`;
    a.click();
    // Revoking synchronously can cancel the download in Firefox/Safari.
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(shareText(result, window.location.origin));
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
              onClick={() => setCode(SAMPLE)}
              className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 font-mono text-xs text-white/60 transition hover:border-flame/40 hover:text-white"
            >
              Load sample
            </button>

            <button
              type="button"
              onClick={() => {
                setCode("");
                setResult(null);
              }}
              className="rounded-lg border border-ink-line bg-ink-soft px-3 py-1.5 font-mono text-xs text-white/60 transition hover:border-flame/40 hover:text-white"
            >
              Clear
            </button>

            <span className="ml-auto font-mono text-[11px] text-white/30">
              {lineCount} lines · {charCount.toLocaleString()} chars
            </span>
          </div>

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder={"// paste your code here\n// then hit Roast it (or Ctrl/Cmd + Enter)"}
            className="scroll-thin h-[420px] w-full resize-y rounded-xl border border-ink-line bg-ink-soft/70 p-4 font-mono text-[13px] leading-relaxed text-white/85 outline-none transition placeholder:text-white/20 focus:border-flame/50 lg:h-[520px]"
          />

          <button
            type="button"
            onClick={roast}
            disabled={!code.trim() || busy}
            className={`mt-3 w-full rounded-xl px-6 py-3.5 text-sm font-bold tracking-wide transition ${
              !code.trim() || busy
                ? "cursor-not-allowed bg-white/5 text-white/25"
                : "animate-pulse-ring bg-gradient-to-r from-flame to-flame-hot text-ink hover:brightness-110"
            }`}
          >
            {busy ? "Roasting…" : "Roast it 🔥"}
          </button>
          <p className="mt-2 text-center font-mono text-[10px] text-white/25">
            Ctrl / Cmd + Enter
          </p>
        </section>

        {/* results */}
        <section ref={resultsRef} className="flex flex-col gap-4">
          {!result && (
            <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-ink-line bg-ink-soft/30 p-10 text-center">
              <div>
                <div className="mb-3 text-4xl opacity-40">🍳</div>
                <p className="text-sm font-medium text-white/45">No roast yet.</p>
                <p className="mt-1 text-xs text-white/25">
                  Paste code on the left and press Roast it.
                </p>
              </div>
            </div>
          )}

          {result && !result.empty && (
            <>
              <ScoreCard result={result} />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={download}
                  className="flex-1 rounded-lg border border-flame/40 bg-flame/10 px-4 py-2.5 text-xs font-semibold text-flame transition hover:bg-flame/20"
                >
                  Download share card
                </button>
                <button
                  type="button"
                  onClick={copy}
                  className="flex-1 rounded-lg border border-ink-line bg-ink-soft px-4 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
                >
                  {copied ? "Copied ✓" : "Copy result"}
                </button>
              </div>

              <StatsPanel stats={result.stats} />

              <div>
                <h2 className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">
                  Crimes
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-white/50">
                    {result.findings.length}
                  </span>
                </h2>
                <div className="scroll-thin max-h-[520px] overflow-y-auto pr-1">
                  <FindingsList findings={result.findings} />
                </div>
              </div>
            </>
          )}

          {result?.empty && (
            <div className="rounded-2xl border border-ink-line bg-ink-soft/50 p-6 text-center text-sm text-white/45">
              {result.verdict}
            </div>
          )}
        </section>
      </div>

      <footer className="mt-12 border-t border-ink-line pt-5 text-center font-mono text-[11px] text-white/25">
        CodeRoast · 100% client-side · no accounts, no uploads, no telemetry
      </footer>
    </div>
  );
}
