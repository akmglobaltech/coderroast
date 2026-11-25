import { describe, expect, it } from "vitest";
import { analyze, computeStats, detectLanguage, gradeFor, shareText } from "./roast";

describe("detectLanguage", () => {
  it("respects an explicit hint", () => {
    expect(detectLanguage("const x = 1", "python")).toBe("python");
  });

  it("detects python from def", () => {
    expect(detectLanguage("def foo(x):\n    return x")).toBe("python");
  });

  it("detects typescript from interfaces", () => {
    expect(detectLanguage("interface User { id: string }")).toBe("typescript");
  });

  it("detects sql", () => {
    expect(detectLanguage("SELECT * FROM users WHERE id = 1")).toBe("sql");
  });

  it("detects go", () => {
    expect(detectLanguage("package main\nfunc main() {}")).toBe("go");
  });

  it("falls back to unknown for prose", () => {
    expect(detectLanguage("just some words here")).toBe("unknown");
  });

  it("ignores SQL keywords that only appear inside a JS string", () => {
    const js = [
      'const q = "SELECT * FROM users WHERE id = " + id;',
      "const res = db.query(q);",
      "function getUser(id) { return res; }",
    ].join("\n");
    expect(detectLanguage(js)).toBe("javascript");
  });

  it("ignores HTML tags that only appear inside a template literal", () => {
    const js = "const html = `<div class='x'>hi</div>`;\nconst el = document.body;";
    expect(detectLanguage(js)).toBe("javascript");
  });

  it("still detects a real SQL file", () => {
    expect(detectLanguage("SELECT id, name\nFROM users\nWHERE active = 1")).toBe("sql");
  });
});

describe("computeStats", () => {
  it("counts lines, blanks and comments", () => {
    const stats = computeStats("const a = 1;\n\n// note\nconst b = 2;");
    expect(stats.lines).toBe(4);
    expect(stats.blankLines).toBe(1);
    expect(stats.commentLines).toBe(1);
    expect(stats.codeLines).toBe(2);
  });

  it("measures nesting depth", () => {
    const stats = computeStats("function f() {\n  if (a) {\n    if (b) {\n      x();\n    }\n  }\n}");
    expect(stats.maxNesting).toBeGreaterThanOrEqual(3);
  });

  it("ignores braces inside strings", () => {
    const stats = computeStats('const s = "{{{{{{";');
    expect(stats.maxNesting).toBe(0);
  });

  it("finds duplicated lines", () => {
    const line = "const value = computeSomething();";
    const stats = computeStats([line, line, line].join("\n"));
    expect(stats.duplicateLines).toBe(2);
  });

  it("handles empty input", () => {
    const stats = computeStats("");
    expect(stats.lines).toBe(1);
    expect(stats.codeLines).toBe(0);
  });
});

describe("gradeFor", () => {
  it("maps score bands to grades", () => {
    expect(gradeFor(100)).toBe("S");
    expect(gradeFor(90)).toBe("S");
    expect(gradeFor(89)).toBe("A");
    expect(gradeFor(80)).toBe("A");
    expect(gradeFor(70)).toBe("B");
    expect(gradeFor(55)).toBe("C");
    expect(gradeFor(35)).toBe("D");
    expect(gradeFor(0)).toBe("F");
  });
});

describe("analyze", () => {
  it("returns an empty result for blank input", () => {
    const result = analyze("   \n  ");
    expect(result.empty).toBe(true);
    expect(result.findings).toHaveLength(0);
    expect(result.score).toBe(100);
  });

  it("flags eval as critical", () => {
    const result = analyze("const x = eval(userInput);");
    const evalFinding = result.findings.find((f) => f.id === "eval");
    expect(evalFinding).toBeDefined();
    expect(evalFinding?.severity).toBe("critical");
  });

  it("flags hardcoded secrets", () => {
    const result = analyze('const apiKey = "sk_live_abcdef123456";');
    expect(result.findings.some((f) => f.id === "secret")).toBe(true);
  });

  it("flags empty catch blocks", () => {
    const result = analyze("try { go(); } catch (e) {}");
    expect(result.findings.some((f) => f.id === "empty-catch")).toBe(true);
  });

  it("flags loose equality", () => {
    const result = analyze("if (a == b) { run(); }");
    expect(result.findings.some((f) => f.id === "loose-equality")).toBe(true);
  });

  it("does not flag strict equality", () => {
    const result = analyze("if (a === b) { run(); }");
    expect(result.findings.some((f) => f.id === "loose-equality")).toBe(false);
  });

  it("scores clean code higher than messy code", () => {
    const clean = analyze(
      [
        "export function add(a: number, b: number): number {",
        "  return a + b;",
        "}",
      ].join("\n"),
    );
    const messy = analyze(
      [
        'var apiKey = "sk_live_abcdef123456";',
        "function go(id) {",
        '  var q = "SELECT * FROM t WHERE id = " + id;',
        "  try { eval(q); } catch (e) {}",
        "  if (id == null) { return null; }",
        "  document.getElementById('x').innerHTML = q;",
        "  debugger;",
        "}",
      ].join("\n"),
    );
    expect(clean.score).toBeGreaterThan(messy.score);
    expect(messy.score).toBeLessThan(60);
  });

  it("never returns a score outside 0..100", () => {
    const worst = analyze(
      [
        'var apiKey = "sk_live_abcdef123456";',
        "eval(a); eval(b); eval(c);",
        'var q = "SELECT * FROM t WHERE id = " + id;',
        "try { x(); } catch (e) {}",
        "debugger;",
        "if (a == b) {} if (c != d) {}",
        "document.body.innerHTML = q;",
        "console.log(1); console.log(2); console.log(3); console.log(4);",
        "// TODO: fix",
        "// FIXME: fix",
      ].join("\n"),
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it("sorts findings by severity", () => {
    const result = analyze(
      ['var apiKey = "sk_live_abcdef123456";', "console.log(1);", "console.log(2);", "console.log(3);", "console.log(4);"].join(
        "\n",
      ),
    );
    const severities = result.findings.map((f) => f.severity);
    const firstLow = severities.indexOf("low");
    const firstCritical = severities.indexOf("critical");
    expect(firstCritical).toBeLessThan(firstLow);
  });

  it("caps per-severity penalties so one band cannot zero the score", () => {
    const threeCriticals = analyze(
      [
        'const apiKey = "sk_live_abcdef123456";',
        "eval(a);",
        'const q = "SELECT * FROM t WHERE id = " + id;',
      ].join("\n"),
    );
    // 22 + 20 + 18 = 60, exactly the critical cap, so nothing else is deducted.
    expect(threeCriticals.score).toBe(40);

    // A fourth critical finding must not push the score any lower.
    const fourCriticals = analyze(
      [
        'const apiKey = "sk_live_abcdef123456";',
        "eval(a);",
        "eval(b);",
        'const q = "SELECT * FROM t WHERE id = " + id;',
      ].join("\n"),
    );
    expect(fourCriticals.score).toBe(40);
  });
});

describe("shareText", () => {
  it("includes the score and grade", () => {
    const result = analyze("const x = eval(y);");
    const text = shareText(result);
    expect(text).toContain(`${result.score}/100`);
    expect(text).toContain(result.grade);
  });

  it("handles the empty result", () => {
    expect(shareText(analyze(""))).toContain("CodeRoast");
  });
});
