import React from 'react';
import {
  Alert as MuiAlert, Box, Card as MuiCard, CardContent, CardHeader,
  CircularProgress, Typography, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Grid, FormControl, FormLabel, RadioGroup as MuiRadioGroup,
  FormControlLabel, Radio, Divider, Button, TextField, Select, MenuItem,
  InputLabel,
} from '@mui/material';
import { COLOR } from '../theme';

// ── Helpers ──────────────────────────────────────────────────────────────────
const MONO_FONT = "'JetBrains Mono', 'Fira Code', monospace";

export const Spinner = ({ sm }) => (
  <CircularProgress size={sm ? 14 : 20} thickness={4.5} sx={{ color: 'primary.main' }} />
);

export function Loading({ text = 'Loading…' }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 5, gap: 1.5 }}>
      <CircularProgress size={22} thickness={4} />
      <Typography variant="body2" color="text.secondary">{text}</Typography>
    </Box>
  );
}

export function Empty({ icon = '◻', title = 'No data', sub = '' }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, px: 3, color: 'text.disabled' }}>
      <Typography sx={{ fontSize: 32, mb: 1, opacity: 0.18, lineHeight: 1 }}>{icon}</Typography>
      <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      {sub && <Typography variant="caption" color="text.disabled">{sub}</Typography>}
    </Box>
  );
}

export function Alert({ type = 'info', children, onClose, style }) {
  const sev = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
  return (
    <MuiAlert
      severity={sev[type] || 'info'}
      onClose={onClose}
      variant="standard"
      sx={{ mb: 2, borderRadius: 2, ...style }}
    >
      {children}
    </MuiAlert>
  );
}

export function Card({ title, subtitle, actions, children, noPad = false, accent, style }) {
  const accentSx = accent === 'amber' ? {
    borderColor: '#fcd34d',
    bgcolor: '#fffbeb',
  } : {};

  return (
    <MuiCard
      variant="outlined"
      sx={{ mb: 2.5, borderRadius: 2, ...accentSx, ...style }}
    >
      {(title || actions) && (
        <CardHeader
          title={
            title && (
              <Typography variant="subtitle1" fontWeight={700} sx={{ fontSize: 14 }}>
                {title}
              </Typography>
            )
          }
          subheader={
            subtitle && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                {subtitle}
              </Typography>
            )
          }
          action={
            actions && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                {actions}
              </Box>
            )
          }
          sx={{ pb: noPad ? 0 : undefined }}
        />
      )}
      <CardContent sx={noPad ? { p: '0 !important' } : {}}>
        {children}
      </CardContent>
    </MuiCard>
  );
}

export function MetricGrid({ metrics }) {
  const colorMap = {
    blue:   { bg: COLOR.blue.bg,   border: COLOR.blue.border,   text: COLOR.blue.text   },
    green:  { bg: COLOR.green.bg,  border: COLOR.green.border,  text: COLOR.green.text  },
    red:    { bg: COLOR.red.bg,    border: COLOR.red.border,    text: COLOR.red.text    },
    amber:  { bg: COLOR.amber.bg,  border: COLOR.amber.border,  text: COLOR.amber.text  },
    purple: { bg: COLOR.purple.bg, border: COLOR.purple.border, text: COLOR.purple.text },
    teal:   { bg: COLOR.teal.bg,   border: COLOR.teal.border,   text: COLOR.teal.text   },
  };

  return (
    <Grid container spacing={2} sx={{ mb: 2.5 }}>
      {metrics.map((m, i) => {
        const c = colorMap[m.color] || colorMap.blue;
        return (
          <Grid item xs={6} sm={4} md={3} key={i}>
            <Paper
              variant="outlined"
              sx={{
                p: 2, borderRadius: 2,
                bgcolor: c.bg,
                borderColor: c.border,
                textAlign: 'center',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  textTransform: 'uppercase',
                  letterSpacing: '.06em',
                  fontWeight: 700,
                  fontSize: '0.62rem',
                  color: c.text,
                  opacity: 0.75,
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {m.label}
              </Typography>
              <Typography
                variant="h5"
                fontWeight={700}
                sx={{ color: c.text, fontFamily: MONO_FONT, fontVariantNumeric: 'tabular-nums' }}
              >
                {m.value ?? '--'}
              </Typography>
              {m.sub && (
                <Typography variant="caption" sx={{ color: c.text, opacity: 0.65, display: 'block', mt: 0.25 }}>
                  {m.sub}
                </Typography>
              )}
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
}

export function PageHeader({ title, sub, actions }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        mb: 2.5,
        pb: 2,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Box>
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ letterSpacing: '-0.3px', lineHeight: 1.2, mb: 0.5 }}
        >
          {title}
        </Typography>
        {sub && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
            {sub}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, ml: 2 }}>{actions}</Box>}
    </Box>
  );
}

export function Field({ label, hint, children, span, style }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        ...(span ? { gridColumn: `span ${span}` } : {}),
        ...style,
      }}
    >
      {label && (
        <Typography
          component="label"
          variant="caption"
          fontWeight={600}
          sx={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '.06em',
            color: 'text.secondary',
            display: 'block',
          }}
        >
          {label}
        </Typography>
      )}
      {children}
      {hint && (
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11, mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

export function RadioGroup({ options, value, onChange }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {options.map(o => (
        <Box
          key={o.value}
          onClick={() => onChange(o.value)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2, py: 1.25,
            border: '1.5px solid',
            borderColor: value === o.value ? 'primary.main' : 'divider',
            borderRadius: 2,
            cursor: 'pointer',
            bgcolor: value === o.value ? 'primary.light' : 'background.paper',
            transition: 'all 0.15s',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.light' },
          }}
        >
          <Box
            sx={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid',
              borderColor: value === o.value ? 'primary.main' : 'grey.400',
              bgcolor: value === o.value ? 'primary.main' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}
          >
            {value === o.value && (
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fff' }} />
            )}
          </Box>
          <Box>
            <Typography variant="body2" fontWeight={value === o.value ? 600 : 400} sx={{ fontSize: 13 }}>
              {o.label}
            </Typography>
            {o.sub && (
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                {o.sub}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>{children}</DialogContent>
      {footer && (
        <>
          <Divider />
          <DialogActions>{footer}</DialogActions>
        </>
      )}
    </Dialog>
  );
}

export const CodeBlock = ({ data }) => (
  <Box
    component="pre"
    sx={{
      p: 2,
      bgcolor: 'grey.50',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      fontSize: 11,
      fontFamily: MONO_FONT,
      width: '100%',
      overflow: 'auto',
      maxHeight: 320,
      color: 'text.primary',
      whiteSpace: 'pre-wrap',
      // Ensure long strings (like filesystem paths) wrap instead of overflowing.
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      textOverflow: 'ellipsis',
    }}
  >
    {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
  </Box>
);

export function SignalBadge({ signal }) {
  if (!signal) return (
    <Chip label="--" size="small" variant="outlined" sx={{ fontFamily: MONO_FONT, fontSize: 11 }} />
  );
  return (
    <Chip
      label={signal.toUpperCase()}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: 11,
        fontFamily: MONO_FONT,
        letterSpacing: '.04em',
        bgcolor: signal === 'buy' ? COLOR.green.bg : COLOR.red.bg,
        color:   signal === 'buy' ? COLOR.green.text : COLOR.red.text,
        border:  `1px solid ${signal === 'buy' ? COLOR.green.border : COLOR.red.border}`,
      }}
    />
  );
}

export function ConfBadge({ value }) {
  if (!value) return null;
  const c = value >= 120 ? COLOR.green : value >= 110 ? COLOR.amber : COLOR.blue;
  return (
    <Chip
      label={value}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: 11,
        fontFamily: MONO_FONT,
        bgcolor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    />
  );
}

export function DataTable({ columns, rows, loading, emptyTitle = 'No results', emptyIcon = '◻' }) {
  if (loading) return <Loading />;
  if (!rows?.length) return <Empty icon={emptyIcon} title={emptyTitle} sub="Adjust filters and try again" />;
  return (
    <TableContainer>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((c, i) => (
              <TableCell key={i} sx={c.style}>{c.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, ri) => (
            <TableRow
              key={ri}
              hover
              onClick={row._onClick}
              sx={{
                cursor: row._onClick ? 'pointer' : 'default',
                ...row._style,
              }}
              className={row._cls || ''}
            >
              {columns.map((c, ci) => (
                <TableCell
                  key={ci}
                  sx={{
                    ...(c.tdClass?.includes('mono') && { fontFamily: MONO_FONT, fontSize: 12 }),
                    ...(c.tdClass?.includes('td-p') && { fontWeight: 600 }),
                    ...c.tdStyle,
                  }}
                >
                  {c.render ? c.render(row) : row[c.key] ?? '--'}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function DateRangePicker({ from, to, onFromChange, onToChange, style }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ...style }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', mb: 0.5 }}>
          From
        </Typography>
        <input
          type="date"
          value={from || ''}
          max={to || undefined}
          onChange={e => onFromChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8.5px 12px',
            fontSize: 13,
            border: '1px solid #e0e5ef',
            borderRadius: 8,
            background: '#fff',
            color: '#0f172a',
            fontFamily: 'inherit',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </Box>
      <Box sx={{ color: 'text.disabled', mt: 2.5, flexShrink: 0 }}>→</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" fontWeight={600} sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', mb: 0.5 }}>
          To
        </Typography>
        <input
          type="date"
          value={to || ''}
          min={from || undefined}
          onChange={e => onToChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8.5px 12px',
            fontSize: 13,
            border: '1px solid #e0e5ef',
            borderRadius: 8,
            background: '#fff',
            color: '#0f172a',
            fontFamily: 'inherit',
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </Box>
    </Box>
  );
}

export function MiniBar({ entries = [], getColor }) {
  if (!entries.length) return <Empty icon="◻" title="No data" />;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <Box>
      {entries.map(([k, v]) => (
        <Box key={k} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Typography
            variant="caption"
            sx={{
              width: 130, fontSize: 11, color: 'text.secondary',
              textAlign: 'right', flexShrink: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            {k}
          </Typography>
          <Box sx={{ flex: 1, height: 6, bgcolor: 'grey.100', borderRadius: 99, overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                borderRadius: 99,
                width: `${(v / max) * 100}%`,
                bgcolor: getColor ? getColor(k) : 'primary.main',
                transition: 'width 0.4s ease',
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 30, fontSize: 11, color: 'text.disabled', textAlign: 'right' }}>
            {v}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
