# 🔥 CodeRoast

Paste your code, get a score out of 100, a letter grade, and a list of every crime it commits.

**[Try it live →](https://akmglobaltech.github.io/coderroast/)**

**100% client-side.** No API keys, no accounts, no uploads, no telemetry. Your code never leaves the browser tab.

## Why it exists

Code review tools are either enterprise-priced or they want your repository. CodeRoast is the opposite: paste a snippet, get an opinionated roast in under a second, and download a shareable score card.

## Features

- **Live analysis** — the score, grade, findings, and metrics update as you type. No button to press.
- **Off the main thread** — analysis runs in a Web Worker, so typing never janks. A watchdog recomputes on the main thread if the worker ever stalls, so the indicator can't get stuck.
- **Score + grade** — 0–100 with an S/A/B/C/D/F grade, driven by 50 weighted rules
- **50 rules** across security, correctness, structure, style, and per-language idioms
- **Per-severity penalty caps** so one noisy rule can't zero the score
- **Language auto-detection** for TypeScript, JavaScript, Python, Java, C#, Go, Rust, PHP, Ruby, SQL, HTML, CSS
- **Language-scoped rules** — HTML rules never fire on CSS, SQL rules never fire on JavaScript
- **Per-language samples** — "Load sample" loads a genuinely bad snippet in the selected language
- **Metrics panel** — nesting depth, longest function, branch count, duplication, comment ratio
- **Shareable PNG card** — 1200×630, rendered on canvas, ready for social
- **Share anywhere** — native share sheet with the image attached, copy the image to the clipboard, download the PNG, or post the link to X, LinkedIn, WhatsApp, Telegram, Reddit, Facebook, and Hacker News
- **Copy-to-clipboard** summary
- **Challenge links** — the code and language are compressed into the URL hash, so a shared link reopens the exact roast. The hash never reaches a server.
- **README badges** — a self-contained SVG badge with your score baked in, plus ready-made markdown
- **Roast a GitHub file** — paste a public `github.com` file URL and roast it without leaving the page
- **Category breakdown** — every finding is tagged security / correctness / performance / maintainability / accessibility / style, with a per-category score bar. Click a category to filter the crimes list.
- **A fix for every crime** — each finding carries a concrete, imperative fix, not just a complaint
- **Recoverable points** — the crimes header tells you how many points are still on the table
- **Roast history** — every settled roast is kept in `localStorage` with a sparkline, average, and delta. Nothing leaves the browser.
- **Report export** — download the full roast as Markdown or JSON, or copy the Markdown straight into a PR or ticket
- **Keyboard-first** — `Ctrl`/`Cmd` + `Enter` to jump to the results

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

Open the printed local URL, paste some code, and watch the score appear as you type.

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
    worker.ts       # Web Worker entry point — runs analyze() off the main thread
    useLiveRoast.ts # debounced live-analysis hook (worker + watchdog fallback)
    samples.ts      # one deliberately bad sample per language
    roast.test.ts   # engine tests
    share.ts        # canvas renderer + share/clipboard/download helpers
    shareTargets.ts # per-platform share intent URLs
    shareTargets.test.ts
    permalink.ts    # compress code+language into a URL hash, and back
    permalink.test.ts
    badge.ts        # self-contained SVG score badge + markdown
    badge.test.ts
    github.ts       # parse a GitHub file URL and fetch it from the browser
    github.test.ts
    history.ts      # localStorage roast history, summary, sparkline points
    history.test.ts
    report.ts       # Markdown / JSON report builder
    report.test.ts
  components/
    ScoreCard.tsx   # score ring, grade badge, headline
    FindingsList.tsx# severity-coloured findings, with a fix line and category filter
    StatsPanel.tsx  # metrics grid
    CategoryPanel.tsx# per-category score bars, doubles as a filter
    HistoryPanel.tsx# sparkline, average, recent roasts
    ExportBar.tsx   # download .md / .json, copy markdown
    Analyzing.tsx   # coding-themed spinner, live badge, scan bar
    ShareBar.tsx    # share sheet, clipboard, download, platform links
    ChallengeBar.tsx# challenge link, badge download, badge markdown
    GitHubLoader.tsx# "Roast a repo file" URL input + fetch
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

`langs` scopes a rule to specific languages. When it is omitted the rule runs everywhere. When the language cannot be detected (`unknown`) only language-agnostic rules run — a stray HTML finding on a JavaScript snippet is worse than a missed finding.

## Live analysis

The score, grade, findings, and metrics recompute as you type. The pipeline:

1. `useLiveRoast` debounces keystrokes by 220 ms so a burst of typing costs one analysis.
2. The snippet is posted to a Web Worker (`src/lib/worker.ts`) that imports the same pure `analyze()` the tests use. Nothing blocks the main thread, so the editor never janks.
3. A monotonic request id discards stale responses, so a slow analysis can never overwrite a newer one.
4. If the worker fails to construct, errors, or does not answer within 4 s, the hook recomputes on the main thread. The indicator can never get stuck on "analyzing".

The worker is a module-level singleton rather than a per-component one, because React StrictMode's mount/unmount cycle would otherwise terminate a worker with a request still in flight.

`analyze()` is fast enough that the worker is mostly insurance: ~0.4 ms for a small snippet and ~22 ms for 300 lines.

## Sharing

The card is a 1200×630 PNG rendered on a canvas in `src/lib/share.ts`. Getting that image onto another platform runs into one hard browser constraint: **no web page can push a file into another site's compose box.** The share intent URLs (`twitter.com/intent/tweet`, `linkedin.com/sharing/share-offsite`, …) accept text and a URL, nothing else. So the image travels by one of three routes:

| Route | API | Where it lands | Support |
| --- | --- | --- | --- |
| **Native share sheet** | `navigator.share({ files })` — Web Share API Level 2 | WhatsApp, Telegram, Instagram, iMessage, Slack, Mail, AirDrop, any installed app | Chrome/Edge (desktop + Android), Safari 15+ (iOS + macOS). **Not Firefox desktop.** |
| **Clipboard** | `navigator.clipboard.write([new ClipboardItem({ "image/png": blob })])` | Paste into X, LinkedIn, Slack, Discord, Docs, anywhere | Chrome, Edge, Safari. **Not Firefox.** |
| **Link unfurl** | Open Graph + Twitter Card meta tags in `index.html` | The preview image on any platform where the *link* is posted | Everywhere |

`ShareBar` (`src/components/ShareBar.tsx`) renders whichever of the first two the browser supports, plus a download button that always works, plus the seven platform intent links.

### Why the card is pre-rendered

`navigator.share()` must be called while the user gesture is still live. Awaiting a canvas encode inside the click handler burns that activation in Chrome and the call throws `NotAllowedError`. So `ShareBar` renders the PNG 300 ms after the result settles, keeps the `Blob` in state, and the click handler calls `navigator.share()` immediately with the already-built `File`.

### The OG image

`public/og.jpg` is a static 1200×630 marketing card (72 KB) referenced by absolute URL in `index.html`. It is what X, LinkedIn, Slack, Discord, and iMessage show when someone posts the link. Regenerate it by rendering a canvas at 1200×630 and saving the result over `public/og.jpg`; keep it under ~300 KB so unfurlers fetch it reliably.

### Adding a platform

Add an entry to `SHARE_TARGETS` in `src/lib/shareTargets.ts`:

```ts
{
  id: "mastodon",
  label: "Mastodon",
  href: (text, url) => `https://mastodon.social/share?text=${enc(`${text} ${url}`)}`,
}
```

`shareTargets.test.ts` asserts every target is https-only, has a unique id, and encodes reserved characters, so a malformed URL fails CI rather than shipping.

## Challenge links

A challenge link reopens the exact roast — same code, same language, same score — without a database.

The payload lives in the **URL hash** (`#r=…`), not the query string. Browsers never send the hash to a server, so a shared roast keeps the "nothing is uploaded" promise even though the code is in the URL.

`src/lib/permalink.ts` compresses `{ c: code, l: language }` with `lz-string`'s `compressToEncodedURIComponent`, which is URL-safe and roughly 3–4× smaller than base64 of the raw text. A 54-character snippet becomes a 114-character hash.

```ts
encodeRoast(code, language)   // string | null  — null when code is empty or > MAX_LINK_CODE
decodeRoast(payload)          // RoastLink | null — never throws
buildRoastUrl(base, code, lang)
readRoastHash(hash)           // requires the "#r=" prefix
challengeText(result, url)    // the taunting message that goes with the link
```

`MAX_LINK_CODE` is 12,000 characters. Past that the button disables itself, because chat clients truncate long URLs and a half-link is worse than no link.

`App.tsx` hydrates from the hash on mount and on `hashchange`, so back/forward works. The first edit drops the hash via `history.replaceState`, so a reload never resurrects code the visitor has already changed.

## Badges

`src/lib/badge.ts` renders a shields-style SVG locally — no shields.io round-trip, so it works offline and leaks nothing:

```ts
badgeSvg(result)                        // the SVG source
badgeDataUri(result)                    // data:image/svg+xml,… for inline use
badgeMarkdown(result, "coderroast.svg") // ![CodeRoast 67/100 C](coderroast.svg)
badgeFileName(result)                   // coderroast-67-C.svg
```

The score is baked into the SVG, which makes it a **static snapshot**: commit it and it keeps showing the score from the day you generated it. That is the honest trade-off for staying serverless — a live badge would need a server to re-run the analysis on every image request.

## Roasting a GitHub file

`src/lib/github.ts` accepts three shapes and normalises them to `{ owner, repo, ref, path }`:

- `https://github.com/owner/repo/blob/main/src/app.ts`
- `https://raw.githubusercontent.com/owner/repo/main/src/app.ts`
- `owner/repo/src/app.ts`

`#L10-L40` fragments and `?plain=1` queries are stripped. The file is fetched through `api.github.com/repos/{owner}/{repo}/contents/{path}`, not `raw.githubusercontent.com`, because the contents API reports `size`, `type`, and `encoding` — so folders and oversize files are rejected before the body is downloaded.

`MAX_FILE_BYTES` is 200,000. Base64 is decoded through `Uint8Array` + `TextDecoder` so UTF-8 source (emoji, accented identifiers, CJK comments) survives intact.

The request is **unauthenticated**, so it is capped at 60 requests per hour per IP. `fetchGitHubFile` surfaces that as a specific message rather than retrying — retrying would only burn the quota faster.

## Category breakdown

Every rule is tagged with one of six categories in `RULE_META` (a `Record<string, { category, fix }>` keyed by rule id, kept separate from the 50 rule literals so adding a category never means editing 50 objects):

| Category | What it catches |
| --- | --- |
| `security` | `eval`, hardcoded secrets, string-built SQL, unsanitised HTML, plaintext HTTP, `Math.random()` for tokens, inline handlers, sensitive columns |
| `correctness` | empty catches, leftover `debugger`, loose equality, `var`, `any`, non-null spam, `parseInt` without a radix, missing doctype, `UPDATE`/`DELETE` without `WHERE` |
| `performance` | jQuery from a CDN, universal selectors, `SELECT *`, leading-wildcard `LIKE`, comma joins, N+1 patterns |
| `maintainability` | deep nesting, marathon functions, branch soup, duplication, god files, commented-out code, magic numbers, TODOs, `!important`, ID selectors, `float` layout, z-index arms races |
| `accessibility` | images without `alt`, table-based layout, `<html>` without `lang`, everything in `px` |
| `style` | `console.log` archaeology, print debugging, long lines, single-letter variables, deprecated tags, XHTML self-closing tags, stacked `<br>`, named colours |

`analyze()` sums each category's penalties (clamped by the same per-severity caps as the overall score) and returns `categories: CategoryScore[]`, sorted worst-first. `CategoryPanel` renders them as health bars and doubles as a filter — clicking a row narrows the crimes list, and `editCode()` clears the filter so a new snippet never opens pre-filtered.

`recoverable` is `100 - score`: the points still on the table.

## History

`src/lib/history.ts` keeps the last 60 settled roasts in `localStorage` under `coderroast:history`. It takes an injected `StorageLike` so it is testable in Node, and every storage call is wrapped in `try/catch` — private-mode browsers get a working app with no history instead of a crash.

`appendEntry` dedupes against the previous entry on `score` + `grade` + `language` and returns the **same array reference** when nothing changed, so live analysis re-running on every keystroke does not fill the log with 40 identical rows and `App.tsx` can skip the write.

`summarize` returns `count`, `best`, `worst`, `average`, `delta`, and `series`; `sparklinePoints` maps the series onto an SVG box with the y-axis inverted. The panel renders on load, before any code is pasted, so a returning visitor sees their trend immediately.

## Reports

`src/lib/report.ts` builds a Markdown or JSON report from a `RoastResult` — pure string building, no DOM, so it is testable in Node and reusable from a future CLI.

The Markdown has a stats table, a by-category table, and every finding with its severity, line, penalty, detail, and `_Fix:_` line. The JSON carries the same data plus `generatedAt` and the tool URL. `ExportBar` downloads either format or copies the Markdown to the clipboard.

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

This repo deploys itself: `.github/workflows/deploy.yml` runs the tests, builds, and publishes to GitHub Pages on every push to `main`. Because the site is served from a subpath, `vite.config.ts` sets `base: "/coderroast/"` for builds only — the dev server stays at `/`.

## License

[MIT](./LICENSE) © arafat.koko
