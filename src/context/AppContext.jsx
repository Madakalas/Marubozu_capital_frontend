import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { API, apiFetch } from '../api';

// ── helpers ──────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().split('T')[0]; }

function defaultDates() {
  const to   = new Date();
  const from = new Date(); from.setMonth(from.getMonth() - 1);
  return { from: toDateStr(from), to: toDateStr(to) };
}

function load(key, fallback) {
  try { const v = sessionStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, v) { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch {} }

// ── context ───────────────────────────────────────────────────
const Ctx = createContext(null);

export function AppProvider({ children }) {
  const dates    = defaultDates();
  const [ticker,    setTicker_]    = useState(() => load('g_ticker',   'ETHUSD'));
  const [interval,  setInterval_]  = useState(() => load('g_interval', '4hour'));
  const [fromDate,  setFromDate_]  = useState(() => load('g_from',     dates.from));
  const [toDate,    setToDate_]    = useState(() => load('g_to',       dates.to));

  // Assets & timeframes loaded once globally
  const [assets,     setAssets]     = useState(() => load('g_assets',     []));
  const [timeframes, setTimeframes] = useState(() => load('g_timeframes', []));
  const [assetsLoaded, setAssetsLoaded]     = useState(false);
  const [timeframesLoaded, setTimeframesLoaded] = useState(false);

  // Setters that also persist to sessionStorage
  const setTicker   = useCallback(v => { save('g_ticker',   v); setTicker_(v);   }, []);
  const setInterval = useCallback(v => { save('g_interval', v); setInterval_(v); }, []);
  const setFromDate = useCallback(v => { save('g_from',     v); setFromDate_(v); }, []);
  const setToDate   = useCallback(v => { save('g_to',       v); setToDate_(v);   }, []);

  const reloadAssets = useCallback(async () => {
    try {
      const d = await apiFetch(API.assets);
      const list = d.data || [];
      setAssets(list);
      save('g_assets', list);
      setAssetsLoaded(true);
      // Set default ticker from assets if current not in list
      if (list.length && !list.find(a => a.name === ticker)) {
        const t = list.find(a => a.name === 'ETHUSD') || list[0];
        setTicker(t.name);
      }
    } catch {}
  }, [ticker, setTicker]);

  const reloadTimeframes = useCallback(async () => {
    try {
      const d = await apiFetch(API.timeframes);
      const list = (d.data || []).sort((a, b) => a.seconds - b.seconds);
      setTimeframes(list);
      save('g_timeframes', list);
      setTimeframesLoaded(true);
    } catch {}
  }, []);

  useEffect(() => { reloadAssets(); },     [reloadAssets]);
  useEffect(() => { reloadTimeframes(); }, [reloadTimeframes]);

  // Derived lists
  const assetNames    = assets.map(a => a.name);
  const tfValues      = timeframes.map(t => t.value);

  return (
    <Ctx.Provider value={{
      ticker, setTicker,
      interval, setInterval,
      fromDate, setFromDate,
      toDate, setToDate,
      assets, assetNames, reloadAssets, assetsLoaded,
      timeframes, tfValues, reloadTimeframes, timeframesLoaded,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAppCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppCtx must be inside AppProvider');
  return ctx;
}
