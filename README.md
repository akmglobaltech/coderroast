# 🔥 CodeRoast

Paste your code, get a score out of 100, a letter grade, and a list of every crime it commits.

**100% client-side.** No API keys, no accounts, no uploads, no telemetry. Your code never leaves the browser tab.

## Why it exists

Code review tools are either enterprise-priced or they want your repository. CodeRoast is the opposite: paste a snippet, get an opinionated roast in under a second, and download a shareable score card.

## Features

- **Score + grade** — 0–100 with an S/A/B/C/D/F grade, driven by 25 weighted rules
- **25 rules** across security, correctness, structure, and style
- **Per-severity penalty caps** so one noisy rule can't zero the score
- **Language auto-detection** for TypeScript, JavaScript, Python, Java, C#, Go, Rust, PHP, Ruby, SQL, HTML, CSS
- **Metrics panel** — nesting depth, longest function, branch count, duplication, comment ratio
- **Shareable PNG card** — 1200×630, rendered on canvas, ready for social
- **Copy-to-clipboard** summary
- **Keyboard-first** — `Ctrl`/`Cmd` + `Enter` to roast

## Rules

| Severity | Rules |
| --- | --- |
| Critical | `eval` / `new Function`, hardcoded credentials, string-built SQL |
| High | raw HTML injection, empty `catch`, leftover `debugger`, deep nesting |
| Medium | marathon functions, branch soup, copy-paste, god files, loose equality, plaintext HTTP, `var`, `any`, `Math.random()` for secrets |
| Low | `console.log` spam, commented-out code, magic numbers, TODO graveyard, non-null assertion spam, overlong lines, `parseInt` without radix |
| Nit | single-letter variables, zero comments |

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
    roast.ts        # analysis engine: detection, stats, 25 rules, scoring
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
  run: (code, stats) => {
    if (!/pattern/.test(code)) return [];
    return [hit("Title", "Why it is bad.", firstLineOf(code, /pattern/))];
  },
}
```

`run` returns `RuleHit[]` — it never touches scoring, so penalties stay declarative and testable.

## Deploying

The build is a static bundle. Drop `dist/` on any static host:

```bash
npm run build
```

Works on Vercel, Netlify, Cloudflare Pages, GitHub Pages, or a plain S3 bucket. No server, no environment variables.

## License

MIT
