/**
 * README badge generator.
 *
 * Produces a self-contained SVG (no network, no shields.io round-trip) so the
 * badge can be committed straight into a repo. The score is baked in, which
 * means the badge is a static snapshot — that is the honest trade-off for
 * staying serverless, and the README text says so.
 */

import type { RoastResult } from "./roast";
import { gradeColor } from "./share";

const FONT = "Verdana,Geneva,DejaVu Sans,sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough Verdana advance width — good enough for a badge, no canvas needed. */
function textWidth(text: string, size: number): number {
  return Math.round(text.length * size * 0.62);
}

export function badgeSvg(result: RoastResult): string {
  const label = "code roast";
  const value = `${result.score}/100 ${result.grade}`;
  const accent = gradeColor(result.grade);

  const pad = 10;
  const labelW = textWidth(label, 11) + pad * 2;
  const valueW = textWidth(value, 11) + pad * 2;
  const total = labelW + valueW;
  const h = 20;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${h}" role="img" aria-label="${escapeXml(`${label}: ${value}`)}">
  <title>${escapeXml(`${label}: ${value}`)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".12"/>
    <stop offset="1" stop-color="#000" stop-opacity=".12"/>
  </linearGradient>
  <clipPath id="r"><rect width="${total}" height="${h}" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelW}" height="${h}" fill="#1b1b28"/>
    <rect x="${labelW}" width="${valueW}" height="${h}" fill="${accent}"/>
    <rect width="${total}" height="${h}" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="${FONT}" font-size="11">
    <text x="${labelW / 2}" y="14" fill="#c9c9d8">${escapeXml(label)}</text>
    <text x="${labelW + valueW / 2}" y="14" font-weight="bold" fill="#0b0b12">${escapeXml(value)}</text>
  </g>
</svg>`;
}

/** `data:` URI so the badge can be previewed in an <img> without a file. */
export function badgeDataUri(result: RoastResult): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(badgeSvg(result))}`;
}

/** Markdown that works once the SVG is committed next to the README. */
export function badgeMarkdown(result: RoastResult, fileName = "coderroast.svg"): string {
  return `![CodeRoast ${result.score}/100 ${result.grade}](${fileName})`;
}

export function badgeFileName(result: RoastResult): string {
  return `coderroast-${result.score}-${result.grade}.svg`;
}
