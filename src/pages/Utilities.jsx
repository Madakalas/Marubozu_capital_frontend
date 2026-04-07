import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Grid, Typography, Button, Paper, MenuItem, Select,
  CircularProgress, Chip, LinearProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAppCtx } from '../context/AppContext';
import { API, INTERVALS, apiPost } from '../api';
import { PageHeader, Card, Alert } from '../components/UI';
import { COLOR } from '../theme';

const selectSx = { fontSize: 13, height: 38 };

/* ─── Gap Analysis ──────────────────────────────────── */
export function GapAnalysis() {
  const { ticker, setTicker, interval, setInterval, assetNames, tfValues } = useAppCtx();
  const [length,  setLength]  = useState('100');
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');

  async function submit(e) {
    e.preventDefault(); setLoading(true); setResult(null); setError('');
    try {
      const r = await apiPost(API.gapAnalysis, { ticker, interval, length: parseInt(length) });
      setResult(r);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <PageHeader title="Gap Analysis" sub="Detect missing candles in your historical dataset" />

      <Card title="Query">
        <form onSubmit={submit}>
          <Grid container spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
            <Grid item xs={6} sm={4}>
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
              <Select fullWidth size="small" value={interval} onChange={e => setInterval(e.target.value)} sx={selectSx}>
                {(tfValues.length ? tfValues : INTERVALS).map(v => (
                  <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{v}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Expected candles
              </Typography>
              <Select fullWidth size="small" value={length} onChange={e => setLength(e.target.value)} sx={selectSx}>
                {['50', '100', '200', '300', '400', '500'].map(n => (
                  <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={6} sm={2}>
              <Button
                type="submit"
                variant="contained"
                disabled={loading || !ticker}
                fullWidth
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
                sx={{ height: 38 }}
              >
                {loading ? 'Analyzing…' : 'Analyze'}
              </Button>
            </Grid>
          </Grid>
        </form>
        {error && <Alert type="error">{error}</Alert>}
      </Card>

      {result && (
        <Card title="Results">
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {[
              { label: 'Expected', value: result.expected_candles, color: COLOR.blue },
              { label: 'Received', value: result.received_candles, color: result.received_candles === result.expected_candles ? COLOR.green : COLOR.amber },
              { label: 'Missing',  value: result.missing_count,    color: result.missing_count === 0 ? COLOR.green : COLOR.red },
            ].map(m => (
              <Grid item xs={4} key={m.label}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, textAlign: 'center', bgcolor: m.color.bg, borderColor: m.color.border }}>
                  <Typography variant="caption" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700, color: m.color.text, opacity: 0.75, display: 'block', mb: 0.5 }}>
                    {m.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: m.color.text, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono',monospace" }}>
                    {m.value?.toLocaleString()}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {result.missing_count === 0
            ? <Alert type="success">No gaps found — dataset is complete for this ticker/interval.</Alert>
            : <Alert type="warning">{result.missing_count} missing candle{result.missing_count > 1 ? 's' : ''} detected.</Alert>
          }

          {result.missing_timestamps_pdt?.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 1 }}>
                Missing timestamps (PDT)
              </Typography>
              <Box sx={{ maxHeight: 160, overflow: 'auto', display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {result.missing_timestamps_pdt.map((ts, i) => (
                  <Chip
                    key={i}
                    label={ts}
                    size="small"
                    sx={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 11,
                      bgcolor: COLOR.red.bg,
                      color: COLOR.red.text,
                      border: `1px solid ${COLOR.red.border}`,
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Card>
      )}
    </Box>
  );
}

/* ─── Recompute Technicals ────────────────────────── */
export function RecomputeTechnicals() {
  const { ticker, setTicker, interval, setInterval, assetNames, tfValues } = useAppCtx();
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');

  async function submit(e) {
    e.preventDefault(); setLoading(true); setResult(null); setError('');
    try {
      const r = await apiPost(API.recompute, { ticker, interval });
      setResult(r);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <PageHeader title="Recompute Technicals" sub="Recalculate RSI, Bollinger Bands, ADX, divergence and all indicators from scratch" />

      <Card title="Parameters">
        <Alert type="warning" style={{ mb: 2.5 }}>
          This rewrites all indicator data for the selected ticker/interval. May take several minutes for large datasets.
        </Alert>
        <form onSubmit={submit}>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={6} sm={4}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Asset
              </Typography>
              <Select fullWidth size="small" value={ticker} onChange={e => setTicker(e.target.value)} required sx={selectSx}>
                {(assetNames.length ? assetNames : [ticker]).map(n => (
                  <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Interval
              </Typography>
              <Select fullWidth size="small" value={interval} onChange={e => setInterval(e.target.value)} sx={selectSx}>
                {(tfValues.length ? tfValues : INTERVALS).map(v => (
                  <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{v}</MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                type="submit"
                variant="contained"
                color="warning"
                disabled={loading || !ticker}
                fullWidth
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
                sx={{ height: 38 }}
              >
                {loading ? 'Processing…' : 'Recompute All'}
              </Button>
            </Grid>
          </Grid>
          {error && <Alert type="error" style={{ mt: 2 }}>{error}</Alert>}
        </form>
      </Card>

      {result && (
        <Card title="Result">
          {result.status === 'success'
            ? <Alert type="success">
                ✓ Recomputed <strong>{result.recomputed?.toLocaleString()}</strong> candles for{' '}
                <strong>{result.ticker}</strong> / <strong>{result.interval || interval}</strong>
              </Alert>
            : <Alert type="error">{result.message || JSON.stringify(result)}</Alert>
          }
        </Card>
      )}
    </Box>
  );
}

/* ─── Unprocessed Monitor ──────────────────────────── */
export function UnprocessedMonitor() {
  const [count, setCount] = useState(null);
  const [last,  setLast]  = useState(null);
  const [error, setError] = useState('');
  const [cd,    setCd]    = useState(10);

  const fetch_ = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(API.unprocessed);
      const data = await res.json();
      if (data.status === 'success') { setCount(data.unprocessed_count); setLast(new Date()); setCd(10); }
      else throw new Error(data.message);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => {
    fetch_();
    const ri = setInterval(fetch_, 10000);
    const ci = setInterval(() => setCd(c => c <= 0 ? 10 : c - 1), 1000);
    return () => { clearInterval(ri); clearInterval(ci); };
  }, [fetch_]);

  const c = count == null ? COLOR.blue : count <= 10 ? COLOR.green : count <= 100 ? COLOR.amber : COLOR.red;
  const statusLabel = count == null ? '—' : count <= 10 ? 'Healthy' : count <= 100 ? 'Warning' : 'Critical';
  const StatusIcon = count == null ? null : count <= 10 ? CheckCircleOutlineIcon : count <= 100 ? WarningAmberIcon : ErrorOutlineIcon;

  return (
    <Box sx={{ p: 3, maxWidth: 800 }}>
      <PageHeader
        title="System Monitor"
        sub="Real-time unprocessed row counter — auto-refreshes every 10 seconds"
      />

      <Grid container spacing={2.5}>
        {/* Main counter */}
        <Grid item xs={12} sm={7}>
          <Paper
            variant="outlined"
            sx={{ p: 3, borderRadius: 2, bgcolor: c.bg, borderColor: c.border }}
          >
            <Typography variant="caption" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: c.text, opacity: 0.75, display: 'block', mb: 0.5 }}>
              Unprocessed rows
            </Typography>
            <Typography
              sx={{
                fontSize: 64,
                fontWeight: 800,
                color: c.text,
                fontFamily: "'JetBrains Mono',monospace",
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                mb: 1,
              }}
            >
              {count !== null ? count.toLocaleString() : '—'}
            </Typography>
            <Typography variant="caption" sx={{ color: c.text, opacity: 0.65, display: 'block', mb: 2 }}>
              {error ? `Error: ${error}` : last ? `Updated ${last.toLocaleTimeString()}` : 'Fetching…'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={fetch_}
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                sx={{ borderColor: c.border, color: c.text, '&:hover': { borderColor: c.text, bgcolor: 'transparent' } }}
              >
                Refresh
              </Button>
              <Typography variant="caption" sx={{ color: c.text, opacity: 0.6 }}>
                Auto-refresh in {cd}s
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={((10 - cd) / 10) * 100}
              sx={{ mt: 2, borderRadius: 99, height: 3, bgcolor: `${c.border}`, '& .MuiLinearProgress-bar': { bgcolor: c.mid || c.text } }}
            />
          </Paper>
        </Grid>

        {/* Status sidebar */}
        <Grid item xs={12} sm={5}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Current status */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                Current status
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {StatusIcon && <StatusIcon sx={{ color: c.text, fontSize: 22 }} />}
                <Typography variant="h6" fontWeight={700} sx={{ color: c.text }}>
                  {statusLabel}
                </Typography>
              </Box>
            </Paper>

            {/* Status guide */}
            {[
              { label: 'Healthy',  range: '0–10 rows',   color: COLOR.green  },
              { label: 'Warning',  range: '11–100 rows', color: COLOR.amber  },
              { label: 'Critical', range: '100+ rows',   color: COLOR.red    },
            ].map(({ label, range, color }) => (
              <Paper
                key={label}
                variant="outlined"
                sx={{ px: 2, py: 1.25, borderRadius: 2, bgcolor: color.bg, borderColor: color.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Typography fontWeight={600} sx={{ fontSize: 13, color: color.text }}>{label}</Typography>
                <Typography variant="caption" sx={{ fontSize: 11, color: color.text, opacity: 0.75 }}>{range}</Typography>
              </Paper>
            ))}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
