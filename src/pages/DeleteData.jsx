import React, { useMemo, useState } from 'react';
import {
  Box, Typography, Button, Grid, TextField, Select, MenuItem,
  Divider, CircularProgress, Radio, RadioGroup, FormControlLabel,
} from '@mui/material';
import { API, apiPost } from '../api';
import { useAppCtx } from '../context/AppContext';
import { PageHeader, Card, Alert } from '../components/UI';

const toLocalDateTime = (dateStr, endOfDay = false) => {
  if (!dateStr) return null;
  // App uses input type="date" -> YYYY-MM-DD
  const t = endOfDay ? 'T23:59:59' : 'T00:00:00';
  return `${dateStr}${t}`;
};

export default function DeleteData() {
  const { assetNames, tfValues, fromDate: globalFrom, toDate: globalTo } = useAppCtx();

  const [asset, setAsset] = useState('');
  const [timeframe, setTimeframe] = useState('');

  const [scope, setScope] = useState('all'); // all | range
  const [rangeFrom, setRangeFrom] = useState(globalFrom || '');
  const [rangeTo, setRangeTo] = useState(globalTo || '');

  const [loadingRaw, setLoadingRaw] = useState(false);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [error, setError] = useState('');
  const [rawRes, setRawRes] = useState(null);
  const [indRes, setIndRes] = useState(null);

  const safeAssets = useMemo(() => (assetNames || []).map(n => String(n).trim()).filter(Boolean), [assetNames]);
  const safeTFs = useMemo(() => (tfValues || []).map(v => String(v).trim()).filter(Boolean), [tfValues]);

  // Auto-default selections when lists load.
  React.useEffect(() => {
    if (!safeAssets.length) return;
    if (!asset) setAsset(safeAssets.includes('ETHUSD') ? 'ETHUSD' : safeAssets[0]);
  }, [safeAssets, asset]);

  React.useEffect(() => {
    if (!safeTFs.length) return;
    if (!timeframe) setTimeframe(safeTFs.includes('4hour') ? '4hour' : safeTFs[0]);
  }, [safeTFs, timeframe]);

  const canDeleteIndicators = asset && timeframe && (scope === 'all' || (rangeFrom && rangeTo && rangeFrom <= rangeTo));

  async function handleDeleteRaw() {
    if (!window.confirm('Delete ALL processed rows from TradingViewRawData? This cannot be undone.')) return;
    setError('');
    setRawRes(null);
    setLoadingRaw(true);
    try {
      const r = await apiPost(API.deleteRaw, {});
      if (r?.status === 'success') setRawRes(r);
      else setError(r?.message || 'Delete failed');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingRaw(false);
    }
  }

  async function handleDeleteIndicators() {
    if (!canDeleteIndicators) {
      setError('Select ticker, timeframe, and a valid date range (when using range scope).');
      return;
    }
    const msg =
      scope === 'all'
        ? `Delete ALL indicators for ${asset} @ ${timeframe}? This cannot be undone.`
        : `Delete indicators for ${asset} @ ${timeframe} between ${rangeFrom} and ${rangeTo}? This cannot be undone.`;
    if (!window.confirm(msg)) return;

    setError('');
    setIndRes(null);
    setLoadingIndicators(true);
    try {
      const payload = {
        ticker: asset,
        chart_interval: timeframe,
        scope,
      };
      if (scope === 'range') {
        payload.from_datetime = toLocalDateTime(rangeFrom, false);
        payload.to_datetime = toLocalDateTime(rangeTo, true);
      }
      const r = await apiPost(API.deleteIndicators, payload);
      if (r?.status === 'success') setIndRes(r);
      else setError(r?.message || 'Delete failed');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingIndicators(false);
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Delete Data"
        sub="Maintenance tools to wipe processed raw rows and indicator data safely (requires confirmation)"
      />

      <Card title="Delete processed raw rows" accent="amber">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
          This removes all rows where `is_processed = true` from the <strong>TradingViewRawData</strong> table.
        </Typography>
        <Button
          variant="contained"
          color="error"
          disabled={loadingRaw}
          onClick={handleDeleteRaw}
          startIcon={loadingRaw ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ height: 40 }}
        >
          {loadingRaw ? 'Deleting…' : 'Delete processed raw rows'}
        </Button>
        {rawRes && (
          <Box sx={{ mt: 2 }}>
            <Alert type="success" style={{ marginBottom: 0 }}>
              Deleted <strong>{rawRes.deleted ?? 0}</strong> processed raw rows.
            </Alert>
          </Box>
        )}
      </Card>

      <Card title="Delete indicators (TechnicalIndicatorsData)" accent="amber">
        <Grid container spacing={2} alignItems="flex-end" sx={{ mb: 1.5 }}>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Asset
            </Typography>
            <Select fullWidth size="small" value={asset} onChange={e => setAsset(e.target.value)}>
              {safeAssets.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </Select>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Timeframe (chart_interval)
            </Typography>
            <Select fullWidth size="small" value={timeframe} onChange={e => setTimeframe(e.target.value)}>
              {safeTFs.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
            </Select>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Scope
            </Typography>
            <RadioGroup row value={scope} onChange={(_, v) => setScope(v)}>
              <FormControlLabel value="all" control={<Radio size="small" />} label="All" />
              <FormControlLabel value="range" control={<Radio size="small" />} label="Date range" />
            </RadioGroup>
          </Grid>
        </Grid>

        {scope === 'range' && (
          <Grid container spacing={2} sx={{ mb: 1.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                size="small"
                label="From"
                value={rangeFrom}
                onChange={e => setRangeFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="date"
                size="small"
                label="To"
                inputProps={{ min: rangeFrom || undefined }}
                value={rangeTo}
                onChange={e => setRangeTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        )}

        <Divider sx={{ mb: 1.5 }} />

        <Button
          variant="contained"
          color="error"
          disabled={!canDeleteIndicators || loadingIndicators}
          onClick={handleDeleteIndicators}
          startIcon={loadingIndicators ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{ height: 40 }}
        >
          {loadingIndicators ? 'Deleting…' : scope === 'all' ? 'Delete indicators (all)' : 'Delete indicators (range)'}
        </Button>

        {indRes && (
          <Box sx={{ mt: 2 }}>
            <Alert type="success" style={{ marginBottom: 0 }}>
              Deleted <strong>{indRes.deleted ?? 0}</strong> indicator rows.
            </Alert>
          </Box>
        )}
      </Card>

      {error && (
        <Box sx={{ mt: 2 }}>
          <Alert type="error" style={{ marginBottom: 0 }}>{error}</Alert>
        </Box>
      )}
    </Box>
  );
}

