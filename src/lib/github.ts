/**
 * "Roast a file straight from GitHub."
 *
 * Fetches a single public file through the GitHub REST API from the browser.
 * No token, no proxy, no server — which also means the unauthenticated rate
 * limit (60 requests/hour per IP) applies, so failures are surfaced plainly
 * instead of being retried.
 */

export interface GitHubTarget {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export type GitHubErrorKind = "invalid" | "not-found" | "rate-limit" | "too-big" | "network";

export class GitHubFetchError extends Error {
  kind: GitHubErrorKind;

  constructor(kind: GitHubErrorKind, message: string) {
    super(message);
    this.name = "GitHubFetchError";
    this.kind = kind;
  }
}

/** Files above this are not worth roasting and would blow up the URL hash. */
export const MAX_FILE_BYTES = 200_000;

const EXTENSIONS = [
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "java", "cs", "go", "rs",
  "php", "rb", "sql", "html", "htm", "css", "scss", "json", "yml", "yaml",
  "sh", "kt", "swift", "c", "h", "cpp", "hpp",
];

/**
 * Accepts the shapes people actually paste:
 *   https://github.com/owner/repo/blob/main/src/app.ts
 *   https://github.com/owner/repo/blob/main/src/app.ts#L10-L40
 *   https://raw.githubusercontent.com/owner/repo/main/src/app.ts
 *   github.com/owner/repo/blob/main/src/app.ts
 *   owner/repo/src/app.ts
 */
export function parseGitHubUrl(input: string): GitHubTarget | null {
  const text = input.trim();
  if (!text) return null;

  const raw = text.match(
    /^(?:https?:\/\/)?raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/(.+)$/i,
  );
  if (raw) {
    const [, owner, repo, ref, path] = raw;
    return { owner, repo, ref, path: stripQuery(path) };
  }

  const blob = text.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/(?:blob|raw)\/([^/\s]+)\/(.+)$/i,
  );
  if (blob) {
    const [, owner, repo, ref, path] = blob;
    return { owner, repo, ref, path: stripQuery(path) };
  }

  // Bare `owner/repo/path/to/file.ext` — only when it looks like a real file.
  const bare = text.match(/^([\w.-]+)\/([\w.-]+)\/(.+)$/);
  if (bare) {
    const [, owner, repo, path] = bare;
    if (looksLikeFile(path)) return { owner, repo, path: stripQuery(path) };
  }

  return null;
}

function stripQuery(path: string): string {
  return path.replace(/[?#].*$/, "");
}

function looksLikeFile(path: string): boolean {
  const ext = path.split(".").pop()?.toLowerCase();
  return Boolean(ext && EXTENSIONS.includes(ext));
}

/** Best-effort language hint from the file extension. */
export function languageFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    java: "java",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    sql: "sql",
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
  };
  return map[ext] ?? null;
}

export interface FetchedFile {
  code: string;
  path: string;
  language: string | null;
}

/** Throws `GitHubFetchError` with a user-facing message. */
export async function fetchGitHubFile(
  target: GitHubTarget,
  signal?: AbortSignal,
): Promise<FetchedFile> {
  const ref = target.ref ? `?ref=${encodeURIComponent(target.ref)}` : "";
  const url = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(
    target.repo,
  )}/contents/${target.path.split("/").map(encodeURIComponent).join("/")}${ref}`;

  let res: Response;
  try {
    res = await fetch(url, {
      signal,
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new GitHubFetchError("network", "Could not reach GitHub. Check your connection.");
  }

  if (res.status === 404) {
    throw new GitHubFetchError(
      "not-found",
      "That file is not public, or the path is wrong. Private repos need a token, which this tool never asks for.",
    );
  }
  if (res.status === 403 || res.status === 429) {
    throw new GitHubFetchError(
      "rate-limit",
      "GitHub's anonymous rate limit is used up (60 files/hour per IP). Try again in a few minutes.",
    );
  }
  if (!res.ok) {
    throw new GitHubFetchError("network", `GitHub returned ${res.status}. Try again.`);
  }

  const data = (await res.json()) as {
    type?: string;
    size?: number;
    encoding?: string;
    content?: string;
  };

  if (data.type && data.type !== "file") {
    throw new GitHubFetchError("invalid", "That path is a folder. Point at a single file.");
  }
  if (typeof data.size === "number" && data.size > MAX_FILE_BYTES) {
    throw new GitHubFetchError(
      "too-big",
      `That file is ${Math.round(data.size / 1024)} kB. Keep it under ${MAX_FILE_BYTES / 1000} kB.`,
    );
  }
  if (data.encoding !== "base64" || typeof data.content !== "string") {
    throw new GitHubFetchError("invalid", "GitHub did not return file contents for that path.");
  }

  const code = decodeBase64Utf8(data.content);
  if (!code.trim()) {
    throw new GitHubFetchError("invalid", "That file is empty — nothing to roast.");
  }

  return { code, path: target.path, language: languageFromPath(target.path) };
}

/** `atob` yields latin-1; round-trip through bytes so UTF-8 survives. */
function decodeBase64Utf8(base64: string): string {
  const clean = base64.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
