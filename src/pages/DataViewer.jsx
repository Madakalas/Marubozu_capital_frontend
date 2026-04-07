import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Grid, Typography, Button, Paper, MenuItem, Select,
  Chip, CircularProgress, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useAppCtx } from '../context/AppContext';
import { API, BB_STATUSES, INTERVALS } from '../api';
import { PageHeader, Card, Alert } from '../components/UI';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const f2   = v => (v == null || Number.isNaN(Number(v))) ? '--' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const fp2  = v => (v == null || Number.isNaN(Number(v))) ? '--' : Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fpct = v => (v == null || Number.isNaN(Number(v))) ? '--' : `${Number(v).toFixed(2)}%`;

function CandleCanvas({ open, high, low, close }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const o = Number(open), h = Number(high), l = Number(low), c = Number(close);
    const color = c >= o ? '#16a34a' : '#dc2626';
    const range = (h - l) || 1; const W = 48, H = 28;
    const yOf = p => ((h - p) / range * H);
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
    ctx.fillStyle = color;
    const by = Math.min(yOf(o), yOf(c)), bh = Math.abs(yOf(o) - yOf(c)) || 1;
    ctx.fillRect(W / 2 - 5, by, 10, bh);
  }, [open, high, low, close]);
  return <canvas ref={ref} width={48} height={28} style={{ display: 'block', margin: '0 auto' }} />;
}

/** Query date inputs are YYYY-MM-DD — show e.g. Mar 6, 2026 → Apr 6, 2026 in headers */
const humanDateRangeLabel = (fromStr, toStr) => {
  if (!fromStr || !toStr) return '';
  const parse = (s) => {
    const p = String(s).split('-').map(Number);
    if (p.length !== 3 || p.some(n => !Number.isFinite(n))) return null;
    return new Date(p[0], p[1] - 1, p[2]);
  };
  const df = parse(fromStr);
  const dt = parse(toStr);
  if (!df || !dt || isNaN(df.getTime()) || isNaN(dt.getTime())) return `${fromStr} → ${toStr}`;
  const opts = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${df.toLocaleDateString('en-US', opts)} → ${dt.toLocaleDateString('en-US', opts)}`;
};

/** e.g. Mar 23, 2026, 3:45:12 PM (local time, 12-hour) */
const humanDateTime = (ts) => {
  if (!ts) return '--';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export default function DataViewer({ isActive }) {
  const { ticker, setTicker, interval, setInterval, fromDate, setFromDate, toDate, setToDate, assetNames, tfValues } = useAppCtx();
  const toDateRef = useRef(null);

  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [fetched,  setFetched]  = useState(false);

  const [rangeFlt, setRangeFlt] = useState('all');
  const [bbFlt,    setBbFlt]    = useState('any');
  const [divFlt,   setDivFlt]   = useState('any');
  const [lenFrom,  setLenFrom]  = useState('');
  const [lenTo,    setLenTo]    = useState('');

  const resetFilters = () => {
    setRangeFlt('all'); setBbFlt('any'); setDivFlt('any');
    setLenFrom(''); setLenTo('');
  };

  const onFromDateChange = v => {
    setFromDate(v);
    if (!toDate || toDate < v) setToDate(v);
    setTimeout(() => {
      const el = toDateRef.current;
      if (!el) return;
      el.focus();
      if (typeof el.showPicker === 'function') el.showPicker();
    }, 0);
  };

  const doFetch = useCallback(async () => {
    if (!ticker || !fromDate || !toDate) return;
    setLoading(true); setError(''); setFetched(true);
    try {
      const res = await fetch(API.getData, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker, interval,
          from_datetime: fromDate + 'T00:00:00',
          to_datetime:   toDate   + 'T23:59:59',
        }),
      });
      const json = await res.json();
      if (json.records?.length) setRecords(json.records);
      else { setRecords([]); setError('No records found for this range.'); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [ticker, interval, fromDate, toDate]);

  const prevActive = useRef(null);
  useEffect(() => {
    const nowActive = isActive !== false;
    if (nowActive && prevActive.current === false) doFetch();
    prevActive.current = isActive ?? true;
  }, [isActive]); // eslint-disable-line

  useEffect(() => {
    if (isActive === false) return;
    if (ticker && interval && fromDate && toDate) doFetch();
  }, [isActive, ticker, interval, fromDate, toDate, doFetch]);

  const filtered = records.filter(rec => {
    const d = rec.data || {}, bb = d.bb_data || {};
    const bbp = Number(bb.bbp), status = bb.candle_status || '';
    const divType = d.divergence_data?.type || 'none', divLen = d.divergence_data?.length || 0;
    if (rangeFlt === 'outbb' && !(Number.isFinite(bbp) && (bbp < 0 || bbp > 1))) return false;
    if (bbFlt !== 'any' && status !== bbFlt) return false;
    if (divFlt !== 'any' && divType !== divFlt) return false;
    const lf = lenFrom !== '' ? parseInt(lenFrom) : null, lt = lenTo !== '' ? parseInt(lenTo) : null;
    if (lf !== null && lt !== null && !(divLen >= lf && divLen <= lt)) return false;
    if (lf !== null && lt === null && divLen < lf) return false;
    if (lf === null && lt !== null && divLen > lt) return false;
    return true;
  });

  const rowBg = rec => {
    const bbp = Number(rec.data?.bb_data?.bbp);
    if (Number.isFinite(bbp) && bbp < 0) return 'rgba(220,38,38,.055)';
    if (Number.isFinite(bbp) && bbp > 1) return 'rgba(22,163,74,.055)';
    return undefined;
  };

  const hasFilters = rangeFlt !== 'all' || bbFlt !== 'any' || divFlt !== 'any' || lenFrom !== '' || lenTo !== '';

  const selectSx = { fontSize: 13, height: 38 };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Data Viewer"
        sub="Browse all 40+ indicator columns per candle — full OHLC, BB, ADX, divergence, future performance"
      />

      {/* ── QUERY PARAMETERS ── */}
      <Card title="Query Parameters">
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Asset
            </Typography>
            <Select fullWidth size="small" value={ticker} onChange={e => setTicker(e.target.value)} sx={selectSx}>
              {(assetNames.length ? assetNames : [ticker]).map(n => (
                <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>
              ))}
            </Select>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Interval
            </Typography>
            <Select fullWidth size="small" value={interval} onChange={e => setInterval(e.target.value)} sx={selectSx}>
              {(tfValues.length ? tfValues : INTERVALS).map(v => (
                <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{v}</MenuItem>
              ))}
            </Select>
          </Grid>

          <Grid item xs={6} sm={2.5}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              From date
            </Typography>
            <input
              type="date"
              value={fromDate || ''}
              onChange={e => onFromDateChange(e.target.value)}
              style={{ width: '100%', padding: '7px 12px', fontSize: 13, border: '1px solid #e0e5ef', borderRadius: 8, background: '#fff', color: '#0f172a', fontFamily: 'inherit', height: 38 }}
            />
          </Grid>

          <Grid item xs={6} sm={2.5}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              To date
            </Typography>
            <input
              ref={toDateRef}
              type="date"
              value={toDate || ''}
              min={fromDate || undefined}
              onChange={e => setToDate(e.target.value)}
              style={{ width: '100%', padding: '7px 12px', fontSize: 13, border: '1px solid #e0e5ef', borderRadius: 8, background: '#fff', color: '#0f172a', fontFamily: 'inherit', height: 38 }}
            />
          </Grid>

          <Grid item xs={12} sm={1}>
            <Button
              variant="contained"
              onClick={doFetch}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={14} color="inherit" /> : <SearchIcon sx={{ fontSize: 16 }} />}
              fullWidth
              sx={{ height: 38 }}
            >
              {loading ? 'Loading…' : 'Fetch'}
            </Button>
          </Grid>
        </Grid>

        {records.length > 0 && (
          <>
            <Divider sx={{ mt: 2.5, mb: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <FilterListIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary' }}>
                Row filters
              </Typography>
              <Chip
                label={`${filtered.length.toLocaleString()} / ${records.length.toLocaleString()} rows`}
                size="small"
                variant="outlined"
                sx={{ ml: 'auto', fontSize: 11 }}
              />
            </Box>
            <Grid container spacing={2} alignItems="flex-end">
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>BBP Range</Typography>
                <Select fullWidth size="small" value={rangeFlt} onChange={e => setRangeFlt(e.target.value)} sx={selectSx}>
                  <MenuItem value="all" sx={{ fontSize: 13 }}>All rows</MenuItem>
                  <MenuItem value="outbb" sx={{ fontSize: 13 }}>Outside BB only</MenuItem>
                </Select>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>BB Candle Status</Typography>
                <Select fullWidth size="small" value={bbFlt} onChange={e => setBbFlt(e.target.value)} sx={selectSx}>
                  {BB_STATUSES.map(s => (
                    <MenuItem key={s.value} value={s.value} sx={{ fontSize: 13 }}>{s.label}</MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid item xs={6} sm={2}>
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>Divergence Type</Typography>
                <Select fullWidth size="small" value={divFlt} onChange={e => setDivFlt(e.target.value)} sx={selectSx}>
                  {['any', 'bullish', 'bearish', 'none'].map(v => (
                    <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{v}</MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid item xs={6} sm={2}>
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>Div Length</Typography>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                  <input type="number" placeholder="Min" value={lenFrom} onChange={e => setLenFrom(e.target.value)} style={{ width: '100%', padding: '7px 8px', fontSize: 12, border: '1px solid #e0e5ef', borderRadius: 8, background: '#fff', color: '#0f172a', fontFamily: 'inherit', height: 38 }} />
                  <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>–</Typography>
                  <input type="number" placeholder="Max" value={lenTo} onChange={e => setLenTo(e.target.value)} style={{ width: '100%', padding: '7px 8px', fontSize: 12, border: '1px solid #e0e5ef', borderRadius: 8, background: '#fff', color: '#0f172a', fontFamily: 'inherit', height: 38 }} />
                </Box>
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button variant="outlined" onClick={resetFilters} disabled={!hasFilters} startIcon={<RestartAltIcon sx={{ fontSize: 16 }} />} fullWidth sx={{ height: 38 }}>Reset</Button>
              </Grid>
            </Grid>
          </>
        )}
      </Card>

      {error && <Alert type="error" onClose={() => setError('')}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 5, gap: 1.5 }}>
          <CircularProgress size={22} />
          <Typography variant="body2" color="text.secondary">Fetching {ticker} {interval} data…</Typography>
        </Box>
      )}

      {filtered.length > 0 && !loading && (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2.5, py: 1.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography fontWeight={700} sx={{ fontSize: 14 }}>{ticker} · {interval} · {filtered.length.toLocaleString()} candles</Typography>
              <Typography variant="caption" color="text.secondary">
                {humanDateRangeLabel(fromDate, toDate)}
              </Typography>
            </Box>
            <Chip label={`${filtered.length.toLocaleString()} rows${records.length !== filtered.length ? ` of ${records.length.toLocaleString()}` : ''}`} size="small" color="primary" variant="outlined" />
          </Box>

          <Box sx={{ overflowX: 'auto', maxHeight: 620, overflowY: 'auto' }}>
            <table style={{ fontSize: 11.5, borderCollapse: 'collapse', width: 'max-content' }}>
              <thead>
                {/* GROUP ROW — sticks at top: 0 */}
                <tr>
                  <th rowSpan={2} style={{ ...thS, top: 0, zIndex: 4, background: '#f7f9fc' }}>ID</th>
                  <th rowSpan={2} style={{ ...thS, top: 0, zIndex: 4, background: '#f7f9fc' }}>Candle Close</th>
                  <th rowSpan={2} style={{ ...thS, top: 0, zIndex: 4, background: '#f7f9fc', borderRight: '2px solid #c4cdd9' }}>Chart</th>
                  <th colSpan={7} style={{ ...grpTh, top: 0, background: '#eff6ff', color: '#1d4ed8', borderRight: '2px solid #c4cdd9' }}>Price (OHLC)</th>
                  <th colSpan={3} style={{ ...grpTh, top: 0, background: '#f5f3ff', color: '#6d28d9', borderRight: '2px solid #c4cdd9' }}>Oscillators</th>
                  <th rowSpan={2} style={{ ...thS, top: 0, zIndex: 4, background: '#f7f9fc', borderRight: '2px solid #c4cdd9' }}>Volume</th>
                  <th colSpan={6} style={{ ...grpTh, top: 0, background: '#fefce8', color: '#854d0e', borderRight: '2px solid #c4cdd9' }}>Bollinger Bands</th>
                  <th colSpan={4} style={{ ...grpTh, top: 0, background: '#f0fdf4', color: '#15803d', borderRight: '2px solid #c4cdd9' }}>ADX</th>
                  <th colSpan={6} style={{ ...grpTh, top: 0, background: '#fdf4ff', color: '#86198f', borderRight: '2px solid #c4cdd9' }}>300c Performance</th>
                  <th colSpan={4} style={{ ...grpTh, top: 0, background: '#f0fdfa', color: '#0d9488', borderRight: '2px solid #c4cdd9' }}>Future Perf</th>
                  <th colSpan={3} style={{ ...grpTh, top: 0, background: '#fff7ed', color: '#c2410c', borderRight: '2px solid #c4cdd9' }}>Divergence</th>
                  <th colSpan={6} style={{ ...grpTh, top: 0, background: '#f0fdf4', color: '#15803d', borderRight: '2px solid #c4cdd9' }}>Div From Candle</th>
                  <th colSpan={6} style={{ ...grpTh, top: 0, background: '#fef2f2', color: '#dc2626' }}>Div To Candle</th>
                </tr>
                {/* COLUMN NAME ROW — sticks at top: 29px (height of group row) */}
                <tr>
                  <th style={{ ...colTh, top: 29 }}>Open</th>
                  <th style={{ ...colTh, top: 29 }}>High</th>
                  <th style={{ ...colTh, top: 29 }}>Low</th>
                  <th style={{ ...colTh, top: 29 }}>Close</th>
                  <th style={{ ...colTh, top: 29 }}>Color</th>
                  <th style={{ ...colTh, top: 29 }}>Chg%</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>Type</th>
                  <th style={{ ...colTh, top: 29 }}>RSI</th>
                  <th style={{ ...colTh, top: 29 }}>SRSI-K</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>SRSI-D</th>
                  <th style={{ ...colTh, top: 29 }}>BBL</th>
                  <th style={{ ...colTh, top: 29 }}>BBM</th>
                  <th style={{ ...colTh, top: 29 }}>BBU</th>
                  <th style={{ ...colTh, top: 29 }}>BBB</th>
                  <th style={{ ...colTh, top: 29 }}>BBP</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>Status</th>
                  <th style={{ ...colTh, top: 29 }}>ADX</th>
                  <th style={{ ...colTh, top: 29 }}>DI+</th>
                  <th style={{ ...colTh, top: 29 }}>DI-</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>DX</th>
                  <th style={{ ...colTh, top: 29 }}>Pos Ratio</th>
                  <th style={{ ...colTh, top: 29 }}>Hi%</th>
                  <th style={{ ...colTh, top: 29 }}>Lo%</th>
                  <th style={{ ...colTh, top: 29 }}>Volatility</th>
                  <th style={{ ...colTh, top: 29 }}>Hi Age</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>Lo Age</th>
                  <th style={{ ...colTh, top: 29 }}>6c%</th>
                  <th style={{ ...colTh, top: 29 }}>12c%</th>
                  <th style={{ ...colTh, top: 29 }}>18c%</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>24c%</th>
                  <th style={{ ...colTh, top: 29 }}>Type</th>
                  <th style={{ ...colTh, top: 29 }}>Len</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>Chg%</th>
                  <th style={{ ...colTh, top: 29 }}>Close TS</th>
                  <th style={{ ...colTh, top: 29 }}>Close</th>
                  <th style={{ ...colTh, top: 29 }}>RSI</th>
                  <th style={{ ...colTh, top: 29 }}>BBB</th>
                  <th style={{ ...colTh, top: 29 }}>BBP</th>
                  <th style={{ ...colTh, top: 29, borderRight: '2px solid #c4cdd9' }}>Status</th>
                  <th style={{ ...colTh, top: 29 }}>Close TS</th>
                  <th style={{ ...colTh, top: 29 }}>Close</th>
                  <th style={{ ...colTh, top: 29 }}>RSI</th>
                  <th style={{ ...colTh, top: 29 }}>BBB</th>
                  <th style={{ ...colTh, top: 29 }}>BBP</th>
                  <th style={{ ...colTh, top: 29 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec) => {
                  const d = rec.data || {}, bb = d.bb_data || {}, adx = d.adx_data || {};
                  const perf = d.performance_data || {}, rm = perf.range_metrics || {};
                  const pm = perf.price_metrics || {}, pfh = perf.performance_from_high || {}, pfl = perf.performance_from_low || {};
                  const dv = d.divergence_data || {}, fc = dv.from_candle_data || {}, tc = dv.to_candle_data || {};
                  const fp = h => {
                    const hd = d.future_performance_data?.horizons?.[`${h}_candles`];
                    if (!hd?.available) return '--';
                    const v = hd.price_movement?.final_return_percent;
                    return v == null ? '--' : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
                  };
                  const fpCol = h => {
                    const hd = d.future_performance_data?.horizons?.[`${h}_candles`];
                    if (!hd?.available) return undefined;
                    const v = hd.price_movement?.final_return_percent;
                    return v > 0 ? '#15803d' : v < 0 ? '#dc2626' : undefined;
                  };
                  const bbpNum = Number(bb.bbp);
                  const bg = rowBg(rec);
                  const ts = d.candle_close_ts || rec.candle_close_ts;
                  return (
                    <tr key={rec.id} style={{ background: bg || 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={tdS}>{rec.id}</td>
                      <td style={{ ...tdS, fontSize: 11, whiteSpace: 'nowrap' }}>{humanDateTime(ts)}</td>
                      <td style={{ ...tdS, padding: '4px 8px', borderRight: '2px solid #e2e8f0' }}><CandleCanvas open={d.open} high={d.high} low={d.low} close={d.close} /></td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(d.open)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(d.high)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(d.low)}</td>
                      <td style={{ ...tdS, fontFamily: MONO, fontWeight: 600 }}>{fp2(d.close)}</td>
                      <td style={{ ...tdS, color: d.candle_color === 'green' ? '#15803d' : '#dc2626', fontWeight: 600, fontSize: 10 }}>{d.candle_color || '--'}</td>
                      <td style={{ ...tdS, color: d.percent_change >= 0 ? '#15803d' : '#dc2626' }}>{fpct(d.percent_change)}</td>
                      <td style={{ ...tdS, fontSize: 10.5, borderRight: '2px solid #e2e8f0', color: d.candle_type?.includes('bullish') || d.candle_type?.includes('hammer') ? '#15803d' : d.candle_type?.includes('bearish') || d.candle_type?.includes('shooting') ? '#dc2626' : '#64748b' }}>{d.candle_type || '--'}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(d.rsi)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(d.srsi_k)}</td>
                      <td style={{ ...tdS, fontFamily: MONO, borderRight: '2px solid #e2e8f0' }}>{f2(d.srsi_d)}</td>
                      <td style={{ ...tdS, fontFamily: MONO, borderRight: '2px solid #e2e8f0' }}>{Number.isFinite(Number(d.volume)) ? Number(d.volume).toLocaleString() : '--'}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(bb.bbl)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(bb.bbm)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(bb.bbu)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(bb.bbb)}</td>
                      <td style={{ ...tdS, fontFamily: MONO, color: Number.isFinite(bbpNum) && bbpNum < 0 ? '#dc2626' : Number.isFinite(bbpNum) && bbpNum > 1 ? '#15803d' : undefined }}>{f2(bb.bbp)}</td>
                      <td style={{ ...tdS, fontSize: 10, whiteSpace: 'nowrap', borderRight: '2px solid #e2e8f0', color: '#64748b' }}>{bb.candle_status?.replace(/_/g, ' ') || '--'}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(adx.adx)}</td>
                      <td style={{ ...tdS, fontFamily: MONO, color: '#15803d' }}>{f2(adx.dip)}</td>
                      <td style={{ ...tdS, fontFamily: MONO, color: '#dc2626' }}>{f2(adx.din)}</td>
                      <td style={{ ...tdS, fontFamily: MONO, borderRight: '2px solid #e2e8f0' }}>{f2(adx.dx)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(rm.position_ratio)}</td>
                      <td style={{ ...tdS, color: pfh.percent_change < 0 ? '#dc2626' : pfh.percent_change > 0 ? '#15803d' : undefined }}>{pfh.percent_change != null ? fpct(pfh.percent_change) : '--'}</td>
                      <td style={{ ...tdS, color: pfl.percent_change > 0 ? '#15803d' : pfl.percent_change < 0 ? '#dc2626' : undefined }}>{pfl.percent_change != null ? fpct(pfl.percent_change) : '--'}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(rm.volatility_score)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{pm.high_candle_index != null ? pm.high_candle_index + 'c' : '--'}</td>
                      <td style={{ ...tdS, fontFamily: MONO, borderRight: '2px solid #e2e8f0' }}>{pm.low_candle_index != null ? pm.low_candle_index + 'c' : '--'}</td>
                      {[6, 12, 18, 24].map((h, i) => (
                        <td key={h} style={{ ...tdS, fontFamily: MONO, color: fpCol(h), ...(i === 3 && { borderRight: '2px solid #e2e8f0' }) }}>{fp(h)}</td>
                      ))}
                      <td style={{ ...tdS, color: dv.type === 'bullish' ? '#15803d' : dv.type === 'bearish' ? '#dc2626' : '#94a3b8', fontWeight: 600, fontSize: 12 }}>{dv.type || '--'}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{dv.length || '--'}</td>
                      <td style={{ ...tdS, fontFamily: MONO, borderRight: '2px solid #e2e8f0', color: dv.price_change_percent > 0 ? '#15803d' : dv.price_change_percent < 0 ? '#dc2626' : undefined }}>{dv.price_change_percent != null ? dv.price_change_percent + '%' : '--'}</td>
                      <td style={{ ...tdS, fontSize: 10.5, whiteSpace: 'nowrap' }}>{humanDateTime(fc.ts_pdt)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(fc.close)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(fc.rsi)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(fc.bb_data?.bbb)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(fc.bb_data?.bbp)}</td>
                      <td style={{ ...tdS, fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', borderRight: '2px solid #e2e8f0' }}>{fc.bb_data?.candle_status?.replace(/_/g, ' ') || '--'}</td>
                      <td style={{ ...tdS, fontSize: 10.5, whiteSpace: 'nowrap' }}>{humanDateTime(tc.ts_pdt)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{fp2(tc.close)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(tc.rsi)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(tc.bb_data?.bbb)}</td>
                      <td style={{ ...tdS, fontFamily: MONO }}>{f2(tc.bb_data?.bbp)}</td>
                      <td style={{ ...tdS, fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{tc.bb_data?.candle_status?.replace(/_/g, ' ') || '--'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
        </Paper>
      )}

      {fetched && !loading && filtered.length === 0 && !error && (
        <Paper variant="outlined" sx={{ borderRadius: 2, textAlign: 'center', py: 6 }}>
          <Typography variant="h5" sx={{ opacity: 0.12, mb: 1 }}>--</Typography>
          <Typography variant="body2" fontWeight={600} color="text.secondary">No records match current filters</Typography>
          <Typography variant="caption" color="text.disabled">Try adjusting the filter options above</Typography>
        </Paper>
      )}
    </Box>
  );
}

// Shared table cell styles
const thBase = {
  padding: '8px 10px',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '.03em',
  borderBottom: '1px solid #e2e8f0',
  borderRight: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  position: 'sticky',
  // NOTE: top is set per-element (group row = 0, col name row = 29)
};
const thS   = { ...thBase, textAlign: 'center', top: 0, zIndex: 3 };
const grpTh = { ...thBase, textAlign: 'center', padding: '6px 10px', top: 0, zIndex: 3 };
const colTh = { ...thBase, textAlign: 'center', fontWeight: 600, fontSize: 10.5, color: '#475569', background: '#f7f9fc', top: 29, zIndex: 2 };
const tdS   = { padding: '5px 8px', fontSize: 11.5, borderRight: '1px solid #f1f5f9', textAlign: 'center', color: '#334155', whiteSpace: 'nowrap' };
