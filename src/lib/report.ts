/**
 * Report export.
 *
 * Turns a roast into a file the user can keep, paste into a PR, or hand to a
 * reviewer. Pure string building — no DOM, no network.
 */

import type { RoastResult } from "./roast";
import { SEVERITY_LABEL } from "./roast";

export type ReportFormat = "markdown" | "json";

export function reportFileName(result: RoastResult, format: ReportFormat): string {
  const ext = format === "json" ? "json" : "md";
  return `coderroast-${result.score}-${result.grade}.${ext}`;
}

export function reportMarkdown(result: RoastResult, url?: string): string {
  const lines: string[] = [];
  lines.push(`# CodeRoast report — ${result.score}/100 (${result.grade})`);
  lines.push("");
  lines.push(`> ${result.headline}`);
  lines.push("");
  lines.push(`**Language:** ${result.language}  `);
  lines.push(`**Verdict:** ${result.verdict}`);
  lines.push("");

  lines.push("## Stats");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Lines | ${result.stats.lines} |`);
  lines.push(`| Code lines | ${result.stats.codeLines} |`);
  lines.push(`| Branches | ${result.stats.decisionPoints} |`);
  lines.push(`| Longest line | ${result.stats.longestLine} |`);
  lines.push(`| Average line | ${result.stats.avgLineLength} |`);
  lines.push("");

  const scored = result.categories.filter((c) => c.count > 0);
  if (scored.length > 0) {
    lines.push("## By category");
    lines.push("");
    lines.push("| Category | Score | Findings |");
    lines.push("| --- | --- | --- |");
    for (const c of scored) {
      lines.push(`| ${c.label} | ${c.score}/100 | ${c.count} |`);
    }
    lines.push("");
  }

  lines.push(`## Findings (${result.findings.length})`);
  lines.push("");
  if (result.findings.length === 0) {
    lines.push("Nothing. Suspiciously clean.");
  } else {
    for (const f of result.findings) {
      const where = f.line ? ` — line ${f.line}` : "";
      lines.push(
        `- **${SEVERITY_LABEL[f.severity]}** · ${f.title}${where} · −${f.penalty}`,
      );
      lines.push(`  - ${f.detail}`);
      lines.push(`  - _Fix:_ ${f.fix}`);
    }
  }
  lines.push("");

  if (url) {
    lines.push("---");
    lines.push("");
    lines.push(`Roasted with [CodeRoast](${url}) — 100% client-side, nothing uploaded.`);
    lines.push("");
  }
  return lines.join("\n");
}

export function reportJson(result: RoastResult, url?: string): string {
  return JSON.stringify(
    {
      tool: "CodeRoast",
      url: url ?? null,
      generatedAt: new Date().toISOString(),
      score: result.score,
      grade: result.grade,
      headline: result.headline,
      verdict: result.verdict,
      language: result.language,
      recoverable: result.recoverable,
      stats: result.stats,
      categories: result.categories,
      findings: result.findings.map((f) => ({
        id: f.id,
        severity: f.severity,
        category: f.category,
        title: f.title,
        detail: f.detail,
        fix: f.fix,
        line: f.line ?? null,
        penalty: f.penalty,
      })),
    },
    null,
    2,
  );
}

export function buildReport(
  result: RoastResult,
  format: ReportFormat,
  url?: string,
): string {
  return format === "json" ? reportJson(result, url) : reportMarkdown(result, url);
}
