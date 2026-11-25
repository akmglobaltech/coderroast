import { describe, expect, it } from "vitest";
import { analyze, computeStats, detectLanguage, gradeFor, shareText } from "./roast";
import { SAMPLES } from "./samples";

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

  it("prefers typescript over javascript for annotated code", () => {
    const ts = "export function add(a: number, b: number): number {\n  return a + b;\n}";
    expect(detectLanguage(ts)).toBe("typescript");
  });

  it("prefers typescript for type aliases and generics", () => {
    expect(detectLanguage("type Id = string;\nconst ids: Id[] = [];")).toBe("typescript");
    expect(detectLanguage("const x = new Map<string, number>();")).toBe("typescript");
  });

  it("still reports plain javascript when no type syntax is present", () => {
    expect(detectLanguage("const x = 1;\nfunction f(a) { return a + x; }")).toBe("javascript");
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

  it("keeps reported line numbers aligned when the snippet starts with blank lines", () => {
    const result = analyze("\n\n\nvar x = 1;\n");
    const varFinding = result.findings.find((f) => f.id === "var");
    expect(varFinding).toBeDefined();
    // The `var` sits on the 4th line of the pasted text, not the 1st.
    expect(varFinding?.line).toBe(4);
  });

  it("ignores trailing blank lines when counting lines", () => {
    const result = analyze("const a = 1;\n\n\n");
    expect(result.stats.lines).toBe(1);
  });
});

describe("language scoping", () => {
  it("does not run JavaScript rules on CSS", () => {
    const css = ["#app {", "  color: red;", "}", "var { color: blue; }"].join("\n");
    const result = analyze(css, "css");
    expect(result.language).toBe("css");
    expect(result.findings.some((f) => f.id === "var")).toBe(false);
    expect(result.findings.some((f) => f.id === "console")).toBe(false);
  });

  it("does not run CSS rules on JavaScript", () => {
    const js = 'const s = "!important";\nconst t = "float: left;";';
    const result = analyze(js, "javascript");
    expect(result.findings.some((f) => f.id === "css-important")).toBe(false);
    expect(result.findings.some((f) => f.id === "css-float-layout")).toBe(false);
  });

  it("does not run HTML rules on JavaScript", () => {
    const js = 'const tpl = "<font>hi</font>";';
    const result = analyze(js, "javascript");
    expect(result.findings.some((f) => f.id === "html-deprecated-tags")).toBe(false);
  });

  it("does not run SQL rules on JavaScript", () => {
    const js = 'const q = "SELECT * FROM users";';
    const result = analyze(js, "javascript");
    expect(result.findings.some((f) => f.id === "sql-select-star")).toBe(false);
  });

  it("still runs language-agnostic rules everywhere", () => {
    const css = "/* TODO: tidy this up */\n#app { color: red; }";
    const result = analyze(css, "css");
    expect(result.findings.some((f) => f.id === "todo")).toBe(true);
  });
});

describe("html rules", () => {
  const html = (body: string) => analyze(body, "html");

  it("flags a missing doctype", () => {
    expect(html("<html><body>hi</body></html>").findings.some((f) => f.id === "html-doctype")).toBe(true);
    expect(html("<!DOCTYPE html>\n<html><body>hi</body></html>").findings.some((f) => f.id === "html-doctype")).toBe(
      false,
    );
  });

  it("flags deprecated tags", () => {
    const result = html("<!DOCTYPE html>\n<html lang='en'><body><center><font color='red'>hi</font></center></body></html>");
    expect(result.findings.some((f) => f.id === "html-deprecated-tags")).toBe(true);
  });

  it("flags inline styles", () => {
    const result = html('<div style="color:red"></div><p style="margin:0"></p>');
    expect(result.findings.some((f) => f.id === "html-inline-style")).toBe(true);
  });

  it("flags inline event handlers", () => {
    const result = html('<button onclick="go()">Go</button>');
    expect(result.findings.some((f) => f.id === "html-inline-handlers")).toBe(true);
  });

  it("flags images without alt text", () => {
    const result = html('<img src="a.png"><img src="b.png" alt="b">');
    const finding = result.findings.find((f) => f.id === "html-missing-alt");
    expect(finding).toBeDefined();
    expect(finding?.detail).toContain("1 of 2");
  });

  it("flags table-based layout", () => {
    const result = html('<table role="presentation"><tr><td>hi</td></tr></table>');
    expect(result.findings.some((f) => f.id === "html-table-layout")).toBe(true);
  });

  it("flags XHTML self-closing tags only when there are several", () => {
    expect(html("<img src='a.png' /><br />").findings.some((f) => f.id === "html-unclosed-void")).toBe(false);
    expect(html("<img src='a.png' /><br /><hr /><input />").findings.some((f) => f.id === "html-unclosed-void")).toBe(
      true,
    );
  });

  it("flags jQuery from a CDN", () => {
    const result = html('<script src="https://code.jquery.com/jquery-1.12.4.min.js"></script>');
    expect(result.findings.some((f) => f.id === "html-jquery-cdn")).toBe(true);
  });

  it("flags stacked <br> used for spacing", () => {
    expect(html("<p>a</p><br><br><p>b</p>").findings.some((f) => f.id === "html-br-spacing")).toBe(true);
  });

  it("flags <html> without lang", () => {
    expect(html("<!DOCTYPE html>\n<html><body>x</body></html>").findings.some((f) => f.id === "html-missing-lang")).toBe(
      true,
    );
    expect(
      html("<!DOCTYPE html>\n<html lang='en'><body>x</body></html>").findings.some((f) => f.id === "html-missing-lang"),
    ).toBe(false);
  });
});

describe("css rules", () => {
  const css = (body: string) => analyze(body, "css");

  it("flags !important", () => {
    expect(css(".a { color: red !important; }").findings.some((f) => f.id === "css-important")).toBe(true);
  });

  it("flags ID selectors", () => {
    const result = css("#a { color: red; }\n#b { color: blue; }");
    expect(result.findings.some((f) => f.id === "css-id-selectors")).toBe(true);
  });

  it("flags px-heavy stylesheets", () => {
    const result = css(".a { font-size: 12px; padding: 4px; margin: 8px; width: 100px; height: 50px; top: 3px; }");
    expect(result.findings.some((f) => f.id === "css-px-units")).toBe(true);
  });

  it("flags float layout", () => {
    expect(css(".a { float: left; }").findings.some((f) => f.id === "css-float-layout")).toBe(true);
  });

  it("flags the universal selector", () => {
    expect(css("* { box-sizing: border-box; }").findings.some((f) => f.id === "css-universal-selector")).toBe(true);
  });

  it("flags vendor prefix spam", () => {
    const result = css(
      ".a { -webkit-box-shadow: none; -moz-box-shadow: none; -ms-box-shadow: none; -o-box-shadow: none; }",
    );
    expect(result.findings.some((f) => f.id === "css-vendor-prefix-spam")).toBe(true);
  });

  it("flags z-index arms races", () => {
    expect(css(".a { z-index: 9999; }").findings.some((f) => f.id === "css-zindex-madness")).toBe(true);
  });

  it("flags named colours", () => {
    const result = css(".a { color: red; background: blue; border-color: green; }");
    expect(result.findings.some((f) => f.id === "css-named-colors")).toBe(true);
  });

  it("does not count ID selectors as comments", () => {
    const stats = computeStats("#app { color: red; }\n#main { color: blue; }");
    expect(stats.commentLines).toBe(0);
    expect(stats.codeLines).toBe(2);
  });

  it("still counts real CSS comments", () => {
    const stats = computeStats("/* note */\n#app { color: red; }");
    expect(stats.commentLines).toBe(1);
  });

  it("still counts SQL -- comments", () => {
    const stats = computeStats("-- note\nSELECT 1;");
    expect(stats.commentLines).toBe(1);
  });
});

describe("sql rules", () => {
  const sql = (body: string) => analyze(body, "sql");

  it("flags SELECT *", () => {
    expect(sql("SELECT * FROM users;").findings.some((f) => f.id === "sql-select-star")).toBe(true);
  });

  it("flags UPDATE/DELETE without WHERE", () => {
    expect(sql("DELETE FROM sessions;").findings.some((f) => f.id === "sql-no-where")).toBe(true);
    expect(sql("DELETE FROM sessions WHERE id = 1;").findings.some((f) => f.id === "sql-no-where")).toBe(false);
  });

  it("flags leading-wildcard LIKE", () => {
    expect(sql("SELECT id FROM users WHERE email LIKE '%@x.com';").findings.some((f) => f.id === "sql-leading-wildcard")).toBe(
      true,
    );
  });

  it("flags comma joins", () => {
    expect(sql("SELECT * FROM users u, orders o WHERE u.id = o.user_id;").findings.some((f) => f.id === "sql-cartesian-join")).toBe(
      true,
    );
  });

  it("flags sensitive columns in the projection", () => {
    expect(sql("SELECT id, password FROM users;").findings.some((f) => f.id === "sql-sensitive-columns")).toBe(true);
  });
});

describe("samples", () => {
  const cases = Object.entries(SAMPLES).filter(([key]) => key !== "auto" && key !== "unknown");

  it("covers every language", () => {
    expect(cases.length).toBe(12);
  });

  for (const [language, sample] of cases) {
    it(`loads a real ${language} sample that roasts badly`, () => {
      const result = analyze(sample);
      expect(result.language).toBe(language);
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(60);
    });
  }
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

  it("appends the share url when one is given", () => {
    const text = shareText(analyze("const x = eval(y);"), "https://coderroast.app");
    expect(text).toContain("https://coderroast.app");
  });

  it("never leaves a dangling colon when no url is given", () => {
    expect(shareText(analyze("const x = eval(y);"))).not.toMatch(/:\s*$/);
  });
});
