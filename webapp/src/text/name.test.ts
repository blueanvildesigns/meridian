import { describe, expect, it } from 'vitest';
import { cleanName, MAX_NAME_LENGTH } from './name';

describe('cleanName', () => {
  it.each([
    [null, undefined],
    [undefined, undefined],
    ['', undefined],
    [' \n\t ', undefined],
    ['  New   York ', 'New York'],
    ['Line\nbreak\ttab', 'Line break tab'],
    ['Bell\u0007', 'Bell'],
    ['São Paulo', 'São Paulo'],
  ])('%j → %j', (raw, expected) => {
    expect(cleanName(raw)).toBe(expected);
  });

  it(`caps at ${MAX_NAME_LENGTH} graphemes without splitting one`, () => {
    expect(cleanName('é'.repeat(80))).toBe('é'.repeat(MAX_NAME_LENGTH));
    expect(cleanName('🇯🇵'.repeat(61))).toBe('🇯🇵'.repeat(MAX_NAME_LENGTH));
  });
});
