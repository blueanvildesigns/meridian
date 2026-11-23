// Cleaning what a reporter typed before it goes into a public GitHub issue.
//
// Every user-supplied field is placed inside a fenced code block (`codeBlock`), so GitHub renders
// it literally: no @mentions that notify people, no #123 or owner/repo#1 cross-references, no
// links, images or HTML. Sanitizing removes what a code block can't neutralise: control
// characters, bidirectional overrides that make text read differently from what it is, and
// runaway blank lines.

/** C0/C1 controls other than tab and newline. */
const CONTROLS = /[^\P{Cc}\t\n]/gu;
/** Bidi embeddings, overrides and isolates (the "Trojan Source" characters). */
const BIDI = /[‪-‮⁦-⁩]/g;

/** Multi-line text: normalised newlines, no control or bidi characters, at most one blank line in a row. */
export function sanitizeText(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROLS, '')
    .replace(BIDI, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Single-line text (titles, emails): any run of whitespace becomes one space. */
export function sanitizeLine(input: string): string {
  return sanitizeText(input).replace(/\s+/g, ' ').trim();
}

/** Length in code points, as a person would count characters (an emoji is one). */
export function charLength(text: string): number {
  return Array.from(text).length;
}

/** At most `max` code points, the cut marked with an ellipsis. */
export function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length <= max ? text : `${chars.slice(0, Math.max(0, max - 1)).join('')}…`;
}

/**
 * A fenced code block GitHub renders literally. The fence is one backtick longer than the longest
 * run of backticks in the text, so nothing inside can close it early.
 */
export function codeBlock(text: string, info = 'text'): string {
  const longestRun = Math.max(0, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${info}\n${text}\n${fence}`;
}
