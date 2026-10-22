import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errMsg } from './api';
import type { Paginated } from './types';

export function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

/** Server-paginated list. Re-fetches when path/params change; stale responses are ignored. */
export function useList<T>(path: string, params: Record<string, string | number | undefined>, enabled = true) {
  const [res, setRes] = useState<Paginated<T>>({ data: [], total: 0, page: 1, pageSize: 25 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const r = await api.get<Paginated<T>>(path, JSON.parse(key));
      if (id === reqId.current) { setRes(r); setError(null); }
    } catch (e) {
      if (id === reqId.current) setError(errMsg(e));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [path, key]);

  useEffect(() => { if (enabled) load(); }, [load, enabled]);
  return { ...res, loading, error, reload: load };
}
