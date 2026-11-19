// Search folding, shared by the data pipeline (scripts/build-cities.ts) and the runtime index, so
// both sides agree on what "the same name" means. Dependency-free: Node runs the script directly.

/** Letters that Unicode decomposition leaves alone but people type as plain ASCII. */
const SPECIAL: Readonly<Record<string, string>> = {
  ß: 'ss',
  ẞ: 'ss',
  ø: 'o',
  Ø: 'o',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
  ð: 'd',
  Ð: 'd',
  ı: 'i',
  þ: 'th',
  Þ: 'th',
  ħ: 'h',
  Ħ: 'h',
};

const SPECIAL_RE = new RegExp(`[${Object.keys(SPECIAL).join('')}]`, 'g');

/**
 * Lower-case, accent-free, punctuation-free form of a name, with single spaces between words:
 * "São Paulo" → "sao paulo", "St. John's" → "st johns", "America/New_York" → "america new york".
 * Apostrophes vanish rather than splitting a word.
 */
export function fold(text: string): string {
  return text
    .replace(SPECIAL_RE, (c) => SPECIAL[c] ?? c)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/['’‘ʻʼ`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** True if the folded form is plain Latin letters, digits and spaces. */
export function isLatinFolded(folded: string): boolean {
  return /^[a-z0-9 ]+$/.test(folded);
}
