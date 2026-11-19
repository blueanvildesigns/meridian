import { describe, expect, it } from 'vitest';
import { parseTimeText } from './timeText';

describe('parseTimeText', () => {
  it.each([
    ['8:00 AM', 8, 0],
    ['8:00 PM', 20, 0],
    ['12:00 AM', 0, 0],
    ['12:30 PM', 12, 30],
    ['8am', 8, 0],
    ['8 pm', 20, 0],
    ['8:30 a.m.', 8, 30],
    ['8.30 P.M.', 20, 30],
    ['  9:05pm ', 21, 5],
    ['20:00', 20, 0],
    ['08:30', 8, 30],
    ['0:00', 0, 0],
    ['23:59', 23, 59],
    ['0830', 8, 30],
    ['2000', 20, 0],
    ['830', 8, 30],
    ['8', 8, 0],
    ['17', 17, 0],
    ['8h30', 8, 30],
  ])('reads %j as %i:%i', (text, hour, minute) => {
    expect(parseTimeText(text)).toEqual({ hour, minute });
  });

  it.each([
    '',
    '   ',
    'noon',
    '24:00',
    '25',
    '8:60',
    '8:5',
    '13pm',
    '0am',
    '8:00 XM',
    '8::00',
    '-1',
  ])('rejects %j', (text) => {
    expect(parseTimeText(text)).toBeNull();
  });
});
