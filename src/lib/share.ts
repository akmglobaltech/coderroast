import type { RoastResult } from "../lib/roast";

const GRADE_COLOR: Record<string, string> = {
  S: "#22d3a7",
  A: "#4ade80",
  B: "#a3e635",
  C: "#facc15",
  D: "#fb923c",
  F: "#ff2d55",
};

export function gradeColor(grade: string): string {
  return GRADE_COLOR[grade] ?? "#ff6b35";
}

/**
 * Draws the shareable 1200x630 card and returns it as a PNG blob.
 * Kept on a canvas so the exported image looks identical everywhere.
 */
export async function renderShareCard(result: RoastResult): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const accent = gradeColor(result.grade);

  // background
  ctx.fillStyle = "#0b0b12";
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(180, -60, 0, 180, -60, 780);
  glow.addColorStop(0, "rgba(255,107,53,0.30)");
  glow.addColorStop(1, "rgba(255,107,53,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const glow2 = ctx.createRadialGradient(1080, 40, 0, 1080, 40, 620);
  glow2.addColorStop(0, "rgba(255,45,85,0.22)");
  glow2.addColorStop(1, "rgba(255,45,85,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // border
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  const mono = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  const sans = 'ui-sans-serif, system-ui, "Segoe UI", Roboto, sans-serif';

  // brand
  ctx.fillStyle = "#ff6b35";
  ctx.font = `700 26px ${mono}`;
  ctx.fillText("🔥 CodeRoast", 72, 96);

  ctx.fillStyle = "rgba(233,233,242,0.45)";
  ctx.font = `400 20px ${mono}`;
  ctx.fillText(result.language.toUpperCase(), 72, 132);

  // score
  ctx.fillStyle = accent;
  ctx.font = `800 190px ${sans}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(result.score), 64, 330);

  const scoreWidth = ctx.measureText(String(result.score)).width;
  ctx.fillStyle = "rgba(233,233,242,0.35)";
  ctx.font = `600 44px ${mono}`;
  ctx.fillText("/100", 64 + scoreWidth + 14, 330);

  // grade badge
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(64, 366, 132, 132, 26);
  ctx.fill();

  ctx.fillStyle = "#0b0b12";
  ctx.font = `800 92px ${sans}`;
  ctx.textAlign = "center";
  ctx.fillText(result.grade, 130, 462);
  ctx.textAlign = "left";

  // headline + verdict
  ctx.fillStyle = "#e9e9f2";
  ctx.font = `700 40px ${sans}`;
  wrapText(ctx, result.headline, 236, 412, 900, 48);

  ctx.fillStyle = "rgba(233,233,242,0.55)";
  ctx.font = `400 22px ${sans}`;
  wrapText(ctx, result.verdict, 236, 470, 900, 32, 2);

  // top findings
  const top = result.findings.slice(0, 3);
  let y = 540;
  ctx.font = `500 21px ${mono}`;
  for (const f of top) {
    ctx.fillStyle = accent;
    ctx.fillText("▸", 72, y);
    ctx.fillStyle = "rgba(233,233,242,0.78)";
    const label = f.line ? `${f.title}  ·  L${f.line}` : f.title;
    ctx.fillText(truncate(ctx, label, 980), 100, y);
    y += 32;
  }

  // footer
  ctx.fillStyle = "rgba(233,233,242,0.30)";
  ctx.font = `400 18px ${mono}`;
  ctx.fillText("coderroast — paste code, get roasted", 72, H - 34);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode PNG"));
    }, "image/png");
  });
}

export function cardFileName(result: RoastResult): string {
  return `coderroast-${result.score}-${result.grade}.png`;
}

function toFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: "image/png" });
}

/** Web Share API Level 2 — the only way to hand a real image to a native share sheet. */
export function canShareFiles(blob: Blob, name: string): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    return navigator.canShare({ files: [toFile(blob, name)] });
  } catch {
    return false;
  }
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported";

/**
 * Opens the OS share sheet with the card attached. Must be called from a user
 * gesture — the transient activation survives a short `await`, not a long one.
 */
export async function shareCard(
  blob: Blob,
  name: string,
  text: string,
  url: string,
): Promise<ShareOutcome> {
  const file = toFile(blob, name);
  if (!canShareFiles(blob, name)) return "unsupported";
  try {
    await navigator.share({ files: [file], text, url, title: "CodeRoast" });
    return "shared";
  } catch (err) {
    // The user dismissing the sheet is not a failure.
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}

export function canCopyImage(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  );
}

/** Puts the PNG on the clipboard so it can be pasted into Slack, Discord or X. */
export async function copyCardImage(blob: Blob): Promise<boolean> {
  if (!canCopyImage()) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function downloadCard(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  // Revoking synchronously can cancel the download in Firefox/Safari.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 1,
): void {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      lines++;
      if (lines >= maxLines) return;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineHeight);
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 4 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}
