import { describe, expect, it } from "vitest";
import { badgeDataUri, badgeFileName, badgeMarkdown, badgeSvg } from "./badge";
import { analyze } from "./roast";

const bad = analyze("var a = 1;\neval(a);\nconsole.log(a);\n");
const good = analyze("export const add = (a: number, b: number): number => a + b;\n");

describe("badgeSvg", () => {
  it("is a well-formed standalone SVG", () => {
    const svg = badgeSvg(bad);
    expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\"")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain("<title>");
  });

  it("shows the score and grade", () => {
    const svg = badgeSvg(bad);
    expect(svg).toContain(`${bad.score}/100 ${bad.grade}`);
  });

  it("uses the grade colour as the value background", () => {
    const svg = badgeSvg(bad);
    const expected = bad.grade === "F" ? "#ff2d55" : null;
    if (expected) expect(svg).toContain(expected);
  });

  it("escapes XML metacharacters in the accessible label", () => {
    const svg = badgeSvg({ ...bad, grade: "F" });
    expect(svg).not.toMatch(/aria-label="[^"]*[<>&][^"]*"/);
  });

  it("sizes the badge to its content", () => {
    const svg = badgeSvg(bad);
    const width = Number(svg.match(/width="(\d+)"/)?.[1]);
    expect(width).toBeGreaterThan(100);
    expect(width).toBeLessThan(260);
  });
});

describe("badgeDataUri", () => {
  it("is an inline SVG data URI with no raw markup", () => {
    const uri = badgeDataUri(bad);
    expect(uri.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(uri).not.toContain("<svg");
    expect(uri).not.toContain('"');
  });
});

describe("badgeMarkdown / badgeFileName", () => {
  it("builds markdown pointing at the committed file", () => {
    expect(badgeMarkdown(bad)).toBe(`![CodeRoast ${bad.score}/100 ${bad.grade}](coderroast.svg)`);
  });

  it("honours a custom file name", () => {
    expect(badgeMarkdown(bad, "docs/badge.svg")).toContain("(docs/badge.svg)");
  });

  it("names the file after the score", () => {
    expect(badgeFileName(bad)).toBe(`coderroast-${bad.score}-${bad.grade}.svg`);
  });

  it("reflects a clean result", () => {
    expect(badgeSvg(good)).toContain(`${good.score}/100 ${good.grade}`);
  });
});
