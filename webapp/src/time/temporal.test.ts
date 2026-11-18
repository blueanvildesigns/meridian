import { describe, expect, it } from 'vitest';
import { T, temporalSource } from './temporal';

describe('loadTemporal', () => {
  it('uses the implementation this test project asks for', () => {
    const expected = process.env.MERIDIAN_TEMPORAL === 'polyfill' ? 'polyfill' : 'native';
    expect(temporalSource()).toBe(expected);
  });

  it('gives a working API with the engine zone rules', () => {
    const zdt = T().Instant.from('2026-07-01T12:00:00Z').toZonedDateTimeISO('Asia/Kathmandu');
    expect(zdt.toPlainTime().toString()).toBe('17:45:00');
  });
});
