/// <reference lib="webworker" />
import { analyze, type Language, type RoastResult } from "./roast";

export interface RoastRequest {
  id: number;
  code: string;
  language?: Language;
}

export interface RoastResponse {
  id: number;
  result: RoastResult;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.addEventListener("message", (event: MessageEvent<RoastRequest>) => {
  const { id, code, language } = event.data;
  const result = analyze(code, language);
  const response: RoastResponse = { id, result };
  ctx.postMessage(response);
});
