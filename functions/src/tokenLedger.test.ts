import type { Firestore } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import { claimToken, readVerifiedToken, USED_TOKENS_COLLECTION } from './tokenLedger.js';

const JTI = 'TF9a2-CiM6KhdT2Or0AvRTasV51k2awVn_mz0cULjnA';

describe('readVerifiedToken', () => {
  it('takes the token ID and expiry from a verified token', () => {
    expect(readVerifiedToken({ token: { exp: 1_795_487_583, jti: JTI } })).toEqual({
      ok: true,
      token: { id: JTI, expiresAt: new Date(1_795_487_583_000) },
    });
    expect(
      readVerifiedToken({ alreadyConsumed: false, token: { exp: 1, jti: JTI } }),
    ).toMatchObject({ ok: true });
  });

  it('refuses a token App Check says was consumed', () => {
    expect(readVerifiedToken({ alreadyConsumed: true, token: { exp: 1, jti: JTI } })).toEqual({
      ok: false,
      reason: 'consumed',
    });
  });

  it('refuses a token without a usable ID', () => {
    for (const jti of [undefined, 42, '', 'short', 'has/slash-in-it-0123', 'x'.repeat(129)]) {
      expect(readVerifiedToken({ token: { exp: 1, jti } })).toEqual({ ok: false, reason: 'no_id' });
    }
  });
});

/** Just enough of Firestore for claimToken: `collection().doc().create()`. */
function fakeDb(create: (data: unknown) => Promise<unknown>) {
  const doc = vi.fn(() => ({ create }));
  const collection = vi.fn(() => ({ doc }));
  return { db: { collection } as unknown as Firestore, collection, doc };
}

describe('claimToken', () => {
  const token = { id: JTI, expiresAt: new Date('2026-11-24T02:30:00Z') };
  const now = new Date('2026-11-24T02:25:00Z');

  it('records the token by ID, with when it was used and when the record can go', async () => {
    const create = vi.fn(() => Promise.resolve());
    const { db, collection, doc } = fakeDb(create);
    await expect(claimToken(db, token, now)).resolves.toBe(true);
    expect(collection).toHaveBeenCalledWith(USED_TOKENS_COLLECTION);
    expect(doc).toHaveBeenCalledWith(JTI);
    expect(create).toHaveBeenCalledWith({ usedAt: now, expireAt: token.expiresAt });
  });

  it('says false when the token was already recorded', async () => {
    const exists = Object.assign(new Error('6 ALREADY_EXISTS'), { code: 6 });
    const { db } = fakeDb(() => Promise.reject(exists));
    await expect(claimToken(db, token, now)).resolves.toBe(false);
  });

  it('passes any other failure on, so the handler can fail closed', async () => {
    const down = Object.assign(new Error('14 UNAVAILABLE'), { code: 14 });
    const { db } = fakeDb(() => Promise.reject(down));
    await expect(claimToken(db, token, now)).rejects.toBe(down);
  });
});

// Against the real Firestore emulator (functions/README.md): `npm run test:emulator`.
describe.skipIf(!process.env['FIRESTORE_EMULATOR_HOST'])(
  'claimToken in the Firestore emulator',
  () => {
    it('lets each token through once, even when two requests race', async () => {
      const { initializeApp } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');
      const db = getFirestore(initializeApp({ projectId: 'demo-meridian' }, 'token-ledger-test'));
      const token = { id: `race-${String(Date.now())}-0123456789`, expiresAt: new Date() };
      const results = await Promise.all(
        Array.from({ length: 5 }, () => claimToken(db, token, new Date())),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
      await expect(claimToken(db, token, new Date())).resolves.toBe(false);
      const saved = await db.collection(USED_TOKENS_COLLECTION).doc(token.id).get();
      expect(Object.keys(saved.data() ?? {}).sort()).toEqual(['expireAt', 'usedAt']);
    }, 30_000); // The Admin SDK's first call waits on a cloud metadata lookup that can't succeed here.
  },
);
