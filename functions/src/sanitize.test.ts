import { describe, expect, it } from 'vitest';
import { charLength, codeBlock, sanitizeLine, sanitizeText, truncate } from './sanitize.js';

describe('sanitizeText', () => {
  it('normalises newlines and trims', () => {
    expect(sanitizeText('  a\r\nb\rc  \n')).toBe('a\nb\nc');
  });

  it('removes control characters but keeps tabs and newlines', () => {
    expect(sanitizeText('a\u0000b\u0007c\u001bd\u007fe\u0085f\tg\nh')).toBe('abcdef\tg\nh');
  });

  it('removes bidirectional overrides and isolates', () => {
    expect(sanitizeText('admin‮⁦txt.exe⁩‬')).toBe('admintxt.exe');
  });

  it('keeps at most one blank line in a row and drops trailing spaces', () => {
    expect(sanitizeText('a   \n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('composes characters (NFC) so lengths are counted fairly', () => {
    expect(sanitizeText('é')).toBe('é');
  });

  it('keeps ordinary text, emoji and other scripts as they are', () => {
    const text = 'Tokyo 東京 shows 9:00 😀 — expected 10:00';
    expect(sanitizeText(text)).toBe(text);
  });
});

describe('sanitizeLine', () => {
  it('folds everything onto one line', () => {
    expect(sanitizeLine(' a\n\tb  c ')).toBe('a b c');
  });
});

describe('charLength and truncate', () => {
  it('count code points, not UTF-16 units', () => {
    expect(charLength('😀😀')).toBe(2);
    expect(truncate('😀😀😀', 2)).toBe('😀…');
    expect(truncate('abc', 3)).toBe('abc');
  });
});

describe('codeBlock', () => {
  it('fences text with three backticks and a language', () => {
    expect(codeBlock('hello')).toBe('```text\nhello\n```');
  });

  it('uses a longer fence than any run of backticks inside, so the text cannot break out', () => {
    const evil = 'x\n```\n@everyone ![](https://evil.example/x.png) #1\n````\ny';
    const block = codeBlock(evil);
    const fence = '`````';
    expect(block.startsWith(`${fence}text\n`)).toBe(true);
    expect(block.endsWith(`\n${fence}`)).toBe(true);
    // No line inside is a fence as long as the outer one.
    const inner = block.split('\n').slice(1, -1);
    expect(inner.some((line) => line.startsWith(fence))).toBe(false);
  });
});
