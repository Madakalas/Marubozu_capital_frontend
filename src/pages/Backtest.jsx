import React, { useState, useEffect, useRef } from 'react';
import { Chart, ArcElement, BarElement, BarController, DoughnutController, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import {
  Box, Grid, Typography, Button, Paper, MenuItem, Select,
  CircularProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useAppCtx } from '../context/AppContext';
import { API, INTERVALS, apiPost, apiFetch, fmt } from '../api';
import { PageHeader, Card, Alert, RadioGroup, DateRangePicker } from '../components/UI';
import { COLOR } from '../theme';

Chart.register(ArcElement, BarElement, BarController, DoughnutController, CategoryScale, LinearScale, Tooltip, Legend);

const selectSx = { fontSize: 13, height: 38 };

const METRIC_COLORS = {
  blue:   COLOR.blue,
  green:  COLOR.green,
  amber:  COLOR.amber,
  red:    COLOR.red,
  purple: COLOR.purple,
  teal:   COLOR.teal,
};

export default function Backtest({ isActive }) {
  const { ticker, setTicker, interval, setInterval, fromDate, setFromDate, toDate, setToDate, assetNames, tfValues } = useAppCtx();
  const [dataRange, setDataRange] = useState('all');
  const [loading,   setLoading]   = useState(false);
  const [liveLoad,  setLiveLoad]  = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState('');
  const [msg,       setMsg]       = useState('');
  const donutRef = useRef(null), barRef = useRef(null);
  const donutC   = useRef(null), barC   = useRef(null);
  const prevActive = useRef(false);
  const lastLoadedKey = useRef(null);

  function destroyCharts() { donutC.current?.destroy(); donutC.current = null; barC.current?.destroy(); barC.current = null; }
  useEffect(() => () => destroyCharts(), []);

  useEffect(() => {
    if (!result) return;
    const stats = result.statistics || {};
    const buy = stats.buy_signals || 0, sell = stats.sell_signals || 0;
    const dist = stats.ruleset_distribution || {};
    destroyCharts();
    if (donutRef.current && (buy + sell) > 0) {
      donutC.current = new Chart(donutRef.current, {
        type: 'doughnut',
        data: { labels: ['Buy', 'Sell'], datasets: [{ data: [buy, sell], backgroundColor: ['#22c55e', '#ef4444'], borderWidth: 0, hoverOffset: 8 }] },
        options: { cutout: '68%', plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, color: '#374151', padding: 14 } } }, animation: { duration: 600 } },
      });
    }
    const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (barRef.current && entries.length) {
      barC.current = new Chart(barRef.current, {
        type: 'bar',
        data: { labels: entries.map(([k]) => k), datasets: [{ data: entries.map(([, v]) => v), backgroundColor: entries.map((_, i) => i % 2 === 0 ? 'rgba(79,126,248,.75)' : 'rgba(79,126,248,.45)'), borderRadius: 5, borderSkipped: false }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { color: '#9ca3af', font: { size: 11 } } }, y: { grid: { display: false }, ticks: { color: '#374151', font: { size: 11 } } } }, animation: { duration: 600 } },
      });
    }
  }, [result]);

  async function run(e, { force = false } = {}) {
    e?.preventDefault?.();
    if (dataRange === 'range' && (!fromDate || !toDate)) { setError('Both dates required'); return; }
    const key = `${ticker}|${interval}|${dataRange}|${fromDate || ''}|${toDate || ''}`;
    if (!force && lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;
    setLoading(true); setResult(null); setError(''); destroyCharts();
    const body = { ticker, chart_interval: interval };
    if (dataRange === 'range') { body.from_date = fromDate; body.to_date = toDate; }
    try {
      const r = await apiPost(API.backtest, body);
      if (r.status === 'success') setResult(r.result);
      else setError(r.message || 'Backtest failed');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    const nowActive = isActive !== false;
    if (!nowActive) return;
    if (!ticker) return;
    if (dataRange === 'range' && (!fromDate || !toDate)) return;
    run(null, { force: false });
    // eslint-disable-next-line
  }, [isActive, ticker, interval, dataRange, fromDate, toDate]);

  useEffect(() => {
    const nowActive = isActive !== false;
    if (nowActive && prevActive.current === false) {
      if (ticker && (dataRange !== 'range' || (fromDate && toDate))) run(null, { force: true });
    }
    prevActive.current = nowActive;
    // eslint-disable-next-line
  }, [isActive, ticker, interval, dataRange, fromDate, toDate]);

  async function processLive() {
    setLiveLoad(true); setError(''); setMsg('');
    try {
      const r = await apiPost(API.liveSignals, { limit: 100 });
      if (r.status === 'success') setMsg(`✓ ${r.candles_processed} candles processed — ${r.signals_generated} signals generated`);
      else setError(r.message || 'Live processing failed');
    } catch (e) { setError(e.message); }
    finally { setLiveLoad(false); }
  }

  async function clearCache() {
    if (!window.confirm(`Delete all backtest results for ${ticker} ${interval}?`)) return;
    try {
      const r = await apiFetch(API.backtestResults, { method: 'DELETE', body: JSON.stringify({ ticker, chart_interval: interval }) });
      setMsg(r.message || 'Cache cleared'); setResult(null);
    } catch (e) { setError(e.message); }
  }

  const stats = result?.statistics || {}, buy = stats.buy_signals || 0, sell = stats.sell_signals || 0, total = buy + sell;

  const metrics = [
    { label: 'Candles processed', value: fmt.num(result?.processed_candles), color: 'blue'   },
    { label: 'Total signals',     value: fmt.num(total),                      color: total > 0 ? 'green' : 'amber' },
    { label: 'Buy signals',       value: fmt.num(buy),                        color: 'green'  },
    { label: 'Sell signals',      value: fmt.num(sell),                       color: 'red'    },
    { label: 'Avg confidence',    value: stats.avg_confidence ? stats.avg_confidence.toFixed(1) : '—', color: 'purple' },
    { label: 'Processing time',   value: fmt.dur(result?.duration_seconds),   color: 'teal'   },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Backtesting"
        sub="Run signal matching against historical data · process live signals · manage cache"
      />

      {msg   && <Alert type="success" onClose={() => setMsg('')}>{msg}</Alert>}
      {error && <Alert type="error"   onClose={() => setError('')}>{error}</Alert>}

      {/* ── CONFIGURATION ── */}
      <Card title="Configuration">
        <form onSubmit={run}>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Asset
              </Typography>
              <Select fullWidth size="small" value={ticker} onChange={e => setTicker(e.target.value)} required sx={selectSx}>
                {(assetNames.length ? assetNames : [ticker]).map(n => (
                  <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Interval
              </Typography>
              <Select fullWidth size="small" value={interval} onChange={e => setInterval(e.target.value)} required sx={selectSx}>
                {(tfValues.length ? tfValues : INTERVALS).map(v => (
                  <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{v}</MenuItem>
                ))}
              </Select>
            </Grid>
          </Grid>

          <Box sx={{ mb: 2.5 }}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 1 }}>
              Data Range
            </Typography>
            <RadioGroup
              options={[
                { value: 'all',   label: 'All available data', sub: 'Full historical' },
                { value: 'range', label: 'Custom date range',  sub: 'Specific period' },
              ]}
              value={dataRange}
              onChange={setDataRange}
            />
          </Box>

          {dataRange === 'range' && (
            <Box sx={{ mb: 2.5, maxWidth: 480 }}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 1 }}>
                Date Range
              </Typography>
              <DateRangePicker
                from={fromDate} to={toDate}
                onFromChange={v => { setFromDate(v); if (!toDate || (v && toDate < v)) setToDate(v); }}
                onToChange={setToDate}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !ticker}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
            >
              {loading ? 'Running…' : 'Run Backtest'}
            </Button>
            <Button
              type="button"
              variant="contained"
              color="success"
              onClick={processLive}
              disabled={liveLoad}
              startIcon={liveLoad ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
            >
              {liveLoad ? 'Processing…' : 'Process Live Signals'}
            </Button>
            <Button
              type="button"
              variant="outlined"
              color="error"
              onClick={clearCache}
              startIcon={<DeleteOutlineIcon />}
            >
              Clear Cache
            </Button>
          </Box>
        </form>
      </Card>

      {/* ── LOADING STATE ── */}
      {loading && (
        <Card title="Running…">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, gap: 1.5 }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              Analyzing {ticker} {interval} — may take a moment…
            </Typography>
          </Box>
        </Card>
      )}

      {/* ── RESULTS ── */}
      {result && !loading && (
        <>
          {/* All 6 metrics in a single horizontal row */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'nowrap', overflowX: 'auto' }}>
            {metrics.map((m) => {
              const c = METRIC_COLORS[m.color] || COLOR.blue;
              return (
                <Paper
                  key={m.label}
                  variant="outlined"
                  sx={{
                    p: 2, borderRadius: 2, textAlign: 'center',
                    flex: '1 1 0', minWidth: 110,
                    bgcolor: c.bg, borderColor: c.border,
                  }}
                >
                  <Typography variant="caption" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: c.text, opacity: 0.75, display: 'block', mb: 0.5 }}>
                    {m.label}
                  </Typography>
                  <Typography fontWeight={700} sx={{ color: c.text, fontVariantNumeric: 'tabular-nums', fontSize: 20, my: 0.25 }}>
                    {m.value}
                  </Typography>
                </Paper>
              );
            })}
          </Box>

          <Grid container spacing={2.5}>
            {/* Donut chart */}
            <Grid item xs={12} sm={5}>
              <Card title="Signal breakdown" subtitle="Buy vs sell ratio">
                {total > 0 ? (
                  <Box sx={{ position: 'relative', maxWidth: 260, mx: 'auto', pb: 1 }}>
                    <canvas ref={donutRef} />
                    <Box sx={{
                      position: 'absolute', top: '42%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center', pointerEvents: 'none',
                    }}>
                      <Typography variant="h5" fontWeight={700}>{total.toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">signals</Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">No signals generated</Typography>
                  </Box>
                )}
              </Card>
            </Grid>

            {/* Bar chart */}
            <Grid item xs={12} sm={7}>
              <Card title="Signals per ruleset" subtitle="Top 10 triggered rules">
                {Object.keys(stats.ruleset_distribution || {}).length > 0 ? (
                  <Box sx={{ position: 'relative', height: 240 }}>
                    <canvas ref={barRef} />
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body2" color="text.secondary">No ruleset data</Typography>
                  </Box>
                )}
              </Card>
            </Grid>
          </Grid>

          {/* Confidence distribution */}
          {stats.confidence_distribution && Object.keys(stats.confidence_distribution).length > 0 && (
            <Card title="Confidence distribution" subtitle="Signals per confidence bucket">
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {Object.entries(stats.confidence_distribution)
                  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                  .map(([bucket, cnt]) => {
                    const n = parseInt(bucket);
                    const c = n >= 120 ? COLOR.green : n >= 110 ? COLOR.amber : COLOR.blue;
                    return (
                      <Paper
                        key={bucket}
                        variant="outlined"
                        sx={{ p: 2, borderRadius: 2, minWidth: 120, textAlign: 'center', flex: '1 1 auto', bgcolor: c.bg, borderColor: c.border }}
                      >
                        <Typography fontWeight={700} sx={{ fontSize: 22, color: c.text, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono',monospace" }}>
                          {cnt}
                        </Typography>
                        <Typography variant="caption" sx={{ color: c.text, opacity: 0.75 }}>
                          Conf {bucket}
                        </Typography>
                      </Paper>
                    );
                  })}
              </Box>
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
