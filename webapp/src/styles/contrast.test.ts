// Verifies WCAG 2.x contrast for every foreground/background token pair, in both themes.
// Parses tokens.css directly so the CSS stays the single source of truth.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Theme = Record<string, string>;

// Vitest does not process CSS, so `?raw` imports come back empty: read the file instead.
const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

function parseBlock(selector: string): Theme {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const body = css.slice(start, css.indexOf('\n}', start));
  const out: Theme = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    out[m[1] as string] = (m[2] as string).toLowerCase();
  }
  return out;
}

const light = parseBlock(':root');
const themes: Record<'light' | 'dark', Theme> = {
  light,
  dark: { ...light, ...parseBlock(":root[data-theme='dark']") },
};

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = 4.5; // body text
const UI = 3; // icons, control boundaries, focus indicators, large text

// [foreground, background, minimum ratio]
const pairs: [string, string, number][] = [
  // Page and panels
  ['fg', 'page', TEXT],
  ['fg', 'surface', TEXT],
  ['muted', 'page', TEXT],
  ['muted', 'surface', TEXT],
  ['accent-text', 'page', TEXT],
  ['accent-text', 'surface', TEXT],
  ['link', 'page', TEXT],
  ['link-hover', 'page', TEXT],
  ['fg', 'seg-bg', TEXT],
  ['muted', 'seg-bg', TEXT],
  ['seg-selected-fg', 'seg-selected-bg', TEXT],
  ['on-accent', 'accent', TEXT],
  ['fg', 'control-bg', TEXT],
  ['disabled-fg', 'disabled-bg', TEXT],
  ['control-border', 'page', UI],
  ['control-border', 'surface', UI],
  ['accent', 'page', UI],
  ['focus', 'page', UI],
  ['focus', 'surface', UI],
  // Day card
  ['day-card-fg', 'day-card-bg', TEXT],
  ['day-card-muted', 'day-card-bg', TEXT],
  ['day-chip-fg', 'day-chip-bg', TEXT],
  ['day-icon', 'day-card-bg', TEXT], // the icon sits next to a 13px text label in the same colour
  ['day-focus', 'day-card-bg', UI],
  // Night card
  ['night-card-fg', 'night-card-bg', TEXT],
  ['night-card-muted', 'night-card-bg', TEXT],
  ['night-chip-fg', 'night-chip-bg', TEXT],
  ['night-icon', 'night-card-bg', TEXT],
  ['night-focus', 'night-card-bg', UI],
  // Warning banner and unrecognized-zone card
  ['warn-text', 'warn-bg', TEXT],
  ['warn-link', 'warn-bg', TEXT],
  ['warn-icon', 'warn-bg', UI],
  ['warn-accent', 'page', UI], // dashed border of the unrecognized-zone card (darkened, M0-5)
  // Jump
  ['jump-text', 'jump-bg', TEXT],
  ['jump-text', 'control-bg', TEXT], // Copy link / Change buttons: jump-text on white (light)
  ['ref-tag-fg', 'ref-tag-bg', TEXT],
  ['ref-border', 'page', UI],
];

describe.each(Object.entries(themes))('%s theme contrast', (_name, theme) => {
  it('defines every token used in the pair list', () => {
    const missing = pairs.flatMap(([f, b]) => [f, b]).filter((t) => !(t in theme));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('meets WCAG AA for every pair', () => {
    const failures = pairs
      .map(([f, b, min]) => ({
        pair: `${f} on ${b}`,
        ratio: contrast(theme[f] ?? '', theme[b] ?? ''),
        min,
      }))
      .filter((r) => r.ratio < r.min)
      .map((r) => `${r.pair}: ${r.ratio.toFixed(2)} < ${r.min}`);
    expect(failures).toEqual([]);
  });
});

describe('contrast()', () => {
  it('matches known WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
