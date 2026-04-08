import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, Paper, Grid,
  CircularProgress, Divider, Select, MenuItem,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { API, apiPost } from '../api';
import { UNPROCESSED_POLL_MS } from '../hooks/useData';
import { useAppCtx } from '../context/AppContext';
import { PageHeader, Card, Alert, CodeBlock } from '../components/UI';
import { COLOR } from '../theme';

export default function UploadFile() {
  const { assetNames } = useAppCtx();
  const [file,         setFile]         = useState(null);
  const [ticker,       setTicker_]      = useState('');
  const [loading,      setLoading]      = useState(false);
  const [processing,   setProcessing]   = useState(false);
  const [result,       setResult]       = useState(null);
  const [processResult, setProcessResult] = useState(null);
  const [error,        setError]        = useState('');
  const [processError, setProcessError] = useState('');
  const [drag,         setDrag]         = useState(false);
  const [unprocessedCount, setUnprocessedCount] = useState(null);
  /** Green highlight on Select File drop zone only after processing completes */
  const [selectFileSuccessHighlight, setSelectFileSuccessHighlight] = useState(false);
  const fileInputRef = useRef(null);
  const selectSuccessTimerRef = useRef(null);

  const clearSelectSuccessTimer = useCallback(() => {
    if (selectSuccessTimerRef.current) {
      clearTimeout(selectSuccessTimerRef.current);
      selectSuccessTimerRef.current = null;
    }
  }, []);

  const allowedAssetSet = useMemo(
    () => new Set((assetNames || []).map(n => String(n).trim().toUpperCase()).filter(Boolean)),
    [assetNames]
  );

  const safeAssets = useMemo(
    () => (assetNames || []).map(n => String(n).trim()).filter(Boolean),
    [assetNames]
  );

  function validateCsvFile(f) {
    if (!f || !f.name || !f.name.toLowerCase().endsWith('.csv'))
      return { ok: false, message: 'Please select a .csv file.' };
    if (!allowedAssetSet.size)
      return { ok: false, message: 'Assets not loaded yet. Please wait a moment.' };
    return { ok: true };
  }

  function inferTickerFromFileName(name = '') {
    return String(name).replace(/\.csv$/i, '').trim().toUpperCase();
  }

  const refreshUnprocessed = useCallback(async () => {
    try {
      const res = await fetch(API.unprocessed, { cache: 'no-store' });
      const json = await res.json();
      if (json.unprocessed_count != null) setUnprocessedCount(json.unprocessed_count);
    } catch {
      /* ignore */
    }
  }, []);

  function pickFile(f) {
    clearSelectSuccessTimer();
    setSelectFileSuccessHighlight(false);
    setResult(null); setProcessResult(null);
    const check = validateCsvFile(f);
    if (!check.ok) {
      setFile(null);
      setTicker_('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(check.message);
      return;
    }
    const inferred = inferTickerFromFileName(f.name);
    if (!allowedAssetSet.has(inferred)) {
      setFile(null);
      setTicker_('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setError(
        `No asset "${inferred}" (from filename). Add it under Assets & Timeframes, or rename the file to match an existing asset (e.g. BTCUSD.csv).`
      );
      return;
    }
    setFile(f);
    setError('');
    setTicker_(inferred);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) { setError('CSV file is required'); return; }
    if (!ticker.trim()) { setError('Select a ticker (asset) from the dropdown.'); return; }
    const check = validateCsvFile(file);
    if (!check.ok) { setError(check.message); return; }
    const inferred = inferTickerFromFileName(file.name);
    const tUpper = ticker.trim().toUpperCase();
    if (!allowedAssetSet.has(tUpper)) {
      setError(`Ticker "${tUpper}" is not in the Assets list. Add it under Assets & Timeframes first.`);
      return;
    }
    if (inferred !== tUpper) {
      setError(`Ticker must match the CSV filename. Select "${inferred}" (from ${file.name}) or use a file named ${tUpper}.csv.`);
      return;
    }
    setLoading(true); setResult(null); setProcessResult(null); setError('');
    const fd = new FormData(); fd.append('file', file);
    let url = API.upload;
    url += `?ticker=${encodeURIComponent(tUpper)}`;
    try {
      const res = await fetch(url, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
      setResult(json);
      await refreshUnprocessed();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleProcessData() {
    clearSelectSuccessTimer();
    setSelectFileSuccessHighlight(false);
    setProcessing(true); setProcessResult(null); setProcessError('');
    await refreshUnprocessed();
    try {
      const uploadLimit = result?.rows_inserted != null
        ? Number(result.rows_inserted)
        : (unprocessedCount != null ? Number(unprocessedCount) : 10000);
      const limit = Number.isFinite(uploadLimit) && uploadLimit > 0 ? Math.min(uploadLimit, 10000) : 10000;
      // Commit every row so unprocessed count updates truly live.
      const r = await apiPost(API.processData, { limit, commit_every: 1 });
      if (r.status === 'success') {
        setProcessResult(r);
        setSelectFileSuccessHighlight(true);
        clearSelectSuccessTimer();
        selectSuccessTimerRef.current = setTimeout(() => {
          setSelectFileSuccessHighlight(false);
          setProcessResult(null);
          selectSuccessTimerRef.current = null;
        }, 2800);
        // Clear only the file picker state after processing completes.
        // Keep Upload Result visible until user uploads another file.
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      else setProcessError(r.message || 'Processing failed');
    } catch (e) { setProcessError(e.message); }
    finally {
      setProcessing(false);
      await refreshUnprocessed();
    }
  }

  const pollRef = useRef(null);
  useEffect(() => {
    refreshUnprocessed();
  }, [refreshUnprocessed]);

  useEffect(() => {
    if (!processing) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    refreshUnprocessed();
    pollRef.current = setInterval(refreshUnprocessed, UNPROCESSED_POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [processing, refreshUnprocessed]);

  useEffect(() => () => clearSelectSuccessTimer(), [clearSelectSuccessTimer]);

  function onDrop(e) {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    pickFile(f);
  }

  const metrics = result ? Object.entries(result).filter(([, v]) => typeof v !== 'object' || v === null) : [];

  const primaryMetrics = metrics.filter(([k]) => k !== 'saved_to');
  const savedToMetric = metrics.find(([k]) => k === 'saved_to');

  const rowsInserted = result?.rows_inserted != null ? Number(result.rows_inserted) : null;
  const rowsSkipped = result?.rows_skipped != null ? Number(result.rows_skipped) : null;
  const rowsToProcessHint =
    rowsInserted != null && Number.isFinite(rowsInserted)
      ? rowsInserted
      : null;

  const previewRows = Array.isArray(result?.preview_rows) ? result.preview_rows : [];
  const previewCols = previewRows.length ? Object.keys(previewRows[0]) : [];

  const selectSx = { fontSize: 13, height: 38 };
  const hasUnprocessedRows = unprocessedCount != null && Number(unprocessedCount) > 0;
  const canProcess = processing || hasUnprocessedRows || (rowsToProcessHint != null && rowsToProcessHint > 0);

  const totalRowsDisplay =
    result?.rows_in_file != null && Number.isFinite(Number(result.rows_in_file))
      ? Number(result.rows_in_file)
      : rowsToProcessHint != null
        ? rowsToProcessHint
        : null;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        title="Upload CSV Data"
        sub="Import historical OHLCV price data exported from TradingView"
      />

      {/* ── UPLOAD FORM ── */}
      <Card
        title="Select File"
        style={
          selectFileSuccessHighlight
            ? {
                borderColor: '#86efac',
                bgcolor: '#f0fdf4',
                transition: 'background-color 0.35s ease, border-color 0.35s ease',
              }
            : { transition: 'background-color 0.35s ease, border-color 0.35s ease' }
        }
      >
        <form onSubmit={handleUpload}>
          <Grid container spacing={2.5} alignItems="stretch">
            {/* Drop zone — green only after processing completes; not when file merely selected */}
            <Grid item xs={12} sm={8}>
              <Paper
                variant="outlined"
                onDragOver={e => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('csv-file-input').click()}
                sx={{
                  height: 160,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  border: '2px dashed',
                  borderColor: selectFileSuccessHighlight
                    ? 'success.main'
                    : drag
                      ? 'primary.main'
                      : file
                        ? 'primary.light'
                        : 'divider',
                  borderRadius: 2,
                  bgcolor: selectFileSuccessHighlight
                    ? COLOR.green.bg
                    : drag
                      ? 'primary.light'
                      : file
                        ? 'grey.100'
                        : 'grey.50',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: selectFileSuccessHighlight ? COLOR.green.bg : 'primary.light',
                  },
                }}
              >
                {file ? (
                  <>
                    <CheckCircleOutlineIcon sx={{ fontSize: 36, color: selectFileSuccessHighlight ? 'success.main' : 'primary.main' }} />
                    <Typography fontWeight={600} color={selectFileSuccessHighlight ? 'success.dark' : 'primary.dark'} sx={{ fontSize: 13 }}>
                      {file.name}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Click to change file
                    </Typography>
                  </>
                ) : (
                  <>
                    <UploadFileIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
                    <Typography fontWeight={600} color="text.secondary" sx={{ fontSize: 13 }}>
                      Drag & drop CSV or click to browse
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'center', px: 2 }}>
                      File name must match an asset (e.g. <strong>BTCUSD.csv</strong>). Ticker auto-fills from the name.
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Required columns: time, open, high, low, close, Volume, RSI, K, D
                    </Typography>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={e => pickFile(e.target.files[0])}
                />
              </Paper>
            </Grid>

            {/* Controls */}
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 2, minHeight: 160 }}>
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                    Ticker (required)
                  </Typography>
                  <Select
                    fullWidth
                    size="small"
                    displayEmpty
                    value={ticker}
                    onChange={e => setTicker_(e.target.value)}
                    sx={selectSx}
                    renderValue={v => (v ? v : <Typography component="span" color="text.disabled" sx={{ fontSize: 13 }}>Select asset…</Typography>)}
                  >
                    <MenuItem value="" disabled sx={{ fontSize: 13 }}>
                      Select asset…
                    </MenuItem>
                    {safeAssets.map(n => (
                      <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75, fontSize: 11 }}>
                    Must match CSV filename (e.g. BTCUSD.csv → BTCUSD).
                  </Typography>
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={!file || loading || !ticker}
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
                  sx={{ mt: 'auto' }}
                >
                  {loading ? 'Uploading…' : 'Upload File'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>

        {error && (
          <Box sx={{ mt: 2 }}>
            <Alert type="error">{error}</Alert>
          </Box>
        )}
      </Card>

      {/* Always available process panel (survives reload) */}
      {(canProcess || processResult || processError) && (
        <Card
          title="Process"
          subtitle="Computes indicators (RSI, bands, ADX, etc.) on raw rows. Total rows = size of your last CSV upload; Unprocessed = rows still waiting in the queue. Click Process when Unprocessed is greater than zero."
        >
          <Grid container spacing={2} alignItems="stretch">
            <Grid item xs={12} md={4}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  textAlign: 'center',
                  bgcolor: 'grey.50',
                  borderColor: 'divider',
                  height: '100%',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                    color: 'text.secondary',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  Total rows
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'primary.dark' }}>
                  {totalRowsDisplay != null ? totalRowsDisplay.toLocaleString() : '—'}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={8}>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: { xs: 'stretch', sm: 'center' },
                  gap: 2,
                  height: '100%',
                }}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    textAlign: 'center',
                    bgcolor: 'grey.50',
                    borderColor: 'divider',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.08em',
                      color: 'text.secondary',
                      display: 'block',
                      mb: 1,
                    }}
                  >
                    Unprocessed rows
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
                    {unprocessedCount != null ? unprocessedCount.toLocaleString() : '—'}
                  </Typography>
                </Paper>
                <Button
                  variant="contained"
                  color="primary"
                  disabled={processing || !hasUnprocessedRows}
                  onClick={handleProcessData}
                  startIcon={processing ? <CircularProgress size={16} color="inherit" /> : <PlayCircleOutlineIcon />}
                  sx={{
                    minWidth: { xs: '100%', sm: 160 },
                    height: 56,
                    flexShrink: 0,
                    alignSelf: { xs: 'stretch', sm: 'center' },
                  }}
                >
                  {processing ? '…' : 'Process'}
                </Button>
              </Box>
            </Grid>
          </Grid>
          {processResult && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 22, fontVariantNumeric: 'tabular-nums' }}>
                {Number(processResult.processed ?? 0).toLocaleString()}
                {processResult.errors > 0 && (
                  <Typography component="span" color="error" sx={{ fontSize: 16, fontWeight: 700, ml: 1 }}>
                    ({processResult.errors})
                  </Typography>
                )}
              </Typography>
            </Box>
          )}
          {processError && (
            <Box sx={{ mt: 2 }}>
              <Alert type="error" style={{ mb: 0 }}>{processError}</Alert>
            </Box>
          )}
        </Card>
      )}

      {/* ── UPLOAD RESULT ── */}
      {result && (
        <Card title="Upload Result">
          <Alert type="success" style={{ mb: 2.5 }}>
            Upload successful — <strong>{result.rows_inserted?.toLocaleString() ?? '—'}</strong> rows inserted
            for <strong>{result.ticker}</strong> ({result.interval})
            {rowsSkipped != null && rowsSkipped > 0 && (
              <> · <strong>{rowsSkipped.toLocaleString()}</strong> duplicate rows skipped (already in DB)</>
            )}
            {rowsInserted === 0 && rowsSkipped != null && rowsSkipped > 0 && (
              <> — all rows were already present.</>
            )}
          </Alert>

          {/* Metrics */}
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            {primaryMetrics.map(([k, v]) => (
              <Grid item xs={12} sm={6} md={3} key={k}>
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 1.5, textAlign: 'center', bgcolor: 'grey.50' }}
                >
                  <Typography variant="caption" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.disabled', fontWeight: 700, display: 'block' }}>
                    {k.replace(/_/g, ' ')}
                  </Typography>
                  <Typography
                    fontWeight={700}
                    sx={{
                      fontSize: 13,
                      mt: 0.25,
                      color: 'text.primary',
                      wordBreak: 'break-all',
                      whiteSpace: 'normal',
                    }}
                  >
                    {v === null ? 'null' : String(v)}
                  </Typography>
                </Paper>
              </Grid>
            ))}
            {savedToMetric && (
              <Grid item xs={12}>
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'grey.50' }}
                >
                  <Typography variant="caption" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.disabled', fontWeight: 700, display: 'block' }}>
                    {savedToMetric[0].replace(/_/g, ' ')}
                  </Typography>
                  <Typography
                    fontWeight={700}
                    sx={{
                      fontSize: 13,
                      mt: 0.25,
                      color: 'text.primary',
                      wordBreak: 'break-all',
                      whiteSpace: 'normal',
                    }}
                  >
                    {savedToMetric[1] === null ? 'null' : String(savedToMetric[1])}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>

          <Divider sx={{ mb: 2.5 }} />

          {/* Uploaded CSV preview table */}
          {previewRows.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography fontWeight={700} sx={{ fontSize: 14, mb: 1 }}>
                Uploaded CSV preview ({previewRows.length.toLocaleString()} rows shown)
              </Typography>
              <Box
                sx={{
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                      <tr>
                        {previewCols.map(col => (
                          <th
                            key={col}
                            style={{
                              padding: '6px 8px',
                              textAlign: 'left',
                              borderBottom: '1px solid #e2e8f0',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '.04em',
                              fontSize: 10,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          {previewCols.map(col => (
                            <td
                              key={col}
                              style={{
                                padding: '5px 8px',
                                borderRight: '1px solid #f8fafc',
                                whiteSpace: 'nowrap',
                                maxWidth: 180,
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                              }}
                            >
                              {row[col] == null ? '' : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Box>
              </Box>
            </Box>
          )}

          <Box sx={{ mt: 2 }}>
            <CodeBlock data={result} />
          </Box>
        </Card>
      )}

      {/* ── ACTION REQUIRED note (only before upload) ── */}
      {!result && (
        <Card title="Required Workflow" accent="amber">
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 22, flexShrink: 0, mt: 0.25 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.7 }}>
              After uploading, click <strong style={{ color: '#0f172a' }}>Process Data</strong> to compute all technical
              indicators (RSI, Bollinger Bands, ADX, Divergence). The upload only saves raw OHLCV data — indicators are
              computed in a separate step. Without processing, the backtest engine will find zero signals.
            </Typography>
          </Box>
        </Card>
      )}
    </Box>
  );
}
