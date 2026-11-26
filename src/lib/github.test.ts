import { describe, expect, it } from "vitest";
import { languageFromPath, parseGitHubUrl } from "./github";

describe("parseGitHubUrl", () => {
  it("parses a blob URL", () => {
    expect(parseGitHubUrl("https://github.com/vercel/next.js/blob/canary/packages/next/src/index.ts"))
      .toEqual({
        owner: "vercel",
        repo: "next.js",
        ref: "canary",
        path: "packages/next/src/index.ts",
      });
  });

  it("parses a blob URL without a scheme", () => {
    expect(parseGitHubUrl("github.com/facebook/react/blob/main/src/React.js")).toEqual({
      owner: "facebook",
      repo: "react",
      ref: "main",
      path: "src/React.js",
    });
  });

  it("parses a raw.githubusercontent URL", () => {
    expect(parseGitHubUrl("https://raw.githubusercontent.com/owner/repo/main/src/app.py")).toEqual({
      owner: "owner",
      repo: "repo",
      ref: "main",
      path: "src/app.py",
    });
  });

  it("strips a line-range fragment", () => {
    expect(parseGitHubUrl("https://github.com/o/r/blob/main/a/b.ts#L10-L40")?.path).toBe("a/b.ts");
  });

  it("strips a query string", () => {
    expect(parseGitHubUrl("https://github.com/o/r/blob/main/a.ts?plain=1")?.path).toBe("a.ts");
  });

  it("parses a bare owner/repo/path", () => {
    expect(parseGitHubUrl("owner/repo/src/main.go")).toEqual({
      owner: "owner",
      repo: "repo",
      path: "src/main.go",
    });
  });

  it("rejects a bare owner/repo with no file", () => {
    expect(parseGitHubUrl("owner/repo")).toBeNull();
  });

  it("rejects a bare path with no known extension", () => {
    expect(parseGitHubUrl("owner/repo/src")).toBeNull();
  });

  it("rejects empty and unrelated input", () => {
    expect(parseGitHubUrl("")).toBeNull();
    expect(parseGitHubUrl("   ")).toBeNull();
    expect(parseGitHubUrl("https://example.com/foo.ts")).toBeNull();
    expect(parseGitHubUrl("just some words")).toBeNull();
  });

  it("rejects a repo URL with no file path", () => {
    expect(parseGitHubUrl("https://github.com/owner/repo")).toBeNull();
  });

  it("handles a path with spaces and unicode", () => {
    expect(parseGitHubUrl("https://github.com/o/r/blob/main/src/my file.ts")?.path).toBe(
      "src/my file.ts",
    );
  });
});

describe("languageFromPath", () => {
  it("maps common extensions", () => {
    expect(languageFromPath("a/b.ts")).toBe("typescript");
    expect(languageFromPath("a/b.tsx")).toBe("typescript");
    expect(languageFromPath("a/b.js")).toBe("javascript");
    expect(languageFromPath("a/b.py")).toBe("python");
    expect(languageFromPath("a/b.cs")).toBe("csharp");
    expect(languageFromPath("a/b.go")).toBe("go");
    expect(languageFromPath("a/b.rs")).toBe("rust");
    expect(languageFromPath("a/b.rb")).toBe("ruby");
    expect(languageFromPath("a/b.sql")).toBe("sql");
    expect(languageFromPath("a/b.html")).toBe("html");
    expect(languageFromPath("a/b.css")).toBe("css");
  });

  it("is case-insensitive", () => {
    expect(languageFromPath("A/B.TS")).toBe("typescript");
  });

  it("returns null for unknown extensions", () => {
    expect(languageFromPath("a/b.md")).toBeNull();
    expect(languageFromPath("a/b")).toBeNull();
  });
});
