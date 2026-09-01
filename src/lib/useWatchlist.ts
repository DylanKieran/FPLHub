'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'fpl-watchlist';

/** Notifies every mounted hook instance when the list changes. */
const listeners = new Set<(ids: number[]) => void>();

function read(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function write(ids: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be unavailable (private mode, quota) — the in-memory
    // state still updates, it just won't survive a reload.
  }
  listeners.forEach(fn => fn(ids));
}

/**
 * Persistent per-player watchlist.
 *
 * Starts empty on the server and hydrates after mount so the markup matches;
 * `ready` tells callers when the stored value has actually been read, which
 * avoids briefly rendering an empty list over a populated one.
 */
export function useWatchlist() {
  const [ids, setIds] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIds(read());
    setReady(true);

    const onChange = (next: number[]) => setIds(next);
    listeners.add(onChange);

    // Keep multiple tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(read());
    };
    window.addEventListener('storage', onStorage);

    return () => {
      listeners.delete(onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggle = useCallback((playerId: number) => {
    const current = read();
    const next = current.includes(playerId)
      ? current.filter(id => id !== playerId)
      : [...current, playerId];
    write(next);
  }, []);

  const has = useCallback((playerId: number) => ids.includes(playerId), [ids]);

  const clear = useCallback(() => write([]), []);

  return { ids, has, toggle, clear, ready, count: ids.length };
}
