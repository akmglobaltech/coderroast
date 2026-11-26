import { describe, expect, it } from "vitest";
import { analyze } from "./roast";
import { buildReport, reportFileName, reportJson, reportMarkdown } from "./report";

const DIRTY = `var password = "hunter2";
eval("2+2");
if (x == 1) { console.log(x) }
`;

describe("reportFileName", () => {
  it("names markdown and json files after the score", () => {
    const r = analyze(DIRTY);
    expect(reportFileName(r, "markdown")).toBe(`coderroast-${r.score}-${r.grade}.md`);
    expect(reportFileName(r, "json")).toBe(`coderroast-${r.score}-${r.grade}.json`);
  });
});

describe("reportMarkdown", () => {
  const result = analyze(DIRTY);
  const md = reportMarkdown(result, "https://example.test/coderroast");

  it("leads with the score and grade", () => {
    expect(md.startsWith(`# CodeRoast report — ${result.score}/100 (${result.grade})`)).toBe(true);
  });

  it("includes the stats table", () => {
    expect(md).toContain("| Lines |");
    expect(md).toContain(`| Code lines | ${result.stats.codeLines} |`);
  });

  it("lists every finding with its fix", () => {
    for (const f of result.findings) {
      expect(md).toContain(f.title);
      expect(md).toContain(f.fix);
    }
  });

  it("includes the category table when something scored", () => {
    expect(md).toContain("## By category");
    expect(md).toContain("| Category | Score | Findings |");
  });

  it("appends the tool link when a url is given", () => {
    expect(md).toContain("https://example.test/coderroast");
  });

  it("omits the link when no url is given", () => {
    expect(reportMarkdown(result)).not.toContain("Roasted with");
  });

  it("handles a clean result", () => {
    const clean = analyze("const x = 1;\nexport default x;\n");
    const out = reportMarkdown(clean);
    expect(out).toContain("Nothing. Suspiciously clean.");
    expect(out).not.toContain("## By category");
  });
});

describe("reportJson", () => {
  const result = analyze(DIRTY);
  const parsed = JSON.parse(reportJson(result, "https://example.test")) as Record<string, unknown>;

  it("is valid JSON with the headline fields", () => {
    expect(parsed.tool).toBe("CodeRoast");
    expect(parsed.score).toBe(result.score);
    expect(parsed.grade).toBe(result.grade);
    expect(parsed.url).toBe("https://example.test");
  });

  it("carries the category breakdown", () => {
    expect(Array.isArray(parsed.categories)).toBe(true);
    expect((parsed.categories as unknown[]).length).toBe(6);
  });

  it("carries every finding with a fix", () => {
    const findings = parsed.findings as Array<Record<string, unknown>>;
    expect(findings).toHaveLength(result.findings.length);
    for (const f of findings) {
      expect(typeof f.fix).toBe("string");
      expect((f.fix as string).length).toBeGreaterThan(0);
      expect(typeof f.category).toBe("string");
    }
  });

  it("records a null url when none is given", () => {
    expect(JSON.parse(reportJson(result)).url).toBeNull();
  });
});

describe("buildReport", () => {
  it("dispatches on the format", () => {
    const result = analyze(DIRTY);
    expect(buildReport(result, "json").trimStart().startsWith("{")).toBe(true);
    expect(buildReport(result, "markdown").startsWith("# CodeRoast report")).toBe(true);
  });
});
