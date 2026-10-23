import { useEffect, useState } from 'react';

/** Runs `load` whenever `key` changes and returns its result (undefined while loading). */
export function useAsync<T>(key: string, load: () => Promise<T>): T | undefined {
  const [state, setState] = useState<{ key: string; value: T } | undefined>();
  useEffect(() => {
    let live = true;
    load().then((value) => live && setState({ key, value }));
    return () => {
      live = false;
    };
    // `load` is expected to depend only on `key`.
  }, [key]);
  return state?.key === key ? state.value : undefined;
}
