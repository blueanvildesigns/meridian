// Display-name cleaning shared by rename (D15), stored cities and Jump links (M1-7).

/** Longest display name, in graphemes (D15). */
export const MAX_NAME_LENGTH = 60;

/**
 * Trims a user-visible name: whitespace runs (including newlines and tabs) become one space, other
 * control characters go, and the result is cut to `MAX_NAME_LENGTH` graphemes so an emoji or a
 * combining accent is never split. Returns undefined when nothing is left.
 */
export function cleanName(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const name = raw
    .replace(/\s+/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .trim();
  if (name === '') return undefined;
  const graphemes = Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(name));
  return graphemes
    .slice(0, MAX_NAME_LENGTH)
    .map((g) => g.segment)
    .join('');
}
