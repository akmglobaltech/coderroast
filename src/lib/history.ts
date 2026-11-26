/**
 * Local roast history.
 *
 * Everything lives in `localStorage` on the visitor's own machine — there is
 * no account and no server, so this is the only way the tool can remember
 * anything between visits. Storage is injected so the module stays testable
 * in a plain Node environment.
 */

import type { Language, RoastResult } from "./roast";

export const HISTORY_KEY = "coderroast:history";
export const MAX_HISTORY = 60;

export interface HistoryEntry {
  /** Epoch milliseconds; also the identity of the entry. */
  at: number;
  score: number;
  grade: string;
  language: Language;
  findings: number;
  lines: number;
  chars: number;
}

/** The slice of the Storage API this module needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface HistorySummary {
  count: number;
  best: HistoryEntry | null;
  worst: HistoryEntry | null;
  average: number;
  /** Last score minus the one before it; 0 when there is nothing to compare. */
  delta: number;
  /** Oldest-to-newest scores, ready to plot. */
  series: number[];
}

function isEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.at === "number" &&
    typeof e.score === "number" &&
    typeof e.grade === "string" &&
    typeof e.language === "string" &&
    typeof e.findings === "number" &&
    typeof e.lines === "number" &&
    typeof e.chars === "number"
  );
}

/** Returns `localStorage` when it exists and is usable, otherwise null. */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const probe = "coderroast:probe";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    // Private mode, disabled storage, or a sandboxed iframe.
    return null;
  }
}

export function loadHistory(store: StorageLike | null = defaultStorage()): HistoryEntry[] {
  if (!store) return [];
  try {
    const raw = store.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(-MAX_HISTORY);
  } catch {
    return [];
  }
}

export function saveHistory(
  entries: HistoryEntry[],
  store: StorageLike | null = defaultStorage(),
): void {
  if (!store) return;
  try {
    store.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-MAX_HISTORY)));
  } catch {
    // Quota exceeded or storage disabled — history is a nicety, never fatal.
  }
}

export function clearHistory(store: StorageLike | null = defaultStorage()): void {
  if (!store) return;
  try {
    store.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Appends a roast unless it repeats the previous one. Live analysis re-runs on
 * every keystroke, so without this the history would be 40 identical rows.
 */
export function appendEntry(
  entries: HistoryEntry[],
  result: RoastResult,
  code: string,
  at: number,
): HistoryEntry[] {
  if (result.empty) return entries;
  const last = entries[entries.length - 1];
  if (
    last &&
    last.score === result.score &&
    last.grade === result.grade &&
    last.language === result.language
  ) {
    return entries;
  }
  const entry: HistoryEntry = {
    at,
    score: result.score,
    grade: result.grade,
    language: result.language,
    findings: result.findings.length,
    lines: result.stats.lines,
    chars: code.length,
  };
  return [...entries, entry].slice(-MAX_HISTORY);
}

export function summarize(entries: HistoryEntry[]): HistorySummary {
  if (entries.length === 0) {
    return { count: 0, best: null, worst: null, average: 0, delta: 0, series: [] };
  }
  let best = entries[0];
  let worst = entries[0];
  let total = 0;
  for (const e of entries) {
    if (e.score > best.score) best = e;
    if (e.score < worst.score) worst = e;
    total += e.score;
  }
  const series = entries.map((e) => e.score);
  const delta =
    series.length >= 2 ? series[series.length - 1] - series[series.length - 2] : 0;
  return {
    count: entries.length,
    best,
    worst,
    average: Math.round(total / entries.length),
    delta,
    series,
  };
}

/** Maps a score series onto an SVG polyline inside a `w`×`h` box. */
export function sparklinePoints(series: number[], w: number, h: number): string {
  if (series.length === 0) return "";
  if (series.length === 1) return `0,${h / 2} ${w},${h / 2}`;
  const step = w / (series.length - 1);
  return series
    .map((score, i) => {
      const x = i * step;
      const y = h - (Math.max(0, Math.min(100, score)) / 100) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
