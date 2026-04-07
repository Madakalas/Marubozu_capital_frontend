import React, { useState } from 'react';
import {
  Box, Typography, Button, Paper, TextField, MenuItem, Select,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { API, apiFetch } from '../api';
import { useAppCtx } from '../context/AppContext';
import { PageHeader, Card, Alert } from '../components/UI';
import { useAssets, useTimeframes } from '../hooks/useData';

const PREDEFINED_TF = [
  { value: '5min',  displayName: '5 Min',   seconds: 300 },
  { value: '15min', displayName: '15 Min',  seconds: 900 },
  { value: '30min', displayName: '30 Min',  seconds: 1800 },
  { value: '1hour', displayName: '1 Hour',  seconds: 3600 },
  { value: '2hour', displayName: '2 Hour',  seconds: 7200 },
  { value: '4hour', displayName: '4 Hour',  seconds: 14400 },
  { value: '8hour', displayName: '8 Hour',  seconds: 28800 },
  { value: '12hour',displayName: '12 Hour', seconds: 43200 },
  { value: '1day',  displayName: '1 Day',   seconds: 86400 },
  { value: '1week', displayName: '1 Week',  seconds: 604800 },
];

const MONO = "'JetBrains Mono','Fira Code',monospace";
const selectSx = { fontSize: 13, height: 38 };

export default function ManageAssets() {
  const { assets, loading: aLoad, reload: reloadA } = useAssets();
  const { timeframes, loading: tLoad, reload: reloadT } = useTimeframes();
  const { reloadAssets: reloadGlobalAssets, reloadTimeframes: reloadGlobalTFs } = useAppCtx();

  const [aModal, setAModal] = useState({ open: false, id: null, name: '' });
  const [tModal, setTModal] = useState({ open: false, id: null, value: '', displayName: '', seconds: '' });
  const [msg,    setMsg]    = useState('');
  const [error,  setError]  = useState('');

  function flash(m, isErr = false) {
    if (isErr) { setError(m); setTimeout(() => setError(''), 4000); }
    else       { setMsg(m);   setTimeout(() => setMsg(''),   3500); }
  }
  function refreshAll() { reloadA(); reloadT(); reloadGlobalAssets(); reloadGlobalTFs(); }

  // ── Assets ──
  async function saveAsset() {
    if (!aModal.name.trim()) { flash('Asset name required', true); return; }
    try {
      const url = aModal.id ? `${API.assets}/${aModal.id}` : API.assets;
      const r = await apiFetch(url, { method: aModal.id ? 'PUT' : 'POST', body: JSON.stringify({ name: aModal.name.trim().toUpperCase() }) });
      refreshAll(); setAModal({ open: false, id: null, name: '' }); flash(r.message || 'Saved');
    } catch (e) { flash(e.message, true); }
  }
  async function deleteAsset(id, name) {
    if (!window.confirm(`Delete asset "${name}"?`)) return;
    try { await apiFetch(`${API.assets}/${id}`, { method: 'DELETE' }); refreshAll(); flash('Asset deleted'); }
    catch (e) { flash(e.message, true); }
  }

  // ── Timeframes ──
  function onTfPick(value) {
    const pre = PREDEFINED_TF.find(t => t.value === value);
    setTModal(p => ({ ...p, value, displayName: pre?.displayName || value, seconds: pre?.seconds || '' }));
  }
  async function saveTf() {
    const { id, value, displayName, seconds } = tModal;
    if (!value || !displayName || !seconds) { flash('All fields required', true); return; }
    try {
      const url = id ? `${API.timeframes}/${id}` : API.timeframes;
      const r = await apiFetch(url, { method: id ? 'PUT' : 'POST', body: JSON.stringify({ value, displayName, seconds: parseInt(seconds) }) });
      refreshAll(); setTModal({ open: false, id: null, value: '', displayName: '', seconds: '' }); flash(r.message || 'Saved');
    } catch (e) { flash(e.message, true); }
  }
  async function deleteTf(id, value) {
    if (!window.confirm(`Delete timeframe "${value}"?`)) return;
    try { await apiFetch(`${API.timeframes}/${id}`, { method: 'DELETE' }); refreshAll(); flash('Timeframe deleted'); }
    catch (e) { flash(e.message, true); }
  }

  const sortedAssets     = [...assets].sort((a, b) => a.name.localeCompare(b.name));
  const sortedTimeframes = [...timeframes].sort((a, b) => a.seconds - b.seconds);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        title="Assets & Timeframes"
        sub="Add, edit, or delete tickers and intervals — changes reflect everywhere instantly"
      />

      {msg   && <Alert type="success">{msg}</Alert>}
      {error && <Alert type="error">{error}</Alert>}

      {/* Info banner */}
      <Paper
        variant="outlined"
        sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, mb: 2.5, borderRadius: 2, bgcolor: '#eff6ff', borderColor: '#93c5fd' }}
      >
        <InfoOutlinedIcon sx={{ color: '#1d4ed8', fontSize: 18, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ fontSize: 13, color: '#1d4ed8' }}>
          Changes you make here will immediately update all dropdowns across every page — no page refresh needed.
        </Typography>
      </Paper>

      {/* ── ASSETS TABLE ── */}
      <Card
        title={`Assets — ${sortedAssets.length} configured`}
        subtitle="Trading pairs the signal engine monitors"
        actions={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setAModal({ open: true, id: null, name: '' })}
          >
            Add Asset
          </Button>
        }
        noPad
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>ID</TableCell>
                <TableCell>Asset Name</TableCell>
                <TableCell>Created</TableCell>
                <TableCell sx={{ width: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {aLoad ? (
                <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>Loading…</TableCell></TableRow>
              ) : sortedAssets.length === 0 ? (
                <TableRow><TableCell colSpan={4} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>No assets configured</TableCell></TableRow>
              ) : sortedAssets.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}>{a.id}</TableCell>
                  <TableCell>
                    <Chip
                      label={a.name}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, color: '#1d4ed8', borderColor: '#93c5fd', bgcolor: '#eff6ff' }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: MONO, fontSize: 11, color: 'text.secondary' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                        onClick={() => setAModal({ open: true, id: a.id, name: a.name })}
                        sx={{ fontSize: 11, py: 0.5 }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
                        onClick={() => deleteAsset(a.id, a.name)}
                        sx={{ fontSize: 11, py: 0.5 }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── TIMEFRAMES TABLE ── */}
      <Card
        title={`Timeframes — ${sortedTimeframes.length} configured`}
        subtitle="Chart intervals for backtesting and live signals — sorted by duration"
        actions={
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setTModal({ open: true, id: null, value: '', displayName: '', seconds: '' })}
          >
            Add Timeframe
          </Button>
        }
        noPad
      >
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 60 }}>ID</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Display Name</TableCell>
                <TableCell>Seconds</TableCell>
                <TableCell>Created</TableCell>
                <TableCell sx={{ width: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tLoad ? (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>Loading…</TableCell></TableRow>
              ) : sortedTimeframes.length === 0 ? (
                <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>No timeframes configured</TableCell></TableRow>
              ) : sortedTimeframes.map(t => (
                <TableRow key={t.id} hover>
                  <TableCell sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}>{t.id}</TableCell>
                  <TableCell>
                    <Chip
                      label={t.value}
                      size="small"
                      variant="outlined"
                      sx={{ fontFamily: MONO, fontWeight: 700, fontSize: 12, color: '#1d4ed8', borderColor: '#93c5fd', bgcolor: '#eff6ff' }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>{t.display_name}</TableCell>
                  <TableCell sx={{ fontFamily: MONO, fontSize: 12, color: 'text.secondary' }}>{t.seconds?.toLocaleString()}</TableCell>
                  <TableCell sx={{ fontFamily: MONO, fontSize: 11, color: 'text.secondary' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.75 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                        onClick={() => setTModal({ open: true, id: t.id, value: t.value, displayName: t.display_name, seconds: t.seconds })}
                        sx={{ fontSize: 11, py: 0.5 }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon sx={{ fontSize: 14 }} />}
                        onClick={() => deleteTf(t.id, t.value)}
                        sx={{ fontSize: 11, py: 0.5 }}
                      >
                        Delete
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* ── ASSET MODAL ── */}
      <Dialog open={aModal.open} onClose={() => setAModal({ open: false, id: null, name: '' })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>{aModal.id ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
            Asset name
          </Typography>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. ETHUSD"
            value={aModal.name}
            onChange={e => setAModal(p => ({ ...p, name: e.target.value }))}
            inputProps={{ style: { textTransform: 'uppercase' } }}
            helperText="Enter trading pair (ETHUSD, BTCUSD, SOLUSD…)"
            autoFocus
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setAModal({ open: false, id: null, name: '' })}>Cancel</Button>
          <Button variant="contained" onClick={saveAsset}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* ── TIMEFRAME MODAL ── */}
      <Dialog open={tModal.open} onClose={() => setTModal({ open: false, id: null, value: '', displayName: '', seconds: '' })} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle>{tModal.id ? 'Edit Timeframe' : 'Add New Timeframe'}</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Timeframe
              </Typography>
              <Select fullWidth size="small" value={tModal.value} onChange={e => onTfPick(e.target.value)} sx={selectSx}>
                <MenuItem value="" sx={{ fontSize: 13, color: 'text.disabled' }}>— Select predefined interval —</MenuItem>
                {PREDEFINED_TF.map(t => (
                  <MenuItem key={t.value} value={t.value} sx={{ fontSize: 13 }}>
                    {t.value} — {t.displayName}
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Display name
              </Typography>
              <TextField
                fullWidth size="small"
                value={tModal.displayName}
                onChange={e => setTModal(p => ({ ...p, displayName: e.target.value }))}
                helperText="Auto-filled from selection"
              />
            </Box>
            <Box>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
                Seconds
              </Typography>
              <TextField
                fullWidth size="small"
                type="number"
                value={tModal.seconds}
                onChange={e => setTModal(p => ({ ...p, seconds: e.target.value }))}
                helperText="Auto-filled from selection"
              />
            </Box>
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setTModal({ open: false, id: null, value: '', displayName: '', seconds: '' })}>Cancel</Button>
          <Button variant="contained" onClick={saveTf}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
