import { describe, expect, it } from "vitest";
import {
  HASH_KEY,
  MAX_LINK_CODE,
  buildRoastUrl,
  decodeRoast,
  encodeRoast,
  readRoastHash,
} from "./permalink";

const BASE = "https://akmglobaltech.github.io/coderroast";

describe("encodeRoast / decodeRoast", () => {
  it("round-trips code and language", () => {
    const code = "const x = 1;\nconsole.log(x);\n";
    const payload = encodeRoast(code, "typescript");
    expect(payload).toBeTruthy();
    expect(decodeRoast(payload!)).toEqual({ code, language: "typescript" });
  });

  it("round-trips every language key", () => {
    const languages = [
      "auto", "typescript", "javascript", "python", "java", "csharp",
      "go", "rust", "php", "ruby", "sql", "html", "css",
    ] as const;
    for (const language of languages) {
      const payload = encodeRoast("x = 1", language);
      expect(decodeRoast(payload!)?.language).toBe(language);
    }
  });

  it("preserves unicode and newlines exactly", () => {
    const code = "// 🔥 বাংলা\nconst café = 'naïve';\n\tif (x) {}\n";
    const payload = encodeRoast(code, "javascript");
    expect(decodeRoast(payload!)?.code).toBe(code);
  });

  it("produces a URL-safe payload", () => {
    const payload = encodeRoast("function f(a,b){return a+b}", "javascript")!;
    expect(payload).toMatch(/^[A-Za-z0-9+\-$_.!*'()%,;:@&=]*$/);
    expect(payload).not.toContain("#");
    expect(payload).not.toContain(" ");
  });

  it("compresses repetitive code well below its raw size", () => {
    const code = "console.log('debug');\n".repeat(40);
    const payload = encodeRoast(code, "javascript")!;
    expect(payload.length).toBeLessThan(code.length / 2);
  });

  it("refuses empty or whitespace-only code", () => {
    expect(encodeRoast("", "auto")).toBeNull();
    expect(encodeRoast("   \n\t ", "auto")).toBeNull();
  });

  it("refuses code past the size cap", () => {
    expect(encodeRoast("a".repeat(MAX_LINK_CODE + 1), "auto")).toBeNull();
    expect(encodeRoast("a".repeat(MAX_LINK_CODE), "auto")).toBeTruthy();
  });

  it("returns null for garbage payloads instead of throwing", () => {
    expect(decodeRoast("")).toBeNull();
    expect(decodeRoast("not-a-real-payload")).toBeNull();
    expect(decodeRoast("%%%%")).toBeNull();
  });

  it("returns null when the payload decodes to non-JSON", () => {
    // A valid lz-string of a plain string, not an object.
    const payload = encodeRoast("x", "auto")!;
    expect(decodeRoast(payload.slice(0, 4))).toBeNull();
  });

  it("falls back to auto for an unknown language", () => {
    const payload = encodeRoast("x = 1", "auto")!;
    const decoded = decodeRoast(payload)!;
    expect(decoded.language).toBe("auto");
  });
});

describe("buildRoastUrl", () => {
  it("appends the payload as a hash, never a query string", () => {
    const url = buildRoastUrl(BASE, "const x = 1;", "javascript")!;
    expect(url.startsWith(`${BASE}#${HASH_KEY}=`)).toBe(true);
    expect(url).not.toContain("?");
  });

  it("replaces an existing hash rather than stacking", () => {
    const url = buildRoastUrl(`${BASE}#r=stale`, "const x = 1;", "javascript")!;
    expect(url.match(/#/g)).toHaveLength(1);
  });

  it("returns null when the code cannot be encoded", () => {
    expect(buildRoastUrl(BASE, "", "auto")).toBeNull();
  });
});

describe("readRoastHash", () => {
  it("reads a roast out of a location hash", () => {
    const url = buildRoastUrl(BASE, "var a = 1;", "javascript")!;
    const hash = url.slice(url.indexOf("#"));
    expect(readRoastHash(hash)).toEqual({ code: "var a = 1;", language: "javascript" });
  });

  it("ignores unrelated hashes", () => {
    expect(readRoastHash("")).toBeNull();
    expect(readRoastHash("#section-2")).toBeNull();
    expect(readRoastHash("#r=")).toBeNull();
  });
});
