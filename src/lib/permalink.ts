/**
 * Roast permalinks.
 *
 * The whole roast is encoded into the URL *hash*, never the query string, so
 * the payload is never sent to a server — the privacy promise survives sharing.
 * lz-string keeps a 1 kB snippet down to a few hundred URL-safe characters.
 */

import LZString from "lz-string";
import type { Language, RoastResult } from "./roast";

/** Hash key. Short so the link stays readable when pasted into a chat. */
export const HASH_KEY = "r";

/** Past this the URL gets unwieldy and some chat clients truncate it. */
export const MAX_LINK_CODE = 12_000;

export interface RoastLink {
  code: string;
  language: Language | "auto";
}

const KNOWN_LANGUAGES: ReadonlySet<string> = new Set<string>([
  "auto",
  "typescript",
  "javascript",
  "python",
  "java",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
  "sql",
  "html",
  "css",
  "unknown",
]);

interface Payload {
  c: string;
  l: string;
}

/** Returns the URL-safe payload, or null when the code is empty or too long. */
export function encodeRoast(code: string, language: Language | "auto"): string | null {
  if (!code.trim()) return null;
  if (code.length > MAX_LINK_CODE) return null;
  const payload: Payload = { c: code, l: language };
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload)) || null;
}

/** Never throws: a corrupt or hostile payload simply yields null. */
export function decodeRoast(payload: string): RoastLink | null {
  if (!payload) return null;

  let raw: string | null;
  try {
    raw = LZString.decompressFromEncodedURIComponent(payload);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const { c, l } = parsed as Partial<Payload>;
  if (typeof c !== "string" || !c.trim()) return null;
  if (c.length > MAX_LINK_CODE) return null;

  const language =
    typeof l === "string" && KNOWN_LANGUAGES.has(l) ? (l as Language | "auto") : "auto";

  return { code: c, language };
}

/** Full shareable URL, or null when the snippet is too big to carry. */
export function buildRoastUrl(
  base: string,
  code: string,
  language: Language | "auto",
): string | null {
  const payload = encodeRoast(code, language);
  if (!payload) return null;
  return `${base.replace(/#.*$/, "")}#${HASH_KEY}=${payload}`;
}

/** Reads a roast out of `window.location.hash`. */
export function readRoastHash(hash: string): RoastLink | null {
  const prefix = `#${HASH_KEY}=`;
  if (!hash.startsWith(prefix)) return null;
  return decodeRoast(hash.slice(prefix.length));
}

/**
 * The challenge line. Deliberately taunts the reader into clicking, because a
 * link nobody clicks is not a growth feature.
 */
export function challengeText(result: RoastResult, url: string): string {
  if (result.empty) return `Think your code is cleaner than mine? ${url}`;
  const worst = result.findings[0]?.title;
  return [
    `My code scored ${result.score}/100 (${result.grade}) on CodeRoast.`,
    worst ? `Worst crime: ${worst}.` : "",
    `Think yours is cleaner? Prove it: ${url}`,
  ]
    .filter(Boolean)
    .join("\n");
}
