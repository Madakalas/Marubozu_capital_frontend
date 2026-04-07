import { useState, useEffect, useCallback } from 'react';
import { API, apiFetch } from '../api';

/** Same interval as Upload CSV live counter and navbar unprocessed badge */
export const UNPROCESSED_POLL_MS = 1000;

// ─── useUnprocessed ───────────────────────────
export function useUnprocessed(intervalMs = UNPROCESSED_POLL_MS) {
  const [count,      setCount]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      const d = await apiFetch(API.unprocessed);
      if (d.status === 'success') {
        setCount(d.unprocessed_count);
        setLastUpdate(new Date());
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetch_();
    const t = setInterval(fetch_, intervalMs);
    return () => clearInterval(t);
  }, [fetch_, intervalMs]);

  return { count, lastUpdate, refresh: fetch_ };
}

// ─── useAssets (standalone, for ManageAssets page which needs reload) ──
export function useAssets() {
  const [assets,  setAssets]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await apiFetch(API.assets);
      setAssets(d.data || []);
    } catch (e) { setAssets([]); setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { assets, names: assets.map(a => a.name), loading, error, reload: load };
}

// ─── useTimeframes (standalone) ───────────────
export function useTimeframes() {
  const [timeframes, setTimeframes] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await apiFetch(API.timeframes);
      setTimeframes((d.data || []).sort((a, b) => a.seconds - b.seconds));
    } catch (e) { setTimeframes([]); setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  return { timeframes, values: timeframes.map(t => t.value), loading, error, reload: load };
}
