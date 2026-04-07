import { createTheme, alpha } from '@mui/material/styles';

const RAW = {
  blue:   '#4f7ef8',
  green:  '#15803d',
  red:    '#dc2626',
  amber:  '#b45309',
  purple: '#6d28d9',
  teal:   '#0d9488',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: RAW.blue,   dark: '#3a6ee0', light: '#eef3ff', contrastText: '#fff' },
    secondary: { main: RAW.purple, dark: '#5b21b6', light: '#f5f3ff', contrastText: '#fff' },
    success:   { main: RAW.green,  dark: '#166534', light: '#f0fdf4', contrastText: '#fff' },
    error:     { main: RAW.red,    dark: '#b91c1c', light: '#fef2f2', contrastText: '#fff' },
    warning:   { main: RAW.amber,  dark: '#92400e', light: '#fffbeb', contrastText: '#fff' },
    info:      { main: '#1d4ed8',  dark: '#1e3a8a', light: '#eff6ff', contrastText: '#fff' },
    background: { default: '#f2f4f8', paper: '#ffffff' },
    text: {
      primary:   '#0f172a',
      secondary: '#64748b',
      disabled:  '#94a3b8',
    },
    divider: '#e0e5ef',
    // Custom semantic tokens attached via augmentColor or just direct
    grey: {
      50:  '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 700, letterSpacing: '-0.5px' },
    h2: { fontWeight: 700, letterSpacing: '-0.4px' },
    h3: { fontWeight: 600, letterSpacing: '-0.3px' },
    h4: { fontWeight: 600, letterSpacing: '-0.2px' },
    h5: { fontWeight: 600, letterSpacing: '-0.1px' },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600, lineHeight: 1.4 },
    subtitle2: { fontWeight: 600, lineHeight: 1.4 },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.6 },
    caption: { lineHeight: 1.4 },
    button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
  },

  shape: { borderRadius: 8 },

  shadows: [
    'none',
    '0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.03)',
    '0 4px 16px rgba(0,0,0,.07),0 1px 4px rgba(0,0,0,.04)',
    '0 12px 40px rgba(0,0,0,.12),0 2px 8px rgba(0,0,0,.05)',
    '0 20px 60px rgba(0,0,0,.14),0 4px 16px rgba(0,0,0,.06)',
    ...Array(20).fill('none'),
  ],

  components: {
    MuiCssBaseline: {
      styleOverrides: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        *,*::before,*::after { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        body { -webkit-font-smoothing: antialiased; }
      `,
    },

    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600, textTransform: 'none', fontSize: 13 },
        sizeSmall: { fontSize: 12, padding: '4px 12px' },
        sizeMedium: { fontSize: 13, padding: '7px 18px' },
        sizeLarge: { fontSize: 14, padding: '10px 24px' },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4f7ef8 0%, #5b87ff 100%)',
          '&:hover': { background: 'linear-gradient(135deg, #3a6ee0 0%, #4f7ef8 100%)' },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },

    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          borderRadius: 12,
          border: '1px solid #e0e5ef',
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          backgroundImage: 'none',
        },
      },
    },

    MuiCardHeader: {
      styleOverrides: {
        root: { padding: '16px 20px 8px 20px' },
        title: { fontSize: 14, fontWeight: 600 },
        subheader: { fontSize: 12, marginTop: 2 },
      },
    },

    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '12px 20px 20px 20px',
          '&:last-child': { paddingBottom: 20 },
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { border: '1px solid #e0e5ef' },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontSize: 13,
          backgroundColor: '#ffffff',
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: RAW.blue, borderWidth: 2 },
        },
        notchedOutline: { borderColor: '#e0e5ef' },
        input: { padding: '8.5px 14px', fontSize: 13 },
      },
    },

    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: 13 },
        shrunk: { fontSize: 14 },
      },
    },

    MuiSelect: {
      styleOverrides: {
        select: { fontSize: 13 },
      },
    },

    MuiMenuItem: {
      styleOverrides: {
        root: { fontSize: 13 },
      },
    },

    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: 11, marginLeft: 0 },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: 11 },
        sizeSmall: { height: 22 },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: 13, alignItems: 'center' },
        standardSuccess: { backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' },
        standardError:   { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' },
        standardWarning: { backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' },
        standardInfo:    { backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #93c5fd' },
      },
    },

    MuiAlertTitle: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: 13 },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.18)' },
      },
    },

    MuiDialogTitle: {
      styleOverrides: {
        root: { fontSize: 15, fontWeight: 700, padding: '20px 24px 12px' },
      },
    },

    MuiDialogContent: {
      styleOverrides: {
        root: { padding: '8px 24px 16px' },
      },
    },

    MuiDialogActions: {
      styleOverrides: {
        root: { padding: '12px 24px 20px', gap: 8 },
      },
    },

    MuiTable: {
      styleOverrides: {
        root: { fontSize: 12 },
      },
    },

    MuiTableHead: {
      styleOverrides: {
        root: { backgroundColor: '#f7f9fc' },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: 12, padding: '8px 12px', borderColor: '#e0e5ef' },
        head: { fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: '#64748b', backgroundColor: '#f7f9fc' },
      },
    },

    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:last-child td': { borderBottom: 0 },
          '&:hover': { backgroundColor: '#f7f9fc' },
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: 11, borderRadius: 6, backgroundColor: '#0f172a' },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '1px 0',
          '&.Mui-selected': {
            backgroundColor: alpha(RAW.blue, 0.08),
            color: RAW.blue,
            '&:hover': { backgroundColor: alpha(RAW.blue, 0.12) },
          },
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 99, height: 6 },
      },
    },

    MuiDivider: {
      styleOverrides: {
        root: { borderColor: '#e0e5ef' },
      },
    },

    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
  },
});

// Color helpers matching the existing palette for use in pages
export const COLOR = {
  blue:   { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8',  mid: '#3b82f6' },
  green:  { bg: '#f0fdf4', border: '#86efac', text: '#15803d',  mid: '#22c55e' },
  red:    { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626',  mid: '#ef4444' },
  amber:  { bg: '#fffbeb', border: '#fcd34d', text: '#b45309',  mid: '#f59e0b' },
  purple: { bg: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9',  mid: '#8b5cf6' },
  teal:   { bg: '#f0fdfa', border: '#5eead4', text: '#0d9488',  mid: '#14b8a6' },
};
