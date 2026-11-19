import { describe, expect, it } from 'vitest';
import { fold, isLatinFolded } from './fold';

describe('fold', () => {
  it.each([
    ['São Paulo', 'sao paulo'],
    ['ZÜRICH', 'zurich'],
    ["St. John's", 'st johns'],
    ['St John’s', 'st johns'],
    ['America/New_York', 'america new york'],
    ['Washington, D.C.', 'washington d c'],
    ['Straße', 'strasse'],
    ['Łódź', 'lodz'],
    ['Tórshavn', 'torshavn'],
    ['Ærøskøbing', 'aeroskobing'],
    ['Reykjavík', 'reykjavik'],
    ['  New   York  ', 'new york'],
    ['Москва', 'москва'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(fold(input)).toBe(expected);
  });

  it('tells Latin folded text from other scripts', () => {
    expect(isLatinFolded('sao paulo')).toBe(true);
    expect(isLatinFolded('москва')).toBe(false);
    expect(isLatinFolded('')).toBe(false);
  });
});
