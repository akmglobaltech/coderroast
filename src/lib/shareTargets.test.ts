import { describe, expect, it } from "vitest";
import { SHARE_TARGETS } from "./shareTargets";

const TEXT = "I scored 0/100 (F) on CodeRoast. # code & <html>";
const URL = "https://akmglobalgit.github.io/coderroast/";

const byId = (id: string) => {
  const target = SHARE_TARGETS.find((t) => t.id === id);
  if (!target) throw new Error(`missing share target: ${id}`);
  return target;
};

describe("SHARE_TARGETS", () => {
  it("exposes unique ids and labels", () => {
    const ids = SHARE_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of SHARE_TARGETS) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it("builds an https URL for every target", () => {
    for (const t of SHARE_TARGETS) {
      const href = t.href(TEXT, URL);
      expect(href.startsWith("https://")).toBe(true);
      expect(href).not.toContain(" ");
      expect(href).not.toContain("#");
    }
  });

  it("encodes the URL in every target", () => {
    for (const t of SHARE_TARGETS) {
      expect(t.href(TEXT, URL)).toContain(encodeURIComponent(URL));
    }
  });

  it("encodes reserved characters in the text", () => {
    for (const t of SHARE_TARGETS) {
      const href = t.href(TEXT, URL);
      if (href.includes(encodeURIComponent(TEXT))) continue;
      // Targets that drop the text must not leak it raw either.
      expect(href).not.toContain("# code");
      expect(href).not.toContain("<html>");
    }
  });

  it("sends text and url to X", () => {
    const href = byId("x").href(TEXT, URL);
    expect(href).toContain(`text=${encodeURIComponent(TEXT)}`);
    expect(href).toContain(`url=${encodeURIComponent(URL)}`);
  });

  it("sends only the url to LinkedIn and Facebook", () => {
    for (const id of ["linkedin", "facebook"]) {
      const href = byId(id).href(TEXT, URL);
      expect(href).toContain(encodeURIComponent(URL));
      expect(href).not.toContain(encodeURIComponent(TEXT));
    }
  });

  it("combines text and url into one WhatsApp parameter", () => {
    const href = byId("whatsapp").href(TEXT, URL);
    expect(href).toContain(`text=${encodeURIComponent(`${TEXT} ${URL}`)}`);
  });

  it("sends text and url to Telegram, Reddit and Hacker News", () => {
    expect(byId("telegram").href(TEXT, URL)).toContain(`text=${encodeURIComponent(TEXT)}`);
    expect(byId("reddit").href(TEXT, URL)).toContain(`title=${encodeURIComponent(TEXT)}`);
    expect(byId("hackernews").href(TEXT, URL)).toContain(`t=${encodeURIComponent(TEXT)}`);
  });
});
