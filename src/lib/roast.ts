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
  const stripped = line
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/\/\/.*$/, "");
  // `#` opens a comment in Python/Ruby/shell but is an ID selector in CSS,
  // so only treat it as a comment when the line is not a CSS rule.
  if (stripped.includes("{")) return stripped;
  return stripped.replace(/(^|\s)#.*$/, "$1");
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
  if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("<!--")) {
    return true;
  }
  // `#` is a comment in Python/Ruby/shell but an ID selector in CSS.
  if (t.startsWith("#")) return !t.includes("{");
  // `--` is a comment in SQL/Lua but a custom-property prefix in CSS.
  if (t.startsWith("--")) return !/^--[\w-]+\s*:/.test(t);
  return false;
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
  // `import java.util.*` is unambiguous Java; C# uses `using` instead.
  if (/\bimport\s+java\./.test(src)) bump("java", 6);
  if (/\busing\s+System\b/.test(src) || /\bConsole\.WriteLine/.test(src)) bump("csharp", 6);
  if (/\bnamespace\s+[\w.]+/.test(src) || /\bpublic\s+class\s+\w+\s*:/.test(src)) bump("csharp", 4);
  if (/\bfunc\s+\w+\s*\(/.test(src) || /\bpackage\s+main\b/.test(src)) bump("go", 4);
  if (/\bfn\s+\w+\s*\(/.test(src) || /\blet\s+mut\b/.test(src)) bump("rust", 4);
  // `<?php` is decisive; `$var =` alone is weaker because JS templates use `$`.
  if (/<\?php/.test(src)) bump("php", 8);
  else if (/\$\w+\s*=(?!=)/.test(src)) bump("php", 3);
  // Ruby shares `def` with Python, so it needs its own decisive markers.
  if (/\bputs\s+/.test(src) || /^\s*end\s*$/m.test(src)) bump("ruby", 4);
  if (/\brequire\s+['"]/.test(src) || /\bdo\s*\|/.test(src) || /\battr_(accessor|reader|writer)\b/.test(src)) {
    bump("ruby", 3);
  }
  if (/<(!doctype|html|div|span|body)\b/i.test(src)) bump("html", 4);
  if (/[.#][\w-]+\s*\{[^}]*:[^}]*;/.test(src)) bump("css", 3);

  // A document that opens with a doctype or <html> is HTML, whatever else is
  // inlined in it. Without this an HTML file with a <script> block gets
  // outvoted by its own JavaScript.
  if (/^\s*<!doctype\s+html/i.test(src) || /^\s*<html\b/i.test(src)) bump("html", 12);
  if (/<\/?(head|body|meta|link|title|section|header|footer|nav|main|form|input|button|table|ul|li|img|a|p|h[1-6])\b/i.test(src)) {
    bump("html", 3);
  }

  // CSS: a selector block with at least two declarations, or an at-rule.
  if (/[^{}]*\{[^{}]*:[^{}]*;[^{}]*:[^{}]*;[^{}]*\}/.test(src)) bump("css", 6);
  if (/@(media|supports|keyframes|font-face|import)\b/.test(src)) bump("css", 4);
  if (/^\s*(:root|html|body|\*)\s*[,{]/m.test(src)) bump("css", 3);

  // JS-family signals are the common case, so they get enough weight to beat a
  // stray SQL/HTML keyword that leaked in from a template or a comment.
  if (/\b(const|let|var)\s+\w+\s*=/.test(src)) bump("javascript", 3);
  if (/\bfunction\s*\w*\s*\(/.test(src) || /=>/.test(src)) bump("javascript", 3);
  if (/\bconsole\.\w+\s*\(/.test(src)) bump("javascript", 2);
  if (/\bdocument\.\w+/.test(src) || /\bwindow\.\w+/.test(src)) bump("javascript", 2);
  if (/\brequire\s*\(/.test(src) || /\bmodule\.exports\b/.test(src)) bump("javascript", 2);
  // C-style control flow with parentheses: enough to label a short snippet that
  // has no declarations at all, without outvoting a language with real markers.
  if (/\b(if|for|while|switch|try|catch)\s*\(/.test(src)) bump("javascript", 2);
  // A bare `name(...);` statement. Weak on purpose: it only decides snippets
  // that produced no other signal at all, such as `eval("x");`.
  if (/\b[\w.$]+\s*\([^)]*\)\s*;/.test(src)) bump("javascript", 1);

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
  /** When set, the rule only runs for these languages. */
  langs?: Language[];
  run: (code: string, stats: Stats, lang: Language) => RuleHit[];
}

function hit(title: string, detail: string, line?: number): RuleHit {
  return { title, detail, line };
}

/** Languages whose syntax is JavaScript, including inline `<script>` in HTML. */
const JS_LIKE: Language[] = ["javascript", "typescript", "html"];

const RULES: Rule[] = [
  {
    id: "eval",
    severity: "critical",
    penalty: 22,
    langs: [...JS_LIKE, "php", "python", "ruby"],
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
        /(api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*(?::[^=;]{1,40})?[:=]\s*['"][^'"]{6,}['"]/i;
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
    langs: JS_LIKE,
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
    langs: [...JS_LIKE, "java", "csharp", "php", "python", "ruby"],
    run: (code) => {
      const re =
        /catch\s*(\([^)]*\))?\s*\{\s*\}|except\s*:\s*(pass\b)?|rescue\b[^\n]*\n\s*end/;
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
    langs: JS_LIKE,
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
    langs: [...JS_LIKE, "java", "csharp", "go", "rust", "php"],
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
    langs: [...JS_LIKE, "java", "csharp", "go", "rust", "php"],
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
    langs: [...JS_LIKE, "java", "csharp", "go", "rust", "php", "python"],
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
    langs: [...JS_LIKE, "java", "csharp", "go", "rust", "php", "python", "sql"],
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
    langs: [...JS_LIKE, "java", "csharp", "go", "rust", "php", "python", "sql", "css"],
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
    langs: JS_LIKE,
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
    langs: JS_LIKE,
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
    langs: ["typescript"],
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
    langs: JS_LIKE,
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
    langs: JS_LIKE,
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
    id: "print-debugging",
    severity: "low",
    penalty: 4,
    langs: ["go", "rust", "python", "ruby", "php", "java", "csharp"],
    run: (code) => {
      const re = /\b(println!|print!|fmt\.Print(f|ln)?|System\.out\.print(ln)?|Console\.Write(Line)?|print\s*\(|puts\b|echo\b)/g;
      const n = countMatches(code, re);
      if (n < 3) return [];
      return [
        hit(
          "Print-statement debugging",
          `${n} print calls left in. Somebody was chasing a bug and never came back for the evidence.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "commented-code",
    severity: "low",
    penalty: 4,
    langs: [...JS_LIKE, "java", "csharp", "go", "rust", "php", "python", "ruby", "sql"],
    run: (code) => {
      const lines = code.split("\n");
      let count = 0;
      let line: number | undefined;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        // `//`, `#` and `--` all open a line comment somewhere.
        const m = /^(\/\/|#|--)\s*(.+)$/.exec(t);
        if (!m) continue;
        const body = m[2].trim();
        if (/[;{}]$/.test(body) || /^\w+\s*\(.*\)\s*;?$/.test(body) || /^\w+\s*=\s*.+$/.test(body)) {
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
    langs: [...JS_LIKE, "java", "csharp", "go", "rust", "php", "python"],
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
    langs: ["typescript"],
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
    langs: JS_LIKE,
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
    langs: JS_LIKE,
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

  /* ---------------- HTML ---------------- */
  {
    id: "html-doctype",
    severity: "medium",
    penalty: 6,
    langs: ["html"],
    run: (code) => {
      if (/^\s*<!doctype\s+html/i.test(code)) return [];
      return [
        hit(
          "No <!DOCTYPE html>",
          "Without a doctype the browser drops into quirks mode and lays the page out like it is 1999.",
          1,
        ),
      ];
    },
  },
  {
    id: "html-deprecated-tags",
    severity: "high",
    penalty: 12,
    langs: ["html"],
    run: (code) => {
      const re = /<\s*(font|center|marquee|blink|big|strike|tt|frame|frameset|acronym)\b/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Deprecated tags",
          `${n} use(s) of tags the HTML spec retired years ago. CSS does this now, and has for a decade.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "html-inline-style",
    severity: "medium",
    penalty: 7,
    langs: ["html"],
    run: (code) => {
      const re = /\sstyle\s*=\s*["'][^"']+["']/gi;
      const n = countMatches(code, re);
      if (n < 2) return [];
      return [
        hit(
          "Inline styles",
          `${n} style attribute(s). Every one of these beats your stylesheet in the cascade and nobody can find it later.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "html-inline-handlers",
    severity: "high",
    penalty: 11,
    langs: ["html"],
    run: (code) => {
      const re = /\son(click|change|submit|load|error|mouseover|keyup|keydown)\s*=\s*["']/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Inline event handlers",
          `${n} on* attribute(s). This is markup pretending to be JavaScript, and it cannot be tested or removed.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "html-missing-alt",
    severity: "medium",
    penalty: 6,
    langs: ["html"],
    run: (code) => {
      const imgs = [...code.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
      const missing = imgs.filter((tag) => !/\balt\s*=/i.test(tag));
      if (!missing.length) return [];
      return [
        hit(
          "Images without alt text",
          `${missing.length} of ${imgs.length} <img> tag(s) have no alt. Screen readers announce nothing and the page fails accessibility.`,
          firstLineOf(code, /<img\b[^>]*>/i),
        ),
      ];
    },
  },
  {
    id: "html-table-layout",
    severity: "high",
    penalty: 10,
    langs: ["html"],
    run: (code) => {
      const re = /<table\b[^>]*\brole\s*=\s*["']presentation["']|<td\b[^>]*\bwidth\s*=/gi;
      if (!re.test(code)) return [];
      return [
        hit(
          "Table-based layout",
          "Tables are for tabular data. Using them to position a page is a 2003 technique that still breaks screen readers.",
          firstLineOf(code, /<table\b/i),
        ),
      ];
    },
  },
  {
    id: "html-unclosed-void",
    severity: "low",
    penalty: 3,
    langs: ["html"],
    run: (code) => {
      const re = /<(img|br|hr|input|meta|link)\b[^>]*\/>/gi;
      const n = countMatches(code, re);
      if (n < 3) return [];
      return [
        hit(
          "XHTML self-closing tags",
          `${n} tag(s) closed with "/>". Valid HTML5, but it is a tell that you learned markup in 2008.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "html-jquery-cdn",
    severity: "medium",
    penalty: 8,
    langs: ["html"],
    run: (code) => {
      const re = /<script\b[^>]*src\s*=\s*["'][^"']*jquery[^"']*["']/gi;
      if (!re.test(code)) return [];
      return [
        hit(
          "jQuery from a CDN",
          "You are shipping 90 KB of 2010 to query the DOM. querySelector and fetch have existed for years.",
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "html-br-spacing",
    severity: "low",
    penalty: 4,
    langs: ["html"],
    run: (code) => {
      const re = /<br\s*\/?>\s*<br\s*\/?>/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Stacked <br> for spacing",
          `${n} double line break(s) used as layout. That is margin with extra steps and no control.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "html-missing-lang",
    severity: "low",
    penalty: 3,
    langs: ["html"],
    run: (code) => {
      const htmlTag = code.match(/<html\b[^>]*>/i);
      if (!htmlTag) return [];
      if (/\blang\s*=/i.test(htmlTag[0])) return [];
      return [
        hit(
          "<html> without lang",
          "No lang attribute. Screen readers guess the pronunciation and usually guess wrong.",
          firstLineOf(code, /<html\b/i),
        ),
      ];
    },
  },

  /* ---------------- CSS ---------------- */
  {
    id: "css-important",
    severity: "high",
    penalty: 11,
    langs: ["css"],
    run: (code) => {
      const re = /!important/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "!important everywhere",
          `${n} use(s). Every !important is a fight you lost against your own cascade.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "css-id-selectors",
    severity: "medium",
    penalty: 7,
    langs: ["css"],
    run: (code) => {
      const re = /(^|[\s,>+~])#[a-zA-Z][\w-]*\s*(,|\{)/gm;
      const n = countMatches(code, re);
      if (n < 2) return [];
      return [
        hit(
          "ID selectors for styling",
          `${n} rule(s) keyed on an id. Specificity 100 means the next developer needs !important to override you.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "css-px-units",
    severity: "medium",
    penalty: 6,
    langs: ["css"],
    run: (code) => {
      const re: RegExp = /(?<![\w.-])\d+px\b/g;
      const n = countMatches(code, re);
      if (n < 6) return [];
      return [
        hit(
          "Everything in px",
          `${n} pixel value(s). Font sizes in px ignore the user's browser settings. Use rem.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "css-float-layout",
    severity: "medium",
    penalty: 7,
    langs: ["css"],
    run: (code) => {
      const re = /\bfloat\s*:\s*(left|right)\b/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "float for layout",
          `${n} float(s). Flexbox and grid shipped in 2017. You can stop clearing floats now.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "css-universal-selector",
    severity: "low",
    penalty: 4,
    langs: ["css"],
    run: (code) => {
      const re = /(^|[\s,>+~])\*\s*[,{]/gm;
      if (!re.test(code)) return [];
      return [
        hit(
          "Universal selector",
          "A bare * rule hits every element in the document. Fine for a reset, expensive as a habit.",
          firstLineOf(code, /(^|[\s,>+~])\*\s*[,{]/m),
        ),
      ];
    },
  },
  {
    id: "css-vendor-prefix-spam",
    severity: "low",
    penalty: 4,
    langs: ["css"],
    run: (code) => {
      const re = /-(webkit|moz|ms|o)-[a-z-]+\s*:/gi;
      const n = countMatches(code, re);
      if (n < 4) return [];
      return [
        hit(
          "Vendor prefix spam",
          `${n} prefixed declaration(s). Autoprefixer does this from your browserslist, by hand you will always miss one.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "css-zindex-madness",
    severity: "medium",
    penalty: 6,
    langs: ["css"],
    run: (code) => {
      const re = /z-index\s*:\s*(\d{3,})/gi;
      const values = [...code.matchAll(re)].map((m) => Number(m[1]));
      if (!values.length) return [];
      const max = Math.max(...values);
      if (max < 999) return [];
      return [
        hit(
          "z-index arms race",
          `Highest z-index is ${max}. Someone is going to type 10000 next and the whole stack collapses.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "css-named-colors",
    severity: "nit",
    penalty: 2,
    langs: ["css"],
    run: (code) => {
      const re = /:\s*(red|blue|green|yellow|orange|purple|pink|brown|gray|grey|cyan|magenta|lime|teal|navy|maroon|olive|silver|aqua|fuchsia)\s*;/gi;
      const n = countMatches(code, re);
      if (n < 3) return [];
      return [
        hit(
          "Named colours",
          `${n} keyword colour(s). "green" is not your brand green, and it never will be.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "sql-select-star",
    severity: "medium",
    penalty: 7,
    langs: ["sql"],
    run: (code) => {
      const re = /\bSELECT\s+\*/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "SELECT *",
          `${n} query/queries pull every column. You are shipping blobs you never read and breaking the day a column is added.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "sql-no-where",
    severity: "high",
    penalty: 12,
    langs: ["sql"],
    run: (code) => {
      const re = /\b(UPDATE|DELETE)\s+(?!.*\bWHERE\b)[^;]*;/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "UPDATE/DELETE without WHERE",
          `${n} statement(s) touch every row in the table. One missing WHERE is all it takes to become a headline.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "sql-leading-wildcard",
    severity: "medium",
    penalty: 6,
    langs: ["sql"],
    run: (code) => {
      const re = /\bLIKE\s+'%/gi;
      const n = countMatches(code, re);
      if (!n) return [];
      return [
        hit(
          "Leading-wildcard LIKE",
          `${n} LIKE '%...' predicate(s). No index can help you here, so this is a full table scan wearing a query costume.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "sql-cartesian-join",
    severity: "high",
    penalty: 11,
    langs: ["sql"],
    run: (code) => {
      const re = /\bFROM\s+\w+\s+\w+\s*,\s*\w+\s+\w+/i;
      if (!re.test(code)) return [];
      return [
        hit(
          "Comma join",
          "Tables are joined with commas in the FROM clause. That is an implicit cross join waiting to multiply your row count.",
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "sql-n-plus-one",
    severity: "medium",
    penalty: 8,
    langs: ["sql"],
    run: (code) => {
      const re = /\bSELECT\b[^;]*\bWHERE\s+\w+_id\s*=\s*\d+\s*;/gi;
      const n = countMatches(code, re);
      if (n < 3) return [];
      return [
        hit(
          "N+1 query pattern",
          `${n} near-identical single-row lookups. That is a loop wearing a database hat — join once instead.`,
          firstLineOf(code, re),
        ),
      ];
    },
  },
  {
    id: "sql-sensitive-columns",
    severity: "high",
    penalty: 10,
    langs: ["sql"],
    run: (code) => {
      const re = /\bSELECT\b[^;]*\b(password|passwd|api_key|secret|token|ssn)\b/gi;
      if (!re.test(code)) return [];
      return [
        hit(
          "Sensitive columns in the projection",
          "The query returns passwords or keys. Nothing downstream needs them, and everything downstream logs them.",
          firstLineOf(code, re),
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

/**
 * Drops trailing whitespace only. Leading blank lines are preserved so that
 * reported line numbers keep matching the editor's gutter.
 */
export function normalizeCode(code: string): string {
  return code.replace(/\s+$/, "");
}

export function analyze(code: string, hint?: Language): RoastResult {
  const trimmed = normalizeCode(code);
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
    // A rule scoped to a language must not fire on a snippet detected as
    // something else. `unknown` means detection failed, so only the
    // language-agnostic rules run — a stray HTML finding on JavaScript is
    // worse than a missed one.
    if (rule.langs && !rule.langs.includes(language)) continue;
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
