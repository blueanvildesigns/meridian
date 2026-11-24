// Our own replay protection: each App Check token is good for one request.
//
// App Check's `consume` check isn't enough on its own. Tested against production on 2026-11-23
// (docs/archive/2026-11-21-bug-reporting.md, item 24): about half of reused limited-use tokens
// were accepted a second time, and session tokens (one hour) were never marked as used. So every
// token's ID (its `jti` claim) is recorded in Firestore, `usedAppCheckTokens/{jti}`, with a
// create-only write that fails if the ID is already there. Firestore's create is atomic, so two
// requests racing with one token can't both win.
//
// Each document holds only when it was used and `expireAt`, the token's own expiry, for a TTL
// policy to delete it (owner step 4.4). After that the token is refused by App Check anyway.
// Security rules (firestore.rules) deny every client read and write.

import type { Firestore } from 'firebase-admin/firestore';

export const USED_TOKENS_COLLECTION = 'usedAppCheckTokens';

/** What the handler needs to know about a verified App Check token. */
export interface VerifiedToken {
  /** The token's `jti` claim: unique per token. */
  id: string;
  expiresAt: Date;
}

export type AppCheckResult =
  { ok: true; token: VerifiedToken } | { ok: false; reason: 'consumed' | 'no_id' };

/** The parts of the Admin SDK's `verifyToken` response this reads. */
export interface VerifyTokenResponse {
  alreadyConsumed?: boolean | undefined;
  token: { exp: number; [claim: string]: unknown };
}

/** `jti` values are base64url; anything else isn't a token ID (and couldn't be a document ID). */
const TOKEN_ID = /^[A-Za-z0-9_-]{16,128}$/;

export function readVerifiedToken(response: VerifyTokenResponse): AppCheckResult {
  if (response.alreadyConsumed === true) return { ok: false, reason: 'consumed' };
  const id = response.token['jti'];
  if (typeof id !== 'string' || !TOKEN_ID.test(id)) return { ok: false, reason: 'no_id' };
  return { ok: true, token: { id, expiresAt: new Date(response.token.exp * 1000) } };
}

/** gRPC ALREADY_EXISTS, which Firestore's `create` throws when the document is there. */
const ALREADY_EXISTS = 6;

/** Records the token as used. True the first time; false if it was used before. */
export async function claimToken(db: Firestore, token: VerifiedToken, now: Date): Promise<boolean> {
  try {
    await db
      .collection(USED_TOKENS_COLLECTION)
      .doc(token.id)
      .create({ usedAt: now, expireAt: token.expiresAt });
    return true;
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === ALREADY_EXISTS) return false;
    throw error;
  }
}
