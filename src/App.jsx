import React, { useState, useEffect } from 'react';
import {
  Box, AppBar, Toolbar, Drawer, List, ListItemButton, ListItemIcon,
  ListItemText, Divider, Typography, IconButton, Chip, useTheme, alpha,
  Tooltip, Badge,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { AppProvider } from './context/AppContext';
import { useUnprocessed, UNPROCESSED_POLL_MS } from './hooks/useData';

import Dashboard          from './pages/Dashboard';
import DataViewer         from './pages/DataViewer';
import UploadFile         from './pages/UploadFile';
import ManageAssets       from './pages/ManageAssets';
import DeleteData        from './pages/DeleteData';
import Backtest           from './pages/Backtest';
import BacktestResults    from './pages/BacktestResults';
import BacktestAnalysis   from './pages/BacktestAnalysis';
import { GapAnalysis, RecomputeTechnicals, UnprocessedMonitor } from './pages/Utilities';
import { SignalEDA, MTFBacktestAnalysis } from './pages/AdvancedPages';

const DRAWER_WIDTH = 252;

// Custom SVG nav icons (unchanged from original)
function NavIcon({ k }) {
  const props = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (k) {
    case 'data_viewer':
      return <svg viewBox="0 0 24 24" {...props}><path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 15l3-4 3 2 4-6"/></svg>;
    case 'upload_file':
      return <svg viewBox="0 0 24 24" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5-5 5 5"/><path d="M12 5v14"/></svg>;
    case 'gap_analysis':
      return <svg viewBox="0 0 24 24" {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8 12h6"/></svg>;
    case 'recompute_technicals':
      return <svg viewBox="0 0 24 24" {...props}><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>;
    case 'backtest':
      return <svg viewBox="0 0 24 24" {...props}><path d="M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z"/></svg>;
    case 'backtest_results':
      return <svg viewBox="0 0 24 24" {...props}><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>;
    case 'backtest_analysis':
      return <svg viewBox="0 0 24 24" {...props}><path d="M4 19V5"/><path d="M4 19h17"/><path d="M7 14l3-3 3 2 4-6"/><path d="M7 14v4"/></svg>;
    case 'mtf_backtest_analysis':
      return <svg viewBox="0 0 24 24" {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M3 12h3"/></svg>;
    case 'signal_eda':
      return <svg viewBox="0 0 24 24" {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-3.4-3.4"/><path d="M9 13l3-6 3 6"/></svg>;
    case 'unprocessed_monitor':
      return <svg viewBox="0 0 24 24" {...props}><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>;
    case 'manage_assets':
      return <svg viewBox="0 0 24 24" {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 7v10"/></svg>;
    case 'delete_data':
      return <svg viewBox="0 0 24 24" {...props}><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1-2h10l1 2"/><path d="M7 7l1 14h8l1-14"/></svg>;
    default:
      return <svg viewBox="0 0 24 24" {...props}><path d="M12 2v20"/><path d="M2 12h20"/></svg>;
  }
}

const NAV = [
  { group: 'Data management', items: [
    { key: 'data_viewer',          label: 'Data Viewer' },
    { key: 'upload_file',          label: 'Upload CSV' },
    { key: 'delete_data',         label: 'Delete Data' },
    { key: 'gap_analysis',         label: 'Gap Analysis' },
    { key: 'recompute_technicals', label: 'Recompute Technicals' },
  ]},
  { group: 'Strategy & backtesting', items: [
    { key: 'backtest',              label: 'Run Backtest' },
    { key: 'backtest_results',      label: 'Results Viewer' },
    { key: 'backtest_analysis',     label: 'Chart Analysis' },
    { key: 'mtf_backtest_analysis', label: 'MTF Analysis' },
    { key: 'signal_eda',            label: 'Signal EDA' },
  ]},
  { group: 'System', items: [
    { key: 'unprocessed_monitor', label: 'System Monitor' },
    { key: 'manage_assets',       label: 'Assets & Timeframes' },
  ]},
];

const ALL_PAGE_KEYS = [
  'dashboard', 'data_viewer', 'upload_file', 'gap_analysis', 'recompute_technicals',
  'manage_assets', 'delete_data', 'backtest', 'backtest_results', 'backtest_analysis',
  'mtf_backtest_analysis', 'signal_eda', 'unprocessed_monitor',
];

function AppShell() {
  const [page,       setPage]       = useState('dashboard');
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count } = useUnprocessed();
  const theme = useTheme();

  useEffect(() => {
    const h = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); setCollapsed(c => !c); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); setPage('dashboard'); }
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const go = key => { setPage(key); setMobileOpen(false); };

  const unprocessedSeverity = count == null ? 'default'
    : count <= 10  ? 'success'
    : count <= 100 ? 'warning'
    : 'error';

  const pageComponents = {
    dashboard:             <Dashboard navigate={go} count={count} />,
    data_viewer:           <DataViewer isActive={page === 'data_viewer'} />,
    upload_file:           <UploadFile />,
    delete_data:          <DeleteData />,
    gap_analysis:          <GapAnalysis />,
    recompute_technicals:  <RecomputeTechnicals />,
    manage_assets:         <ManageAssets />,
    backtest:              <Backtest isActive={page === 'backtest'} />,
    backtest_results:      <BacktestResults isActive={page === 'backtest_results'} />,
    backtest_analysis:     <BacktestAnalysis isActive={page === 'backtest_analysis'} />,
    mtf_backtest_analysis: <MTFBacktestAnalysis isActive={page === 'mtf_backtest_analysis'} />,
    signal_eda:            <SignalEDA isActive={page === 'signal_eda'} />,
    unprocessed_monitor:   <UnprocessedMonitor />,
  };

  const navItemSx = (active) => ({
    borderRadius: 1.5,
    minHeight: 36,
    px: 1.5,
    py: 0.5,
    mb: 0.25,
    color: active ? 'primary.main' : 'text.secondary',
    backgroundColor: active ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
    '&:hover': {
      backgroundColor: active
        ? alpha(theme.palette.primary.main, 0.12)
        : alpha(theme.palette.text.primary, 0.04),
    },
    transition: 'background-color 0.15s',
  });

  const DrawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Toolbar sx={{ minHeight: '60px !important' }} />

      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {/* Dashboard */}
        <List dense sx={{ px: 1, pb: 0 }}>
          <ListItemButton
            selected={page === 'dashboard'}
            onClick={() => go('dashboard')}
            sx={navItemSx(page === 'dashboard')}
          >
            <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
              <Box sx={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HomeOutlinedIcon sx={{ fontSize: 18 }} />
              </Box>
            </ListItemIcon>
            <ListItemText
              primary="Dashboard"
              primaryTypographyProps={{
                fontSize: 13,
                fontWeight: page === 'dashboard' ? 600 : 400,
                color: 'inherit',
              }}
            />
          </ListItemButton>
        </List>

        <Divider sx={{ my: 1 }} />

        {NAV.map((sec, si) => (
          <Box key={sec.group} sx={{ mb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                px: 2.5,
                py: 0.5,
                display: 'block',
                fontWeight: 700,
                fontSize: '0.6rem',
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: 'text.disabled',
                userSelect: 'none',
              }}
            >
              {sec.group}
            </Typography>
            <List dense sx={{ px: 1, py: 0 }}>
              {sec.items.map(item => (
                <ListItemButton
                  key={item.key}
                  selected={page === item.key}
                  onClick={() => go(item.key)}
                  sx={navItemSx(page === item.key)}
                >
                  <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                    <Box sx={{ width: 16, height: 16, display: 'flex', alignItems: 'center' }}>
                      <NavIcon k={item.key} />
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      fontSize: 13,
                      fontWeight: page === item.key ? 600 : 400,
                      color: 'inherit',
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
            {si < NAV.length - 1 && <Divider sx={{ my: 1 }} />}
          </Box>
        ))}
      </Box>

      <Box sx={{
        px: 2, py: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        background: theme.palette.grey[50],
      }}>
        <Typography variant="caption" color="text.disabled" display="block" sx={{ fontWeight: 600 }}>
          Marubozu Capital v4.0
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ opacity: 0.7, fontSize: 10 }}>
          Ctrl+B sidebar · Ctrl+H home
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ── APPBAR ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}
      >
        <Toolbar sx={{ minHeight: '60px !important', px: { xs: 1.5, sm: 2 }, gap: 1 }}>
          {/* Sidebar toggle */}
          <Tooltip title="Toggle sidebar (Ctrl+B)">
            <IconButton
              size="small"
              onClick={() => setCollapsed(c => !c)}
              sx={{
                mr: 0.5,
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                width: 32, height: 32,
              }}
            >
              <MenuIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {/* Brand logo */}
          <Box sx={{
            width: 34, height: 34, flexShrink: 0, borderRadius: 1.5,
            background: 'linear-gradient(135deg, #4f7ef8, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#fff', fontSize: 16, letterSpacing: '-0.5px',
            fontFamily: "'Syne', sans-serif",
            boxShadow: '0 2px 8px rgba(79,126,248,.40)',
            userSelect: 'none',
          }}>
            M
          </Box>

          {/* Brand name */}
          <Box sx={{ mr: 'auto', ml: 1.5, lineHeight: 1 }}>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              onClick={() => go('dashboard')}
              sx={{
                cursor: 'pointer',
                lineHeight: 1.2,
                fontFamily: "'Syne', sans-serif",
                letterSpacing: '-0.3px',
                fontSize: 16,
                color: 'text.primary',
                '&:hover': { color: 'primary.main' },
                transition: 'color 0.15s',
              }}
            >
              Marubozu Capital
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1, fontSize: 10 }}>
              Algorithmic trading signals · v4.0
            </Typography>
          </Box>

          {/* System online chip */}
          <Chip
            icon={<FiberManualRecordIcon sx={{ fontSize: '8px !important', color: '#22c55e !important', animation: 'blink 2.5s infinite' }} />}
            label="System online"
            size="small"
            variant="outlined"
            sx={{
              fontSize: 11, height: 26,
              borderColor: '#86efac',
              color: '#15803d',
              bgcolor: '#f0fdf4',
              display: { xs: 'none', sm: 'flex' },
            }}
          />

          {/* Unprocessed rows (same cadence as Upload CSV live counter) */}
          <Tooltip
            title={
              <Box sx={{ py: 0.25 }}>
                <Typography variant="caption" display="block" fontWeight={700}>
                  Unprocessed raw rows (all assets)
                </Typography>
                <Typography variant="caption" display="block" sx={{ opacity: 0.9, mt: 0.5 }}>
                  Refreshes every {UNPROCESSED_POLL_MS / 1000}s — matches the live count on Upload CSV while processing.
                </Typography>
              </Box>
            }
            arrow
            enterDelay={400}
          >
            <Chip
              label={
                count == null
                  ? 'Unprocessed: …'
                  : `Unprocessed: ${count.toLocaleString()}`
              }
              size="small"
              color={unprocessedSeverity === 'default' ? undefined : unprocessedSeverity}
              variant={count != null && count > 10 ? 'filled' : 'outlined'}
              sx={{
                fontSize: 11,
                height: 26,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                maxWidth: { xs: 140, sm: 'none' },
                ...(count == null || count <= 10) && {
                  borderColor: 'divider',
                  color: 'text.secondary',
                  bgcolor: 'background.paper',
                },
              }}
            />
          </Tooltip>

          {/* Home button */}
          <Tooltip title="Dashboard (Ctrl+H)">
            <IconButton
              size="small"
              onClick={() => go('dashboard')}
              sx={{
                color: 'text.secondary',
                border: '1px solid',
                borderColor: 'divider',
                width: 32, height: 32,
              }}
            >
              <HomeOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {/* Mobile menu button */}
          <IconButton
            size="small"
            onClick={() => setMobileOpen(o => !o)}
            sx={{
              display: { md: 'none' },
              color: 'text.secondary',
              border: '1px solid',
              borderColor: 'divider',
              width: 32, height: 32,
              ml: 0.5,
            }}
          >
            <MenuIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* ── SIDEBAR (Desktop permanent, collapsible) ── */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: collapsed ? 0 : DRAWER_WIDTH,
          flexShrink: 0,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: 220,
          }),
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: 'divider',
            overflowX: 'hidden',
            transition: theme.transitions.create('transform', {
              easing: theme.transitions.easing.sharp,
              duration: 220,
            }),
            transform: collapsed ? `translateX(-${DRAWER_WIDTH}px)` : 'translateX(0)',
          },
        }}
      >
        {DrawerContent}
      </Drawer>

      {/* ── SIDEBAR (Mobile temporary) ── */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        {DrawerContent}
      </Drawer>

      {/* ── MAIN CONTENT ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
          bgcolor: 'background.default',
          transition: theme.transitions.create('margin-left', {
            easing: theme.transitions.easing.sharp,
            duration: 220,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: '60px !important', flexShrink: 0 }} />
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {ALL_PAGE_KEYS.map(k => (
            <Box
              key={k}
              sx={{
                display: page === k ? 'block' : 'none',
                minHeight: page === k ? 'auto' : 0,
              }}
            >
              {pageComponents[k]}
            </Box>
          ))}
        </Box>
      </Box>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.35} }
      `}</style>
    </Box>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
