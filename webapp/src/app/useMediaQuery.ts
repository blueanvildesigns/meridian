import { useCallback, useSyncExternalStore } from 'react';

/** Whether a CSS media query matches, kept current as the window changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** The phone layout's breakpoint, as in the CSS. */
export const PHONE = '(max-width: 640px)';
