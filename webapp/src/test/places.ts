// Stored-city fixtures for tests, shaped like what add-city saves (M2-1). Coordinates are rounded
// the way the dataset rounds them (0.1°).
import type { PlaceCity } from '../storage/schema';

export const LONDON: PlaceCity = {
  id: 'london',
  kind: 'place',
  zone: 'Europe/London',
  geonameId: 2643743,
  name: 'London',
  countryCode: 'GB',
  country: 'United Kingdom',
  region: 'England',
  lat: 51.5,
  lon: -0.1,
};

export const KOLKATA: PlaceCity = {
  id: 'kolkata',
  kind: 'place',
  zone: 'Asia/Kolkata',
  geonameId: 1275004,
  name: 'Kolkata',
  countryCode: 'IN',
  country: 'India',
  region: 'West Bengal',
  lat: 22.6,
  lon: 88.4,
};

export const TOKYO: PlaceCity = {
  id: 'tokyo',
  kind: 'place',
  zone: 'Asia/Tokyo',
  geonameId: 1850147,
  name: 'Tokyo',
  countryCode: 'JP',
  country: 'Japan',
  region: 'Tokyo',
  lat: 35.7,
  lon: 139.7,
};

/** A place whose saved zone no browser knows (the unrecognised-zone card). */
export const NOWHERE: PlaceCity = {
  id: 'nowhere',
  kind: 'place',
  zone: 'Mars/Olympus_Mons',
  geonameId: 1,
  name: 'Olympus Mons',
  countryCode: 'XX',
  country: 'Mars',
  lat: 18.6,
  lon: -134,
};
