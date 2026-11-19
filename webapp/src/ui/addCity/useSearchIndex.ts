// The add-city search index: the city dataset is fetched the first time the dialog opens (D18),
// indexed once, and kept for the rest of the visit, so reopening the dialog is instant.

import { useEffect, useState } from 'react';
import { loadDataset } from '../../cities/dataset';
import { buildSearchIndex, type SearchIndex } from '../../cities/search';

let ready: SearchIndex | undefined;
let pending: Promise<SearchIndex> | undefined;

/** Loads and indexes the dataset once. A failure isn't kept, so the next call tries again. */
export function loadSearchIndex(): Promise<SearchIndex> {
  if (ready) return Promise.resolve(ready);
  pending ??= loadDataset()
    .then((dataset) => (ready = buildSearchIndex(dataset, { now: Date.now() })))
    .finally(() => {
      pending = undefined;
    });
  return pending;
}

/** For tests. */
export function resetSearchIndex(): void {
  ready = undefined;
  pending = undefined;
}

export type IndexState =
  { status: 'loading' } | { status: 'ready'; index: SearchIndex } | { status: 'error' };

export function useSearchIndex(): { state: IndexState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<IndexState>(() =>
    ready ? { status: 'ready', index: ready } : { status: 'loading' },
  );

  useEffect(() => {
    if (ready) return;
    let live = true;
    loadSearchIndex().then(
      (index) => {
        if (live) setState({ status: 'ready', index });
      },
      () => {
        if (live) setState({ status: 'error' });
      },
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = () => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  };
  return { state, retry };
}
