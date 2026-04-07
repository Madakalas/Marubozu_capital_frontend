import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Grid, Typography, Button, MenuItem, Select,
  CircularProgress, TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useAppCtx } from '../context/AppContext';
import { API, INTERVALS, fmt } from '../api';
import { PageHeader, Card, Alert, DataTable, SignalBadge, ConfBadge, MetricGrid, DateRangePicker } from '../components/UI';

const MONO = "'JetBrains Mono','Fira Code',monospace";
const selectSx = { fontSize: 13, height: 38 };

export default function BacktestResults({ isActive }) {
  const { ticker, setTicker, interval, setInterval, fromDate, setFromDate, toDate, setToDate, assetNames, tfValues } = useAppCtx();
  const [signal,      setSignal]      = useState('');
  const [rulesetNum,  setRulesetNum]  = useState('');
  const [limit,       setLimit]       = useState('1000');
  const [loading,     setLoading]     = useState(false);
  const [results,     setResults]     = useState([]);
  const [stats,       setStats]       = useState(null);
  const [error,       setError]       = useState('');
  const prevActive = useRef(false);
  const lastLoadedKey = useRef(null);

  const doQuery = useCallback(async () => {
    if (!ticker) return;
    setLoading(true); setResults([]); setStats(null); setError('');
    const p = new URLSearchParams();
    p.append('ticker', ticker); p.append('chart_interval', interval); p.append('limit', limit);
    if (fromDate) p.append('from_date', fromDate);
    if (toDate)   p.append('to_date', toDate);
    if (signal)      p.append('signal', signal);
    if (rulesetNum)  p.append('ruleset_number', rulesetNum);
    try {
      const r = await fetch(`${API.backtestResults}?${p}`).then(r => r.json());
      if (r.status === 'success' && r.data?.results?.length) { setResults(r.data.results); setStats(r.data.statistics); }
      else if (r.status === 'success') setResults([]);
      else setError(r.message || 'Query failed');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [ticker, interval, fromDate, toDate, signal, rulesetNum, limit]);

  const loadWithCache = useCallback(async (force = false) => {
    if (!ticker || !fromDate || !toDate) return;
    const key = `${ticker}|${interval}|${fromDate}|${toDate}`;
    if (!force && lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;
    await doQuery();
  }, [ticker, interval, fromDate, toDate, doQuery]);

  useEffect(() => {
    const nowActive = isActive !== false;
    if (!nowActive) return;
    if (!ticker || !fromDate || !toDate) return;
    loadWithCache(false);
  }, [isActive, ticker, interval, fromDate, toDate, loadWithCache]);

  useEffect(() => {
    const nowActive = isActive !== false;
    if (nowActive && prevActive.current === false) {
      lastLoadedKey.current = null;
      if (ticker && fromDate && toDate) loadWithCache(true);
    }
    prevActive.current = nowActive;
  }, [isActive, ticker, interval, fromDate, toDate, loadWithCache]);

  const cols = [
    { label: '#',          key: 'id',           style: { width: 55 },
      render: r => <Typography sx={{ fontFamily: MONO, fontSize: 12 }}>{r.id}</Typography> },
    { label: 'Date (PDT)', render: r => <Typography sx={{ fontFamily: MONO, fontSize: 11, whiteSpace: 'nowrap' }}>{fmt.ts(r.candle_close_ts)}</Typography> },
    { label: 'Ticker',     key: 'ticker',
      render: r => <Typography fontWeight={600} sx={{ fontSize: 13 }}>{r.ticker}</Typography> },
    { label: 'Interval',   key: 'chart_interval',
      render: r => <Typography sx={{ fontFamily: MONO, fontSize: 12 }}>{r.chart_interval}</Typography> },
    { label: 'Signal',     render: r => <SignalBadge signal={r.signal} /> },
    { label: 'Close',      render: r => <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 500 }}>${fmt.price(r.close)}</Typography> },
    { label: 'Confidence', render: r => <ConfBadge value={r.confidence} /> },
    { label: 'Ruleset',    render: r => <Typography sx={{ fontFamily: MONO, fontSize: 12, color: '#1d4ed8' }}>{r.ruleset_number}</Typography> },
    { label: 'Rule name',  render: r => <Typography sx={{ fontSize: 12, color: '#64748b', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{r.ruleset_name || '—'}</Typography> },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Backtest Results"
        sub="Query and filter all stored signal matches"
      />

      <Card title="Query Filters">
        <Grid container spacing={2} sx={{ mb: 2 }} alignItems="flex-end">
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
          <Grid item xs={12} sm={6}>
            <DateRangePicker
              from={fromDate} to={toDate}
              onFromChange={v => { setFromDate(v); if (!toDate || (v && toDate < v)) setToDate(v); }}
              onToChange={setToDate}
            />
          </Grid>
        </Grid>

        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Signal type
            </Typography>
            <Select fullWidth size="small" value={signal} onChange={e => setSignal(e.target.value)} sx={selectSx}>
              <MenuItem value="" sx={{ fontSize: 13 }}>All signals</MenuItem>
              <MenuItem value="buy" sx={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>Buy only</MenuItem>
              <MenuItem value="sell" sx={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Sell only</MenuItem>
            </Select>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Ruleset number
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g. UNIV1 or 8HR3"
              value={rulesetNum}
              onChange={e => setRulesetNum(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { height: 38 } }}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Max results
            </Typography>
            <Select fullWidth size="small" value={limit} onChange={e => setLimit(e.target.value)} sx={selectSx}>
              {['100', '500', '1000', '5000'].map(n => (
                <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid item xs={6} sm={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                onClick={() => loadWithCache(true)}
                disabled={loading || !ticker}
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                sx={{ flex: 1, height: 38 }}
              >
                {loading ? 'Loading…' : 'Query'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => { setSignal(''); setRulesetNum(''); setLimit('1000'); }}
                startIcon={<RestartAltIcon />}
                sx={{ height: 38 }}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>

        {error && <Alert type="error" style={{ mt: 2 }}>{error}</Alert>}
      </Card>

      {stats && (
        <MetricGrid metrics={[
          { label: 'Total signals',  value: fmt.num(stats.total_signals), color: 'blue', sub: `Showing ${results.length}` },
          { label: 'Buy signals',    value: fmt.num(stats.buy_signals),   color: 'green' },
          { label: 'Sell signals',   value: fmt.num(stats.sell_signals),  color: 'red' },
          { label: 'Avg confidence', value: stats.avg_confidence?.toFixed(1) ?? '—', color: 'purple' },
        ]} />
      )}

      <Card
        title={`Results${results.length ? ` — ${results.length.toLocaleString()} rows` : ''}`}
        subtitle="Timestamps shown in PDT"
        noPad
      >
        <DataTable
          columns={cols}
          rows={results}
          loading={loading}
          emptyTitle="No results found"
          emptyIcon="◻"
        />
      </Card>
    </Box>
  );
}
