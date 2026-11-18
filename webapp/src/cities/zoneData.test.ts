import { describe, expect, it } from 'vitest';
import { CITY_DATA_DATE, DATASET_ZONES, zoneRepresentative } from './zoneData';
import { realDataset } from '../test/cityDataset';

describe('zone representatives (D5, M2-5)', () => {
  it('covers exactly the dataset’s zones', () => {
    expect(DATASET_ZONES).toEqual(realDataset().zones);
  });

  it('prefers the zone’s namesake over a bigger city', () => {
    expect(zoneRepresentative('Asia/Kolkata')).toMatchObject({
      name: 'Kolkata',
      countryCode: 'IN',
    });
    expect(zoneRepresentative('America/New_York')?.name).toBe('New York City');
    expect(zoneRepresentative('America/Indiana/Indianapolis')?.name).toBe('Indianapolis');
  });

  it('falls back to the most populous place when there is no namesake', () => {
    // Asia/Shanghai covers all of China; Shanghai is also the biggest city.
    expect(zoneRepresentative('Asia/Shanghai')?.name).toBe('Shanghai');
  });

  it('understands legacy names, and has nothing for UTC', () => {
    expect(zoneRepresentative('Asia/Calcutta')?.name).toBe('Kolkata');
    expect(zoneRepresentative('UTC')).toBeUndefined();
    expect(zoneRepresentative('Mars/Olympus_Mons')).toBeUndefined();
  });

  it('carries coordinates for sunrise', () => {
    const r = zoneRepresentative('Europe/London');
    expect(r?.lat).toBeCloseTo(51.5, 0);
    expect(r?.lon).toBeCloseTo(-0.1, 0);
  });

  it('records the GeoNames export date for About', () => {
    expect(CITY_DATA_DATE).toBe(realDataset().source.dumpDate);
  });
});
