'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from './api-client';

/**
 * Small async state hook.
 *
 * Deliberately minimal: the project needs a loading flag, an error and a retry,
 * not a data-fetching framework. Long-running work (an analysis job) is polled
 * explicitly rather than by a cache library.
 */

export interface AsyncState<T> {
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly loading: boolean;
  readonly reload: () => void;
}

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  const reload = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (mounted.current) setData(result);
      })
      .catch((caught: unknown) => {
        if (!mounted.current) return;
        setError(
          caught instanceof ApiError
            ? caught
            : new ApiError('INTERNAL', 'Something went wrong.', 0),
        );
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload };
}

/**
 * Polls a function until `isDone` reports true.
 *
 * Used for the analysis job, where the server owns the lifecycle and the client
 * only needs to observe it. The interval is intentionally slow: each poll may
 * trigger a server-side re-claim, so hammering it would be wasteful.
 */
export function usePolling<T>(
  loader: () => Promise<T>,
  isDone: (value: T) => boolean,
  options: { enabled?: boolean; intervalMs?: number } = {},
): { data: T | null; error: ApiError | null; ticks: number } {
  const enabled = options.enabled ?? true;
  const intervalMs = options.intervalMs ?? 1_500;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [ticks, setTicks] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    stopped.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async (): Promise<void> => {
      if (stopped.current) return;
      try {
        const value = await loader();
        if (stopped.current) return;
        setData(value);
        setTicks((count) => count + 1);
        if (!isDone(value)) timer = setTimeout(() => void tick(), intervalMs);
      } catch (caught) {
        if (stopped.current) return;
        setError(caught instanceof ApiError ? caught : new ApiError('INTERNAL', 'Polling failed.', 0));
      }
    };

    void tick();

    return () => {
      stopped.current = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs]);

  return { data, error, ticks };
}
