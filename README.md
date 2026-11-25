# 🔥 CodeRoast

Paste your code, get a score out of 100, a letter grade, and a list of every crime it commits.

**[Try it live →](https://akmglobaltech.github.io/coderroast/)**

**100% client-side.** No API keys, no accounts, no uploads, no telemetry. Your code never leaves the browser tab.

## Why it exists

Code review tools are either enterprise-priced or they want your repository. CodeRoast is the opposite: paste a snippet, get an opinionated roast in under a second, and download a shareable score card.

## Features

- **Score + grade** — 0–100 with an S/A/B/C/D/F grade, driven by 50 weighted rules
- **50 rules** across security, correctness, structure, style, and per-language idioms
- **Per-severity penalty caps** so one noisy rule can't zero the score
- **Language auto-detection** for TypeScript, JavaScript, Python, Java, C#, Go, Rust, PHP, Ruby, SQL, HTML, CSS
- **Language-scoped rules** — HTML rules never fire on CSS, SQL rules never fire on JavaScript
- **Per-language samples** — "Load sample" loads a genuinely bad snippet in the selected language
- **Metrics panel** — nesting depth, longest function, branch count, duplication, comment ratio
- **Shareable PNG card** — 1200×630, rendered on canvas, ready for social
- **Copy-to-clipboard** summary
- **Keyboard-first** — `Ctrl`/`Cmd` + `Enter` to roast

## Rules

| Severity | Rules |
| --- | --- |
| Critical | `eval` / `new Function`, hardcoded credentials, string-built SQL |
| High | raw HTML injection, empty `catch`, leftover `debugger`, deep nesting, deprecated HTML tags, inline event handlers, table-based layout, `!important` everywhere, `SELECT`/`UPDATE`/`DELETE` without `WHERE`, cartesian joins, sensitive columns in a `SELECT` |
| Medium | marathon functions, branch soup, copy-paste, god files, loose equality, plaintext HTTP, `var`, `any`, `Math.random()` for secrets, missing doctype, inline styles, images without `alt`, jQuery from a CDN, ID selectors for styling, `px` for everything, `float` layout, `z-index` arms race, `SELECT *`, leading-wildcard `LIKE`, N+1 queries |
| Low | `console.log` spam, commented-out code, magic numbers, TODO graveyard, non-null assertion spam, overlong lines, `parseInt` without radix, unclosed void tags, stacked `<br>`, `<html>` without `lang`, universal selector, vendor-prefix spam, print-statement debugging |
| Nit | single-letter variables, zero comments, named CSS colours |

### Per-language coverage

| Language | Rules that only run here |
| --- | --- |
| HTML | doctype, deprecated tags, inline styles, inline handlers, missing `alt`, table layout, unclosed void tags, jQuery CDN, `<br>` spacing, missing `lang` |
| CSS | `!important`, ID selectors, `px` units, `float` layout, universal selector, vendor prefixes, `z-index`, named colours |
| SQL | `SELECT *`, missing `WHERE`, leading wildcard, cartesian join, N+1, sensitive columns |
| Python / Ruby | `except:` / `rescue` swallowing, `eval`, commented-out code, print debugging |
| Go / Rust / PHP / Java / C# | print-statement debugging, deep nesting, marathon functions, branch soup |

## Stack

- **React 19** + **TypeScript 5.9** (strict)
- **Vite 7** for dev/build
- **Tailwind CSS 4** via `@tailwindcss/vite` (no config file needed)
- **Vitest 3** for the engine tests

No runtime dependencies beyond React. The analysis engine is pure TypeScript with zero imports.

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL, paste some code, hit **Roast it**.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc --noEmit` across both projects |

## Project layout

```
src/
  lib/
    roast.ts        # analysis engine: detection, stats, 50 rules, scoring
    samples.ts      # one deliberately bad sample per language
    roast.test.ts   # engine tests
    share.ts        # canvas renderer for the shareable PNG card
  components/
    ScoreCard.tsx   # score ring, grade badge, headline
    FindingsList.tsx# severity-coloured findings
    StatsPanel.tsx  # metrics grid
  App.tsx           # editor + results layout
  main.tsx          # React root
  index.css         # Tailwind import + theme
```

## How scoring works

Start at 100 and subtract penalties. Each severity band has a ceiling:

| Severity | Cap |
| --- | --- |
| Critical | 60 |
| High | 40 |
| Medium | 24 |
| Low | 12 |
| Nit | 6 |

Grades: `S` ≥ 90, `A` ≥ 80, `B` ≥ 70, `C` ≥ 55, `D` ≥ 35, `F` < 35.

The caps matter: without them, three critical findings would always produce a score of 0 and every bad snippet would look identical.

## Adding a rule

Append to the `RULES` array in `src/lib/roast.ts`:

```ts
{
  id: "my-rule",
  severity: "medium",
  penalty: 5,
  langs: ["css"], // optional: omit to run on every language
  run: (code, stats) => {
    if (!/pattern/.test(code)) return [];
    return [hit("Title", "Why it is bad.", firstLineOf(code, /pattern/))];
  },
}
```

`run` returns `RuleHit[]` — it never touches scoring, so penalties stay declarative and testable.

`langs` scopes a rule to specific languages. When it is omitted the rule runs everywhere; when the language cannot be detected (`unknown`) every rule still runs, so an unrecognised snippet is never under-reported.

## Adding a sample

Samples live in `src/lib/samples.ts` and are keyed by language:

```ts
export const SAMPLES: Record<Language | "auto", string> = {
  auto: SAMPLE_JS,
  javascript: SAMPLE_JS,
  // ...
  css: SAMPLE_CSS,
};
```

Each sample should be genuinely bad in its own language so the roast has something to find. The `samples` test block asserts every sample is detected as its own language and scores ≤ 60.

## Deploying

The build is a static bundle. Drop `dist/` on any static host:

```bash
npm run build
```

Works on Vercel, Netlify, Cloudflare Pages, GitHub Pages, or a plain S3 bucket. No server, no environment variables.

## License

[MIT](./LICENSE) © arafat.koko
