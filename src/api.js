// ─── Central API config — all URLs from .env ─────────────────
const DEFAULT_BASE = 'http://localhost:5001';

function clean(v, fb = '') {
  if (typeof v !== 'string' || !v.trim()) return fb;
  return v.trim().replace(/^['"\s]+|['"\s;]+$/g, '');
}
function join(base, path) {
  const l = clean(base, DEFAULT_BASE).replace(/\/+$/, '');
  const r = clean(path, '').replace(/^\/?/, '/');
  return r === '/' ? l : `${l}${r}`;
}

const BASE = clean(process.env.REACT_APP_API_BASE, DEFAULT_BASE).replace(/\/+$/, '');

export const API = {
  base:            BASE,
  storeRaw:        join(BASE, process.env.REACT_APP_EP_STORE_RAW        || '/storeTradingViewRawData'),
  upload:          join(BASE, process.env.REACT_APP_EP_UPLOAD           || '/uploadFile'),
  getData:         join(BASE, process.env.REACT_APP_EP_GET_DATA         || '/getData'),
  gapAnalysis:     join(BASE, process.env.REACT_APP_EP_GAP_ANALYSIS     || '/gapAnalysis'),
  recompute:       join(BASE, process.env.REACT_APP_EP_RECOMPUTE        || '/recomputeTechnicals'),
  unprocessed:     join(BASE, process.env.REACT_APP_EP_UNPROCESSED      || '/getUnprocessedRows'),
  backtest:        join(BASE, process.env.REACT_APP_EP_BACKTEST         || '/backtest'),
  backtestResults: join(BASE, process.env.REACT_APP_EP_BACKTEST_RESULTS || '/backtest-results'),
  backtestCache:   join(BASE, process.env.REACT_APP_EP_BACKTEST_CACHE   || '/backtest-cache'),
  liveSignals:     join(BASE, process.env.REACT_APP_EP_LIVE_SIGNALS     || '/api/live-signals/process'),
  assets:          join(BASE, process.env.REACT_APP_EP_ASSETS           || '/api/assets'),
  timeframes:      join(BASE, process.env.REACT_APP_EP_TIMEFRAMES       || '/api/timeframes'),
  processData:     join(BASE, process.env.REACT_APP_EP_PROCESS_DATA     || '/api/process-data'),
  deleteRaw:       join(BASE, process.env.REACT_APP_EP_DELETE_RAW       || '/api/maintenance/delete-raw'),
  deleteIndicators:join(BASE, process.env.REACT_APP_EP_DELETE_INDICATORS|| '/api/maintenance/delete-indicators'),
};

// NOTE: /getData expects field "interval" (not "chart_interval")
//       /gapAnalysis expects "interval" and "length"
//       /recomputeTechnicals expects "ticker" and "interval"
//       /backtest-results expects "chart_interval"

export const INTERVALS = ['5min','15min','30min','1hour','2hour','4hour','8hour','12hour','1day','1week'];

export const TF_SECONDS = {
  '5min':300,'15min':900,'30min':1800,'1hour':3600,
  '2hour':7200,'4hour':14400,'8hour':28800,'12hour':43200,
  '1day':86400,'1week':604800,
};

export const TF_LABELS = {
  '5min':'5 Min','15min':'15 Min','30min':'30 Min','1hour':'1 Hour',
  '2hour':'2 Hour','4hour':'4 Hour','8hour':'8 Hour','12hour':'12 Hour',
  '1day':'1 Day','1week':'1 Week',
};

export const BB_STATUSES = [
  { value:'any',              label:'Any status' },
  { value:'Closed Below BBL', label:'Closed below BBL' },
  { value:'Wicked BBL',       label:'Wicked BBL' },
  { value:'Closed Above BBU', label:'Closed above BBU' },
  { value:'Wicked BBU',       label:'Wicked BBU' },
  { value:'Closed Above BBM', label:'Closed above BBM' },
  { value:'Closed Below BBM', label:'Closed below BBM' },
];

export const fmt = {
  price: v => v == null ? '—' : parseFloat(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),
  num:   v => v == null ? '—' : Number(v).toLocaleString(),
  pct:   v => v == null ? '—' : `${Number(v).toFixed(2)}%`,
  n2:    v => v == null ? '—' : Number(v).toFixed(2),
  dur:   s => {
    if (!s || s < 1) return '< 1s';
    if (s < 60) return `${s.toFixed(1)}s`;
    return `${Math.floor(s/60)}m ${(s%60).toFixed(0)}s`;
  },
  ts: ts => {
    if (!ts) return '—';
    try {
      return new Date(ts.endsWith('Z') ? ts : ts + 'Z')
        .toLocaleString('en-US',{year:'numeric',month:'short',day:'2-digit',hour:'numeric',minute:'2-digit',hour12:true,timeZone:'America/Los_Angeles'});
    } catch { return ts; }
  },
  confClass: c => c >= 120 ? 'conf-high' : c >= 110 ? 'conf-med' : 'conf-low',
};

export async function apiFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers:{ 'Content-Type':'application/json', ...opts.headers },
    ...opts,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

export async function apiPost(url, body) {
  return apiFetch(url, { method:'POST', body:JSON.stringify(body) });
}
