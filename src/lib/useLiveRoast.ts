import { useCallback, useEffect, useRef, useState } from "react";
import { analyze, type Language, type RoastResult } from "./roast";
import type { RoastRequest, RoastResponse } from "./worker";

const DEBOUNCE_MS = 220;
const WATCHDOG_MS = 4000;

/** `null` means the worker died and the caller should fall back to the main thread. */
type Listener = (response: RoastResponse | null) => void;

// One worker is shared by every hook instance and lives for the lifetime of the
// page. Creating it at module scope keeps it alive across React StrictMode's
// mount/unmount cycle, which would otherwise terminate a worker with a request
// still in flight and leave the UI stuck on "analyzing".
let sharedWorker: Worker | null = null;
let workerBroken = false;
const listeners = new Set<Listener>();

function notify(response: RoastResponse | null) {
  for (const listener of listeners) listener(response);
}

function getWorker(): Worker | null {
  if (sharedWorker || workerBroken) return sharedWorker;
  try {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<RoastResponse>) => {
      notify(event.data);
    });
    worker.addEventListener("error", () => {
      workerBroken = true;
      sharedWorker = null;
      notify(null);
    });
    sharedWorker = worker;
  } catch {
    workerBroken = true;
    sharedWorker = null;
  }
  return sharedWorker;
}

interface LiveRoast {
  result: RoastResult | null;
  pending: boolean;
  flush: () => void;
}

export function useLiveRoast(code: string, language: Language | "auto"): LiveRoast {
  const [result, setResult] = useState<RoastResult | null>(null);
  const [pending, setPending] = useState(false);

  const latestId = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const watchdogRef = useRef<number | undefined>(undefined);
  const inputRef = useRef({ code, language });
  inputRef.current = { code, language };

  const settle = useCallback((id: number, next: RoastResult) => {
    if (id !== latestId.current) return;
    window.clearTimeout(watchdogRef.current);
    setResult(next);
    setPending(false);
  }, []);

  const run = useCallback(() => {
    const { code: current, language: currentLanguage } = inputRef.current;
    if (!current.trim()) {
      latestId.current += 1;
      window.clearTimeout(watchdogRef.current);
      setResult(null);
      setPending(false);
      return;
    }

    const id = (latestId.current += 1);
    const hint = currentLanguage === "auto" ? undefined : currentLanguage;
    const worker = getWorker();

    if (!worker) {
      settle(id, analyze(current, hint));
      return;
    }

    // If the worker never answers, recompute on the main thread rather than
    // leaving the indicator stuck on "analyzing" forever.
    window.clearTimeout(watchdogRef.current);
    watchdogRef.current = window.setTimeout(() => {
      const latest = inputRef.current;
      if (!latest.code.trim()) return;
      settle(id, analyze(latest.code, latest.language === "auto" ? undefined : latest.language));
    }, WATCHDOG_MS);

    const request: RoastRequest = { id, code: current, language: hint };
    worker.postMessage(request);
  }, [settle]);

  const flush = useCallback(() => {
    window.clearTimeout(timerRef.current);
    setPending(true);
    run();
  }, [run]);

  // Start fetching the worker module immediately so the first keystroke is not
  // the one that pays for it.
  useEffect(() => {
    getWorker();
  }, []);

  useEffect(() => {
    const listener: Listener = (response) => {
      if (response) {
        settle(response.id, response.result);
        return;
      }
      const latest = inputRef.current;
      if (!latest.code.trim()) return;
      settle(latestId.current, analyze(latest.code, latest.language === "auto" ? undefined : latest.language));
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      window.clearTimeout(watchdogRef.current);
    };
  }, [settle]);

  useEffect(() => {
    window.clearTimeout(timerRef.current);
    if (!code.trim()) {
      latestId.current += 1;
      window.clearTimeout(watchdogRef.current);
      setResult(null);
      setPending(false);
      return;
    }
    setPending(true);
    timerRef.current = window.setTimeout(run, DEBOUNCE_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [code, language, run]);

  return { result, pending, flush };
}
