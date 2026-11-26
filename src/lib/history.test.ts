import { describe, expect, it } from "vitest";
import {
  HISTORY_KEY,
  MAX_HISTORY,
  appendEntry,
  clearHistory,
  defaultStorage,
  loadHistory,
  saveHistory,
  sparklinePoints,
  summarize,
  type HistoryEntry,
  type StorageLike,
} from "./history";
import { analyze } from "./roast";

function memoryStore(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

function entry(at: number, score: number): HistoryEntry {
  return { at, score, grade: "C", language: "javascript", findings: 2, lines: 10, chars: 100 };
}

describe("history storage", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(loadHistory(memoryStore())).toEqual([]);
  });

  it("round-trips entries", () => {
    const store = memoryStore();
    saveHistory([entry(1, 80), entry(2, 70)], store);
    expect(loadHistory(store).map((e) => e.score)).toEqual([80, 70]);
  });

  it("survives corrupt JSON", () => {
    const store = memoryStore();
    store.setItem(HISTORY_KEY, "{not json");
    expect(loadHistory(store)).toEqual([]);
  });

  it("drops entries that are not shaped like history", () => {
    const store = memoryStore();
    store.setItem(HISTORY_KEY, JSON.stringify([entry(1, 80), { nope: true }, null, 42]));
    expect(loadHistory(store)).toHaveLength(1);
  });

  it("ignores a non-array payload", () => {
    const store = memoryStore();
    store.setItem(HISTORY_KEY, JSON.stringify({ score: 1 }));
    expect(loadHistory(store)).toEqual([]);
  });

  it("caps the stored list", () => {
    const store = memoryStore();
    const many = Array.from({ length: MAX_HISTORY + 20 }, (_, i) => entry(i, 50));
    saveHistory(many, store);
    expect(loadHistory(store)).toHaveLength(MAX_HISTORY);
  });

  it("clears", () => {
    const store = memoryStore();
    saveHistory([entry(1, 80)], store);
    clearHistory(store);
    expect(loadHistory(store)).toEqual([]);
  });

  it("is a no-op without storage", () => {
    expect(loadHistory(null)).toEqual([]);
    expect(() => saveHistory([entry(1, 80)], null)).not.toThrow();
    expect(() => clearHistory(null)).not.toThrow();
  });

  it("swallows a throwing store", () => {
    const hostile: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadHistory(hostile)).toEqual([]);
    expect(() => saveHistory([entry(1, 80)], hostile)).not.toThrow();
    expect(() => clearHistory(hostile)).not.toThrow();
  });

  it("defaultStorage is null outside a browser", () => {
    expect(defaultStorage()).toBeNull();
  });
});

describe("appendEntry", () => {
  const result = analyze("var x = 1;\neval('2');");

  it("appends a real roast", () => {
    const next = appendEntry([], result, "var x = 1;\neval('2');", 1000);
    expect(next).toHaveLength(1);
    expect(next[0].score).toBe(result.score);
    expect(next[0].at).toBe(1000);
  });

  it("skips an empty result", () => {
    expect(appendEntry([], analyze(""), "", 1000)).toEqual([]);
  });

  it("skips a repeat of the previous entry", () => {
    const once = appendEntry([], result, "var x = 1;\neval('2');", 1000);
    const twice = appendEntry(once, result, "var x = 1;\neval('2');", 2000);
    expect(twice).toHaveLength(1);
  });

  it("appends when the score changes", () => {
    const once = appendEntry([], result, "var x = 1;\neval('2');", 1000);
    const better = analyze("const x = 1;");
    const twice = appendEntry(once, better, "const x = 1;", 2000);
    expect(twice).toHaveLength(2);
  });

  it("caps growth", () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY + 10; i++) {
      entries = appendEntry(entries, { ...result, score: i }, "x", i);
    }
    expect(entries).toHaveLength(MAX_HISTORY);
  });
});

describe("summarize", () => {
  it("handles an empty history", () => {
    expect(summarize([])).toEqual({
      count: 0,
      best: null,
      worst: null,
      average: 0,
      delta: 0,
      series: [],
    });
  });

  it("finds best, worst, average and delta", () => {
    const s = summarize([entry(1, 40), entry(2, 90), entry(3, 65)]);
    expect(s.count).toBe(3);
    expect(s.best?.score).toBe(90);
    expect(s.worst?.score).toBe(40);
    expect(s.average).toBe(65);
    expect(s.delta).toBe(-25);
    expect(s.series).toEqual([40, 90, 65]);
  });

  it("reports zero delta for a single entry", () => {
    expect(summarize([entry(1, 70)]).delta).toBe(0);
  });
});

describe("sparklinePoints", () => {
  it("returns nothing for an empty series", () => {
    expect(sparklinePoints([], 100, 20)).toBe("");
  });

  it("draws a flat line for one point", () => {
    expect(sparklinePoints([50], 100, 20)).toBe("0,10 100,10");
  });

  it("maps 100 to the top and 0 to the bottom", () => {
    expect(sparklinePoints([100, 0], 100, 20)).toBe("0.0,0.0 100.0,20.0");
  });

  it("clamps out-of-range scores", () => {
    expect(sparklinePoints([200, -50], 100, 20)).toBe("0.0,0.0 100.0,20.0");
  });
});
