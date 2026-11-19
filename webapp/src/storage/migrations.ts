// Schema migrations (D19). MIGRATIONS[n] turns version-n data into version n+1. Version 1 is the
// first web schema; the Flutter app's data is not migrated (spec section 6).

export type StoredData = Record<string, unknown>;
export type Migration = (data: StoredData) => StoredData;
export type MigrationRegistry = Readonly<Record<number, Migration>>;

export const MIGRATIONS: MigrationRegistry = {};

/** Runs every step from `from` up to `to`. Throws if a step is missing or fails. */
export function migrate(
  data: StoredData,
  from: number,
  to: number,
  migrations: MigrationRegistry = MIGRATIONS,
): StoredData {
  let current = data;
  for (let v = from; v < to; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`No migration from schema ${v} to ${v + 1}`);
    current = { ...step(current), schemaVersion: v + 1 };
  }
  return current;
}
