import React from 'react';
import {
  Box, Grid, Typography, Paper, Card, CardActionArea, CardContent,
  Divider, alpha,
} from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import BarChartIcon from '@mui/icons-material/BarChart';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import BiotechIcon from '@mui/icons-material/Biotech';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import SearchIcon from '@mui/icons-material/Search';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import SettingsIcon from '@mui/icons-material/Settings';
import { COLOR } from '../theme';

const QUICK = [
  { key: 'data_viewer',          Icon: ShowChartIcon,          label: 'Data Viewer',         sub: 'All 40+ indicator columns with filters' },
  { key: 'backtest',             Icon: RocketLaunchIcon,        label: 'Run Backtest',         sub: 'Execute signal matching engine' },
  { key: 'backtest_analysis',    Icon: BarChartIcon,            label: 'Chart Analysis',       sub: 'Price chart + signal overlays' },
  { key: 'mtf_backtest_analysis',Icon: TrackChangesIcon,        label: 'MTF Analysis',         sub: 'All timeframes on one chart' },
  { key: 'signal_eda',           Icon: BiotechIcon,             label: 'Signal EDA',           sub: 'Win rates, returns, distributions' },
  { key: 'upload_file',          Icon: UploadFileIcon,          label: 'Upload CSV',           sub: 'Import historical OHLCV data' },
  { key: 'unprocessed_monitor',  Icon: MonitorHeartIcon,        label: 'System Monitor',       sub: 'Live unprocessed row counter' },
  { key: 'gap_analysis',         Icon: SearchIcon,              label: 'Gap Analysis',         sub: 'Detect missing candles' },
  { key: 'recompute_technicals', Icon: AutorenewIcon,           label: 'Recompute Technicals', sub: 'Rebuild RSI, BB, ADX, Divergence' },
  { key: 'manage_assets',        Icon: SettingsIcon,            label: 'Assets & Timeframes',  sub: 'Add tickers and intervals' },
];

const LAYERS = [
  {
    num: '01',
    color: COLOR.blue,
    title: 'RSI Divergence — the master gate',
    body: 'Price makes a lower low but RSI makes a higher low (bullish divergence). Selling momentum is fading. This is checked first — no signal fires without it. Your bot scans the last 300 candles for the strongest divergence pivot.',
  },
  {
    num: '02',
    color: COLOR.green,
    title: 'Bollinger Bands position',
    body: 'Both the from-candle and to-candle of the divergence must sit in the bottom 15% of the Bollinger Bands (BBP ≤ 0.15 for buys, ≥ 0.85 for sells). This ensures the divergence forms at a statistically extreme price point — not just anywhere.',
  },
  {
    num: '03',
    color: COLOR.purple,
    title: 'ADX trend confirmation',
    body: 'ADX must be ≥ 25 (confirmed real trend, not sideways noise) and DI− must exceed DI+ for buy signals (bears still in control, about to reverse). This ensures you are catching a genuine trend reversal, not random chop.',
  },
];

const CONFIDENCE_BUCKETS = [
  ['≤ 10 candles', '100', COLOR.blue],
  ['11–20',        '105', COLOR.blue],
  ['21–40',        '110', COLOR.amber],
  ['41–80',        '120', COLOR.amber],
  ['81–160',       '130', COLOR.green],
  ['161–320',      '140', COLOR.green],
];

export default function Dashboard({ navigate, count }) {
  const cColor = count == null ? COLOR.blue
    : count <= 10  ? COLOR.green
    : count <= 100 ? COLOR.amber
    : COLOR.red;

  const STATUS_METRICS = [
    {
      label: 'Unprocessed rows',
      value: count ?? '—',
      sub: count == null ? 'Loading…' : count <= 10 ? 'System healthy' : count <= 100 ? 'Processing backlog' : 'High backlog — check system',
      color: cColor,
    },
    { label: 'System',        value: 'Online', sub: 'All services running',    color: COLOR.green  },
    { label: 'Active rulesets', value: '4',   sub: 'UNIV · 8HR · 12HR · 1D', color: COLOR.blue   },
    { label: 'Total rules',   value: '48',     sub: '12 rules × 4 rulesets',  color: COLOR.purple },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, pb: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.5px', mb: 0.5 }}>
          Marubozu Capital
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
          RSI Divergence · Bollinger Bands · ADX — 3-layer signal confirmation · v4.0
        </Typography>
      </Box>

      {/* Status metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STATUS_METRICS.map((m, i) => (
          <Grid item xs={6} sm={3} key={i}>
            <Paper
              variant="outlined"
              sx={{
                p: 2, borderRadius: 2, textAlign: 'center',
                bgcolor: m.color.bg,
                borderColor: m.color.border,
              }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700, color: m.color.text, opacity: 0.75, display: 'block', mb: 0.5 }}>
                {m.label}
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ color: m.color.text, fontVariantNumeric: 'tabular-nums', my: 0.25 }}>
                {m.value}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11, color: m.color.text, opacity: 0.65 }}>
                {m.sub}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Quick access */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'text.disabled', fontWeight: 700 }}>
          Quick access
        </Typography>
        <Grid container spacing={1.5}>
          {QUICK.map(({ key, Icon, label, sub }) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={key}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: 'primary.light',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 16px rgba(79,126,248,.12)',
                  },
                }}
              >
                <CardActionArea onClick={() => navigate(key)} sx={{ p: 0 }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: '14px 16px !important' }}>
                    <Box
                      sx={{
                        width: 34, height: 34, borderRadius: 1.5, flexShrink: 0,
                        bgcolor: alpha('#4f7ef8', 0.1),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon sx={{ fontSize: 18, color: 'primary.main' }} />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, mb: 0.25 }}>
                        {label}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, lineHeight: 1.4 }}>
                        {sub}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* How the engine works */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', mb: 2.5 }}>
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: 14, mb: 0.25 }}>
            How the 3-layer signal engine works
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Every signal requires all 3 conditions simultaneously
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ display: 'flex', flexDirection: 'row' }}>
          {LAYERS.map((l, i) => (
            <React.Fragment key={l.num}>
              <Box
                sx={{
                  p: 2.5,
                  flex: 1,
                  borderTop: '3px solid',
                  borderColor: l.color.mid,
                  bgcolor: l.color.bg,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: 10, fontWeight: 800,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                    color: l.color.text,
                    display: 'block', mb: 1,
                  }}
                >
                  Layer {l.num}
                </Typography>
                <Typography fontWeight={700} sx={{ fontSize: 13, mb: 1, color: 'text.primary', lineHeight: 1.4 }}>
                  {l.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, lineHeight: 1.7 }}>
                  {l.body}
                </Typography>
              </Box>
              {i < LAYERS.length - 1 && <Divider orientation="vertical" flexItem />}
            </React.Fragment>
          ))}
        </Box>
      </Paper>

      {/* Confidence score buckets */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: 14, mb: 0.25 }}>
            Confidence score buckets
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Longer divergence = stronger signal = higher confidence score
          </Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {CONFIDENCE_BUCKETS.map(([len, conf, c]) => (
            <Paper
              key={len}
              variant="outlined"
              sx={{
                p: 2, borderRadius: 2, textAlign: 'center', minWidth: 120, flex: '1 1 auto',
                bgcolor: c.bg, borderColor: c.border,
              }}
            >
              <Typography
                fontWeight={700}
                sx={{ fontSize: 22, color: c.text, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {conf}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: 11, color: c.text, opacity: 0.7, display: 'block', mt: 0.25 }}>
                {len}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
