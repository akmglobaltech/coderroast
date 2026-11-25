/**
 * CodeRoast — a dependency-free, client-side code review engine.
 *
 * Everything here is pure and synchronous so it can run in the browser,
 * in a worker, or in a test without any setup.
 */

export type Severity = "critical" | "high" | "medium" | "low" | "nit";

export type Language =
  | "typescript"
  | "javascript"
  | "python"
  | "java"
  | "csharp"
  | "go"
  | "rust"
  | "php"
  | "ruby"
  | "sql"
  | "html"
  | "css"
  | "unknown";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  line?: number;
  penalty: number;
}

export interface Stats {
  lines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  longestLine: number;
  avgLineLength: number;
  maxNesting: number;
  longestFunction: number;
  duplicateLines: number;
  decisionPoints: number;
}

export interface RoastResult {
  score: number;
  grade: string;
  headline: string;
  verdict: string;
  findings: Finding[];
  stats: Stats;
  language: Language;
  empty: boolean;
}

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "nit"];

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  nit: "NIT",
};

/**
 * Per-band penalty ceilings. Without these a single noisy rule could drag a
 * score to zero and every roast would look identical.
 */
const SEVERITY_CAP: Record<Severity, number> = {
  critical: 60,
  high: 40,
  medium: 24,
  low: 12,
  nit: 6,
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** Blank out string literals and trailing comments so brace counting is sane. */
function stripNoise(line: string): string {
  return line
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/\/\/.*$/, "")
    .replace(/#.*$/, "");
}

/** Blanks out string literals across the whole snippet, so keywords quoted
 *  inside a string (e.g. a SQL query in a JS file) don't skew detection. */
function stripStrings(code: string): string {
  return code
    .replace(/`(?:\\[\s\S]|[^`\\])*`/g, "``")
    .replace(/"(?:\\[\s\S]|[^"\\])*"/g, '""')
    .replace(/'(?:\\[\s\S]|[^'\\])*'/g, "''");
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function isComment(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith("//") ||
    t.startsWith("/*") ||
    t.startsWith("*") ||
    t.startsWith("#") ||
    t.startsWith("--") ||
    t.startsWith("<!--")
  );
}

function countMatches(code: string, re: RegExp): number {
  const m = code.match(re);
  return m ? m.length : 0;
}

function firstLineOf(code: string, re: RegExp): number | undefined {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/* language detection                                                  */
/* ------------------------------------------------------------------ */

export function detectLanguage(code: string, hint?: Language): Language {
  if (hint && hint !== "unknown") return hint;

  // Keywords inside string literals are not evidence of a language.
  const src = stripStrings(code);

  const score: Record<string, number> = {};
  const bump = (lang: string, n: number) => {
    score[lang] = (score[lang] ?? 0) + n;
  };

  // TypeScript markers. TS is a superset of JS, so these are handled specially
  // below: if any fire alongside JS signals, TypeScript wins.
  const tsMarkers = [
    /\binterface\s+\w+\s*(<[^>]*>)?\s*\{/, // interface Foo {
    /:\s*(string|number|boolean|any|void|unknown|never|object)\b/, // type annotation
    /\btype\s+\w+\s*=/, // type alias
    /\bas\s+(const|string|number|boolean|unknown|any)\b/, // assertion
    /\breadonly\s+\w+/, // readonly modifier
    /\benum\s+\w+\s*\{/, // enum
    /\bimplements\s+\w+/, // implements clause
    /\?\s*:\s*\w+/, // optional property
    /<\w+(\s*,\s*\w+)*>\s*\(/, // generic call
    /\bdeclare\s+(const|let|var|function|module)\b/,
  ];
  const tsHits = tsMarkers.filter((re) => re.test(src)).length;
  if (tsHits > 0) bump("typescript", tsHits * 3);

  if (/\bimport\s+.*\bfrom\s+['"]/.test(src)) bump("javascript", 2);
  if (/\bdef\s+\w+\s*\(/.test(src) || /^\s*from\s+\w+\s+import\s/m.test(src)) bump("python", 4);
  if (/\bpublic\s+(static\s+)?(void|class)\b/.test(src) || /\bSystem\.out\.println/.test(src)) {
    bump("java", 4);
  }
  if (/\busing\s+System\b/.test(src) || /\bConsole\.WriteLine/.test(src)) bump("csharp", 4);
  if (/\bfunc\s+\w+\s*\(/.test(src) || /\bpackage\s+main\b/.test(src)) bump("go", 4);
  if (/\bfn\s+\w+\s*\(/.test(src) || /\blet\s+mut\b/.test(src)) bump("rust", 4);
  if (/<\?php/.test(src) || /\$\w+\s*=(?!=)/.test(src)) bump("php", 3);
  if (/\bputs\s+/.test(src) || /^\s*end\s*$/m.test(src)) bump("ruby", 2);
  if (/<(!doctype|html|div|span|body)\b/i.test(src)) bump("html", 4);
  if (/[.#][\w-]+\s*\{[^}]*:[^}]*;/.test(src)) bump("css", 3);

  // JS-family signals are the common case, so they get enough weight to beat a
  // stray SQL/HTML keyword that leaked in from a template or a comment.
  if (/\b(const|let|var)\s+\w+\s*=/.test(src)) bump("javascript", 3);
  if (/\bfunction\s*\w*\s*\(/.test(src) || /=>/.test(src)) bump("javascript", 3);
  if (/\bconsole\.\w+\s*\(/.test(src)) bump("javascript", 2);
  if (/\bdocument\.\w+/.test(src) || /\bwindow\.\w+/.test(src)) bump("javascript", 2);
  if (/\brequire\s*\(/.test(src) || /\bmodule\.exports\b/.test(src)) bump("javascript", 2);

  // A bare SQL statement is only SQL when it isn't wrapped in code punctuation.
  if (/^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE)\b/i.test(src)) {
    bump("sql", 6);
  } else if (/\bSELECT\b[\s\S]*\bFROM\b/i.test(src)) {
    bump("sql", 2);
  }

  let best: Language = "unknown";
  let bestScore = 0;
  for (const [lang, n] of Object.entries(score)) {
    if (n > bestScore) {
      bestScore = n;
      best = lang as Language;
    }
  }

  // TypeScript is a superset of JavaScript: valid TS is also valid JS, so when
  // TS syntax is present it is the more specific (and correct) answer.
  if (best === "javascript" && (score.typescript ?? 0) > 0) return "typescript";

  return best;
}

/* ------------------------------------------------------------------ */
/* metrics                                                             */
/* ------------------------------------------------------------------ */

export function computeStats(code: string): Stats {
  const lines = code.split("\n");
  const nonEmpty = lines.filter((l) => !isBlank(l));
  const commentLines = lines.filter((l) => !isBlank(l) && isComment(l)).length;
  const blankLines = lines.length - nonEmpty.length;

  let maxNesting = 0;
  let depth = 0;
  for (const raw of lines) {
    for (const ch of stripNoise(raw)) {
      if (ch === "{" || ch === "(" || ch === "[") depth++;
      else if (ch === "}" || ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    }
    maxNesting = Math.max(maxNesting, depth);
  }

  const longestLine = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const avgLineLength = nonEmpty.length
    ? Math.round(nonEmpty.reduce((a, l) => a + l.length, 0) / nonEmpty.length)
    : 0;

  const seen = new Map<string, number>();
  for (const l of nonEmpty) {
    const t = l.trim();
    if (t.length < 12) continue;
    if (/^[{}()[\];,]+$/.test(t)) continue;
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  const duplicateLines = [...seen.values()].filter((n) => n > 1).reduce((a, n) => a + n - 1, 0);

  const decisionPoints = countMatches(
    code,
    /\b(if|else\s+if|for|while|case|catch)\b|&&|\|\||\?\?/g,
  );

  return {
    lines: lines.length,
    codeLines: nonEmpty.length - commentLines,
    blankLines,
    commentLines,
    longestLine,
    avgLineLength,
    maxNesting,
    longestFunction: longestFunctionLength(lines),
    duplicateLines,
    decisionPoints,
  };
}

function longestFunctionLength(lines: string[]): number {
  let longest = 0;
  for (let i = 0; i < lines.length; i++) {
    const startsFn = /\bfunction\b|\bfunc\b|\bdef\b|=>\s*\{/.test(stripNoise(lines[i]));
    if (!startsFn) continue;

    let depth = 0;
    let opened = false;
    let length = 0;
    for (let j = i; j < lines.length; j++) {
      for (const ch of stripNoise(lines[j])) {
        if (ch === "{") {
          depth++;
          opened = true;
        } else if (ch === "}") {
          depth--;
        }
      }
      length = j - i + 1;
      if (opened && depth <= 0) break;
      if (!opened && j - i > 3) break;
    }
    if (opened) longest = Math.max(longest, length);
  }
  return longest;
}

/* ------------------------------------------------------------------ */
/* rules                                                               */
/* ------------------------------------------------------------------ */

interface RuleHit {
  title: string;
  detail: string;
  line?: number;
}

interface Rule {
  id: string;
  severity: Severity;
  penalty: number;
  run: (code: string, stats: Stats, lang: Language) => RuleHit[];
}

function hit(title: string, detail: string, line?: number): RuleHit {
  return { title, detail, line };
}

const RULES: Rule[] = [
  {
    id: "eval",
    severity: "critical",
    penalty: 22,
    run: (code) => {
      const re = /\beval\s*\(|\bnew\s+Function\s*\(/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "eval() / new Function()",
          `${n} dynamic code execution site(s). This is remote code execution waiting for a bad input.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "secret",
    severity: "critical",
    penalty: 20,
    run: (code) => {
      const re =
        /(api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[:=]\s*['"][^'"]{6,}['"]/i;
      if (!re.test(code)) return [];
      return [
        hit(
          "Hardcoded credential",
          "A secret is sitting in the source. Rotate it, move it to an env var, and never commit it again.",
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "sql-injection",
    severity: "critical",
    penalty: 18,
    run: (code) => {
      const re = /(SELECT|INSERT|UPDATE|DELETE)[^;]*(\+\s*\w+|\$\{)/i;
      if (!re.test(code)) return [];
      return [
        hit(
          "String-built SQL",
          "The query is assembled with concatenation or interpolation. Use parameterised queries.",
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "innerhtml",
    severity: "high",
    penalty: 14,
    run: (code) => {
      const re = /\.innerHTML\s*=|dangerouslySetInnerHTML|document\.write\s*\(/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Unsanitised HTML injection",
          `${n} place(s) write raw HTML into the DOM. That is an XSS bug with a bow on it.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "empty-catch",
    severity: "high",
    penalty: 12,
    run: (code) => {
      const re = /catch\s*(\([^)]*\))?\s*\{\s*\}/;
      if (!re.test(code)) return [];
      return [
        hit(
          "Empty catch block",
          "Errors are being swallowed whole. You will never find out why it broke.",
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "debugger",
    severity: "high",
    penalty: 10,
    run: (code) => {
      const re = /^\s*debugger\s*;?\s*$/m;
      if (!re.test(code)) return [];
      return [
        hit(
          "Leftover debugger statement",
          "This shipped. Every visitor with devtools open now gets a free pause.",
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "nesting",
    severity: "high",
    penalty: 10,
    run: (_code, stats) => {
      if (stats.maxNesting < 5) return [];
      return [
        hit(
          "Deep nesting",
          `Brace depth reaches ${stats.maxNesting}. Past four levels, extract a function and give it a name.`,
        ),
      ];
    },
  },
  {
    id: "long-function",
    severity: "medium",
    penalty: 8,
    run: (_code, stats) => {
      if (stats.longestFunction <= 60) return [];
      return [
        hit(
          "Marathon function",
          `One function spans ${stats.longestFunction} lines. It does at least four jobs and documents none of them.`,
        ),
      ];
    },
  },
  {
    id: "complexity",
    severity: "medium",
    penalty: 8,
    run: (_code, stats) => {
      if (stats.decisionPoints <= 25) return [];
      return [
        hit(
          "Branch soup",
          `${stats.decisionPoints} decision points. Nobody can hold this control flow in their head, including you.`,
        ),
      ];
    },
  },
  {
    id: "duplication",
    severity: "medium",
    penalty: 7,
    run: (_code, stats) => {
      if (stats.duplicateLines <= 5) return [];
      return [
        hit(
          "Copy-paste detected",
          `${stats.duplicateLines} duplicated line(s). The second copy is the one you will forget to fix.`,
        ),
      ];
    },
  },
  {
    id: "huge-file",
    severity: "medium",
    penalty: 6,
    run: (_code, stats) => {
      if (stats.lines <= 400) return [];
      return [
        hit(
          "God file",
          `${stats.lines} lines in one file. This is not a module, it is a landfill with an import statement.`,
        ),
      ];
    },
  },
  {
    id: "loose-equality",
    severity: "medium",
    penalty: 6,
    run: (code) => {
      const re = /[^=!<>]==[^=]|!=[^=]/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Loose equality",
          `${n} use(s) of == or !=. JavaScript will coerce something you did not expect and you will blame the framework.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "http",
    severity: "medium",
    penalty: 6,
    run: (code) => {
      const re = /http:\/\/(?!localhost|127\.0\.0\.1)/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Plaintext HTTP",
          `${n} insecure URL(s). Everything on that connection is readable by anyone on the wifi.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "var",
    severity: "medium",
    penalty: 5,
    run: (code) => {
      const re = /\bvar\s+\w+/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "var in the year of our lord",
          `${n} var declaration(s). const and let exist. They are free.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "any",
    severity: "medium",
    penalty: 5,
    run: (code) => {
      const re = /:\s*any\b|\bas\s+any\b/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "any everywhere",
          `${n} escape hatch(es) to any. You installed TypeScript and then turned it off.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "math-random",
    severity: "medium",
    penalty: 5,
    run: (code) => {
      const re = /Math\.random\s*\(/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Math.random() for something important",
          `${n} call(s). Math.random is not cryptographically secure. Use crypto.randomUUID().`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "console",
    severity: "low",
    penalty: 4,
    run: (code) => {
      const re = /\bconsole\.(log|debug|info)\s*\(/g;
      const n = countMatches(code, re);
      if (n <= 3) return [];
      return [
        hit(
          "console.log archaeology",
          `${n} log statements. Your production console is a diary now.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "commented-code",
    severity: "low",
    penalty: 4,
    run: (code) => {
      const lines = code.split("\n");
      let count = 0;
      let line: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t.startsWith("//")) continue;
        const body = t.slice(2).trim();
        if (/[;{}]$/.test(body) || /^\w+\s*\(.*\)\s*;?$/.test(body)) {
          count++;
          line ??= i + 1;
        }
      }
      if (count < 2) return [];
      return [
        hit(
          "Commented-out code",
          `${count} dead line(s) kept "just in case". That is what git is for.`,
          line,
        ),
      ];
    },
  },
  {
    id: "magic-numbers",
    severity: "low",
    penalty: 4,
    run: (code) => {
      const re = /(?<![\w.$])(?!0\b|1\b|-1\b)\d{2,}(?![\w.])/g;
      const n = countMatches(code, re);
      if (n <= 8) return [];
      return [
        hit(
          "Magic numbers",
          `${n} unexplained numeric literals. Name them or the next person will guess wrong.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "todo",
    severity: "low",
    penalty: 3,
    run: (code) => {
      const re = /\b(TODO|FIXME|HACK|XXX)\b/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "TODO graveyard",
          `${n} unresolved marker(s). These outlive the people who wrote them.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "non-null",
    severity: "low",
    penalty: 3,
    run: (code) => {
      const re = /\w+!\./g;
      const n = countMatches(code, re);
      if (n < 3) return [];
      return [
        hit(
          "Non-null assertion spam",
          `${n} "!" assertions. You are telling the compiler to trust you. It should not.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "long-lines",
    severity: "low",
    penalty: 3,
    run: (_code, stats) => {
      if (stats.longestLine <= 160) return [];
      return [
        hit(
          "Line longer than the screen",
          `Longest line is ${stats.longestLine} characters. Horizontal scrolling is not a layout.`,
        ),
      ];
    },
  },
  {
    id: "parseint",
    severity: "low",
    penalty: 3,
    run: (code) => {
      const re = /parseInt\s*\(\s*[^,)]+\)/g;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "parseInt without a radix",
          `${n} call(s). "08" is not eight everywhere. Pass the 10.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "single-letter",
    severity: "nit",
    penalty: 2,
    run: (code) => {
      const re = /\b(?:const|let|var)\s+([a-z])\s*=/g;
      const names = [...code.matchAll(re)].map((m) => m[1]);
      if (names.length < 3) return [];
      return [
        hit(
          "Single-letter variables",
          `${names.length} of them. This is not a maths paper, you can afford the keystrokes.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "no-comments",
    severity: "nit",
    penalty: 2,
    run: (_code, stats) => {
      if (stats.codeLines <= 40 || stats.commentLines > 0) return [];
      return [
        hit(
          "Zero comments",
          `${stats.codeLines} lines of code, not one note about why. Future you is a stranger.`,
        ),
      ];
    },
  },
];

/* ------------------------------------------------------------------ */
/* scoring                                                             */
/* ------------------------------------------------------------------ */

export function gradeFor(score: number): string {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
}

const HEADLINES: Record<string, string[]> = {
  S: ["Suspiciously clean.", "Did a linter write this?", "Ship it. Carefully."],
  A: ["Solid work, show-off.", "Almost nothing to roast.", "This is fine. Genuinely."],
  B: ["Competent with a side of chaos.", "Works, but it hurts.", "The bones are good."],
  C: ["It runs. That is the review.", "Mediocre and proud of it.", "Half a codebase."],
  D: ["This is a cry for help.", "Technically software.", "Please add tests. Any tests."],
  F: ["Delete the repo.", "This is a war crime against semicolons.", "Start over. Touch grass first."],
};

const VERDICTS: Record<string, string> = {
  S: "I came here to roast you and I have nothing. Go review someone else's code, you monster.",
  A: "A few nits, nothing structural. You clearly read the docs at least once.",
  B: "The logic holds together, the craft does not. Half of these are a five-minute fix.",
  C: "It works, and that is the entire defence. Every finding here is a future 2am page.",
  D: "This passes review only because nobody read it. Fix the criticals before you touch a feature.",
  F: "I am not angry, I am disappointed. Start with the criticals, then rewrite the rest.",
};

/* ------------------------------------------------------------------ */
/* public API                                                          */
/* ------------------------------------------------------------------ */

export function analyze(code: string, hint?: Language): RoastResult {
  const trimmed = code.trim();
  const language = detectLanguage(trimmed, hint);
  const stats = computeStats(trimmed);

  if (!trimmed) {
    return {
      score: 100,
      grade: "S",
      headline: "Nothing to roast.",
      verdict: "Paste some code and I will find something. There is always something.",
      findings: [],
      stats,
      language,
      empty: true,
    };
  }

  const findings: Finding[] = [];
  for (const rule of RULES) {
    for (const h of rule.run(trimmed, stats, language)) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        title: h.title,
        detail: h.detail,
        line: h.line,
        penalty: rule.penalty,
      });
    }
  }

  findings.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (bySeverity !== 0) return bySeverity;
    return (a.line ?? Infinity) - (b.line ?? Infinity);
  });

  const penaltyBySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    nit: 0,
  };
  for (const f of findings) penaltyBySeverity[f.severity] += f.penalty;

  let totalPenalty = 0;
  for (const severity of SEVERITY_ORDER) {
    totalPenalty += Math.min(penaltyBySeverity[severity], SEVERITY_CAP[severity]);
  }

  const score = Math.max(0, Math.min(100, 100 - totalPenalty));
  const grade = gradeFor(score);
  const pool = HEADLINES[grade];
  const headline = pool[score % pool.length];

  return {
    score,
    grade,
    headline,
    verdict: VERDICTS[grade],
    findings,
    stats,
    language,
    empty: false,
  };
}

export function shareText(result: RoastResult, url?: string): string {
  if (result.empty) return "CodeRoast — paste some code and find out.";
  const top = result.findings.slice(0, 3).map((f) => `• ${f.title}`).join("\n");
  return [
    `I scored ${result.score}/100 (${result.grade}) on CodeRoast.`,
    result.headline,
    top ? `\nTop crimes:\n${top}` : "",
    url ? `\nRoast your own code: ${url}` : "\nRoast your own code.",
  ]
    .filter(Boolean)
    .join("\n");
}
