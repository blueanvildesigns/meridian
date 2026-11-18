import { describe, expect, it } from 'vitest';
import { decodeJump, encodeJump, MAX_NAME_LENGTH } from './jumpUrl';
import { instant } from './testUtils';

const STATE = {
  instant: instant('2027-03-14T07:30:00Z'),
  refZone: 'America/New_York',
  refName: 'New York',
};

describe('Jump URL', () => {
  it('encodes to the documented, readable form', () => {
    expect(encodeJump(STATE)).toBe('#at=2027-03-14T07:30:00Z&ref=America/New_York&name=New%20York');
  });

  it('round-trips', () => {
    const back = decodeJump(encodeJump(STATE));
    expect(back?.instant.equals(STATE.instant)).toBe(true);
    expect(back?.refZone).toBe(STATE.refZone);
    expect(back?.refName).toBe(STATE.refName);
  });

  it('keeps which occurrence of a repeated time was chosen', () => {
    const second = { ...STATE, instant: instant('2027-11-07T06:30:00Z') };
    expect(decodeJump(encodeJump(second))?.instant.equals(second.instant)).toBe(true);
  });

  it('accepts a hash without "#", an offset instant, and a name with "+"', () => {
    const s = decodeJump('at=2027-03-14T03:30:00-04:00&ref=Etc/GMT%2B5&name=A%2BB');
    expect(s?.instant.equals(STATE.instant)).toBe(true);
    expect(s?.refZone).toBe('Etc/GMT+5');
    expect(s?.refName).toBe('A+B');
  });

  it('normalises a legacy reference zone', () => {
    expect(decodeJump('#at=2027-03-14T07:30:00Z&ref=Asia/Calcutta')?.refZone).toBe('Asia/Kolkata');
  });

  it('omits the name when absent or blank', () => {
    expect(encodeJump({ ...STATE, refName: '   ' })).not.toContain('name=');
    expect(decodeJump('#at=2027-03-14T07:30:00Z&ref=UTC&name=%20')?.refName).toBeUndefined();
  });

  it('cleans and caps the name on grapheme boundaries', () => {
    const long = '👩‍👩‍👧'.repeat(MAX_NAME_LENGTH + 5);
    const name = decodeJump(
      `#at=2027-03-14T07:30:00Z&ref=UTC&name=${encodeURIComponent(long)}`,
    )?.refName;
    expect(name).toBe('👩‍👩‍👧'.repeat(MAX_NAME_LENGTH));
    expect(decodeJump('#at=2027-03-14T07:30:00Z&ref=UTC&name=a%0Ab%07c')?.refName).toBe('a bc');
  });

  it.each([
    '',
    '#',
    '#ref=UTC',
    '#at=2027-03-14T07:30:00Z',
    '#at=yesterday&ref=UTC',
    '#at=2027-03-14T07:30:00&ref=UTC', // no offset: not an instant
    '#at=2027-03-14T07:30:00Z&ref=Not/AZone',
    '#at=3000-01-01T00:00:00Z&ref=UTC',
    '#at=1800-01-01T00:00:00Z&ref=UTC',
  ])('treats %j as live mode', (hash) => {
    expect(decodeJump(hash)).toBeNull();
  });
});
