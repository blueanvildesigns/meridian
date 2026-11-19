import { describe, expect, it } from 'vitest';
import { isTyped, matchingTimes, startingIndex, timeOptions } from './timeList';

const labels = (query: string, cycle: '12' | '24' = '12') =>
  matchingTimes(query, cycle).map((o) => o.label);

describe('timeOptions', () => {
  it('lists every half hour in the app’s format', () => {
    const twelve = timeOptions('12');
    expect(twelve).toHaveLength(48);
    expect(twelve[0]).toEqual({ hour: 0, minute: 0, label: '12:00 AM' });
    expect(twelve[17]?.label).toBe('8:30 AM');
    expect(twelve[24]?.label).toBe('12:00 PM');
    expect(twelve[47]?.label).toBe('11:30 PM');
    const day = timeOptions('24').map((o) => o.label);
    expect(day.slice(0, 3)).toEqual(['00:00', '00:30', '01:00']);
    expect(day[41]).toBe('20:30');
  });
});

describe('matchingTimes', () => {
  it('gives every time when nothing is typed', () => {
    expect(matchingTimes('', '12')).toHaveLength(48);
    expect(matchingTimes('  ', '24')).toHaveLength(48);
  });

  it('matches the hour on either clock in 12-hour format', () => {
    expect(labels('8')).toEqual(['8:00 AM', '8:30 AM', '8:00 PM', '8:30 PM']);
    // "20" is also how "2:00" starts; the list starts on 8 PM, as Apply reads it.
    expect(labels('20')).toEqual(['2:00 AM', '2:00 PM', '8:00 PM', '8:30 PM']);
    expect(labels('12')).toEqual(['12:00 AM', '12:30 AM', '12:00 PM', '12:30 PM']);
  });

  it('matches minutes however they’re separated', () => {
    expect(labels('8:3')).toEqual(['8:30 AM', '8:30 PM']);
    expect(labels('830')).toEqual(['8:30 AM', '8:30 PM']);
    expect(labels('8.30')).toEqual(['8:30 AM', '8:30 PM']);
    expect(labels('8h30')).toEqual(['8:30 AM', '8:30 PM']);
    expect(labels('08:30')).toEqual(['8:30 AM']);
  });

  it('narrows to AM or PM', () => {
    expect(labels('8p')).toEqual(['8:00 PM', '8:30 PM']);
    expect(labels('8 pm')).toEqual(['8:00 PM', '8:30 PM']);
    expect(labels('8:30 a.m.')).toEqual(['8:30 AM']);
    expect(labels('12a')).toEqual(['12:00 AM', '12:30 AM']);
    expect(labels('pm')).toHaveLength(24);
  });

  it('reads the 24-hour clock only in 24-hour format', () => {
    expect(labels('8', '24')).toEqual(['08:00', '08:30']);
    expect(labels('2', '24')).toEqual([
      '02:00',
      '02:30',
      '20:00',
      '20:30',
      '21:00',
      '21:30',
      '22:00',
      '22:30',
      '23:00',
      '23:30',
    ]);
    expect(labels('8pm', '24')).toEqual(['20:00', '20:30']);
  });

  it('matches nothing for times off the half hour or text that isn’t a time', () => {
    expect(labels('8:15')).toEqual([]);
    expect(labels('8:1')).toEqual([]);
    expect(labels('25')).toEqual([]);
    expect(labels('noon')).toEqual([]);
    expect(labels('8x')).toEqual([]);
  });
});

describe('startingIndex', () => {
  const all = timeOptions('12');

  it('lands on the time typed when it’s listed', () => {
    expect(startingIndex(matchingTimes('12', '12'), '12', true)).toBe(2);
    expect(startingIndex(matchingTimes('20', '12'), '20', true)).toBe(2);
    expect(startingIndex(matchingTimes('8p', '12'), '8p', true)).toBe(0);
    expect(startingIndex(all, '8:30 PM', false)).toBe(41);
  });

  it('starts on the first match while filtering', () => {
    expect(startingIndex(matchingTimes('8:3', '12'), '8:3', true)).toBe(0);
  });

  it('opens the whole list on the half hour before the time in the field', () => {
    expect(startingIndex(all, '3:43 AM', false)).toBe(7);
    expect(startingIndex(all, '11:59 PM', false)).toBe(47);
    expect(startingIndex(all, '', false)).toBe(0);
  });

  it('is -1 for an empty list', () => {
    expect(startingIndex([], '8:15', true)).toBe(-1);
  });
});

describe('isTyped', () => {
  it('compares the option with what the field reads as', () => {
    expect(isTyped({ hour: 20, minute: 0 }, '8pm')).toBe(true);
    expect(isTyped({ hour: 8, minute: 0 }, '8')).toBe(true);
    expect(isTyped({ hour: 20, minute: 0 }, '8')).toBe(false);
    expect(isTyped({ hour: 8, minute: 30 }, '8:3')).toBe(false);
  });
});
