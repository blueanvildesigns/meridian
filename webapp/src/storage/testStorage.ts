import type { StorageLike } from './storage';

export interface FakeStorage extends StorageLike {
  data: Map<string, string>;
}

/** An in-memory Storage whose reads or writes can be made to throw, per key. */
export function fakeStorage(
  initial: Record<string, string> = {},
  fail: { read?: boolean; write?: (key: string) => boolean } = {},
): FakeStorage {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => {
      if (fail.read) throw new DOMException('denied', 'SecurityError');
      return data.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (fail.write?.(key)) throw new DOMException('full', 'QuotaExceededError');
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}
