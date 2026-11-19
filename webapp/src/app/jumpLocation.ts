// The URL hash as an external store, for Jump (decision D11). Jump state lives in the hash, so Back,
// Forward, a pasted link and a reload all restore it, and it's never sent to a server.
// pushState and replaceState fire no events, so changes made here notify subscribers themselves.

import { useMemo, useSyncExternalStore } from 'react';
import { decodeJump, encodeJump, type JumpState } from '../time/jumpUrl';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('hashchange', onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('hashchange', onChange);
    window.removeEventListener('popstate', onChange);
  };
}

const getHash = () => window.location.hash;

/** The Jump in the address bar, or null for live mode (no hash, or one that doesn't decode). */
export function useJumpState(): JumpState | null {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => decodeJump(hash), [hash]);
}

/**
 * Shows a Jump (or live mode, for null). A new history entry by default, so Back undoes it;
 * `replace` changes the current entry instead, as Change does, so Back still goes to live.
 */
export function setJumpState(state: JumpState | null, { replace = false } = {}) {
  const { pathname, search } = window.location;
  const url = pathname + search + (state ? encodeJump(state) : '');
  if (replace) window.history.replaceState(window.history.state, '', url);
  else window.history.pushState(null, '', url);
  for (const listener of listeners) listener();
}

/** The address to share for a Jump. */
export function jumpLink(state: JumpState): string {
  const { origin, pathname } = window.location;
  return origin + pathname + encodeJump(state);
}
