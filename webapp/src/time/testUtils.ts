// Small helpers shared by the time tests (not shipped: only *.test.ts import this).
import { T } from './temporal';

export const instant = (s: string) => T().Instant.from(s);
export const date = (s: string) => T().PlainDate.from(s);
export const time = (s: string) => T().PlainTime.from(s);
export const wallIn = (s: string, zone: string) =>
  T().PlainDateTime.from(s).toZonedDateTime(zone).toInstant();
