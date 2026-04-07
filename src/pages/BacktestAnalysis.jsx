import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart, LineElement, PointElement, LineController, ScatterController,
  CategoryScale, LinearScale, Tooltip, Legend, Filler,
} from 'chart.js';
import {
  Box, Grid, Typography, Button, MenuItem, Select, CircularProgress,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useAppCtx } from '../context/AppContext';
import { API, INTERVALS, fmt } from '../api';
import { PageHeader, Card, Alert, MetricGrid, Loading, SignalBadge, ConfBadge, DateRangePicker } from '../components/UI';

Chart.register(LineElement,PointElement,LineController,ScatterController,CategoryScale,LinearScale,Tooltip,Legend,Filler);

const MONO = "'JetBrains Mono','Fira Code',monospace";
const selectSx = { fontSize: 13, height: 38 };
const CH = { blue:'#378ADD', green:'#1D9E75', red:'#E24B4A', purple:'#7F77DD', amber:'#EF9F27' };

function confRadius(c){ return c>=130?7:c>=120?6:c>=110?5:4; }
function parseTsMs(ts){
  if (!ts) return NaN;
  const s = String(ts);
  const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(s) ? s : `${s}Z`;
  return new Date(normalized).getTime();
}
function parsePrice(v){
  if (v == null) return NaN;
  if (typeof v === 'number') return v;
  return Number(String(v).replace(/[^0-9.-]/g, ''));
}
function shortDate(ts){
  const t = parseTsMs(ts);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}

function HorizonsTable({ data, type }) {
  if (!data) return (
    <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled', fontSize: 13 }}>
      No {type} signals
    </Box>
  );
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr>
            {['Horizon', 'N', 'Avg return', 'Median', 'Win rate'].map(h => (
              <th key={h} style={{ textAlign: h === 'Horizon' ? 'left' : 'right', padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #e0e5ef', whiteSpace: 'nowrap' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(r => (
            <tr key={r.h} style={{ borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <td style={{ padding: '7px 12px', fontFamily: MONO, fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{r.h}c</td>
              <td style={{ padding: '7px 12px', textAlign: 'right', color: '#94a3b8', fontFamily: MONO }}>{r.n}</td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: MONO, color: parseFloat(r.avg) > 0 ? '#15803d' : parseFloat(r.avg) < 0 ? '#dc2626' : '#94a3b8' }}>
                {r.avg != null ? `${r.avg}%` : '—'}
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: MONO, color: '#334155' }}>
                {r.med != null ? `${r.med}%` : '—'}
              </td>
              <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: MONO, fontWeight: 600, color: parseFloat(r.win) > 55 ? '#15803d' : parseFloat(r.win) < 45 ? '#dc2626' : '#b45309' }}>
                {r.win != null ? `${r.win}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Box>
  );
}

export default function BacktestAnalysis({ isActive }) {
  const { ticker, setTicker, interval, setInterval, fromDate, setFromDate, toDate, setToDate, assetNames, tfValues } = useAppCtx();
  const [loading,  setLoading]  = useState(false);
  const [signals,  setSignals]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [error,    setError]    = useState('');
  const [selected, setSelected] = useState(null);
  const [, setChartReady] = useState(false);
  const [plotted, setPlotted] = useState({ buy:0, sell:0 });
  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const prevActive = useRef(false);
  const lastLoadedKey = useRef(null);

  useEffect(()=>()=>{chartInst.current?.destroy();},[]);

  const doLoad = useCallback(async () => {
    if (!ticker||!fromDate||!toDate){ setError('Asset, From date and To date are all required.'); return; }
    setLoading(true); setSignals([]); setStats(null); setError(''); setSelected(null); setChartReady(false);
    chartInst.current?.destroy(); chartInst.current=null;

    try {
      const [priceRes, sigRes] = await Promise.all([
        fetch(API.getData, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ ticker, interval, from_datetime:fromDate+'T00:00', to_datetime:toDate+'T23:59' }),
        }).then(r=>r.json()),
        fetch(`${API.backtestResults}?ticker=${ticker}&chart_interval=${interval}&from_date=${fromDate}&to_date=${toDate}&limit=5000`)
          .then(r=>r.json()),
      ]);

      const pricePoints = (priceRes?.records||[])
        .map(rec=>({ x:rec.data?.candle_close_ts, y:parsePrice(rec.data?.close), t:parseTsMs(rec.data?.candle_close_ts) }))
        .filter(p=>p.x&&!isNaN(p.y))
        .sort((a,b)=>a.t-b.t);

      const sigs = (sigRes?.status==='success'&&sigRes?.data?.results) ? sigRes.data.results : [];
      if(sigRes?.data?.statistics) setStats(sigRes.data.statistics);
      setSignals(sigs);

      if(pricePoints.length>0){
        setTimeout(()=>{ if(chartRef.current) buildChart(pricePoints, sigs, ticker); },80);
      } else {
        setError('No price data found for this date range. Ensure data exists for this ticker/interval.');
      }
    } catch(e){ setError(e.message); }
    finally { setLoading(false); }
  },[ticker,interval,fromDate,toDate]);// eslint-disable-line

  const loadWithCache = useCallback(async (force = false) => {
    const key = `${ticker}|${interval}|${fromDate}|${toDate}`;
    if (!force && lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;
    await doLoad();
  }, [ticker, interval, fromDate, toDate, doLoad]);

  useEffect(() => {
    const nowActive = isActive !== false;
    if (!nowActive) return;
    if (!ticker || !interval || !fromDate || !toDate) return;
    loadWithCache(false);
  }, [isActive, ticker, interval, fromDate, toDate, loadWithCache]);

  useEffect(() => {
    const nowActive = isActive !== false;
    if (nowActive && prevActive.current === false) {
      lastLoadedKey.current = null;
      if (ticker && interval && fromDate && toDate) loadWithCache(true);
    }
    prevActive.current = nowActive;
  }, [isActive, ticker, interval, fromDate, toDate, loadWithCache]);

  function buildChart(pricePoints, sigs, tkr) {
    chartInst.current?.destroy();
    const labels = pricePoints.map(p=>p.x);
    const prices = pricePoints.map(p=>p.y);
    const labelMap = new Map(labels.map((l,i)=>[l,i]));

    function nearestLabel(ts){
      if(labelMap.has(ts)) return ts;
      const t=parseTsMs(ts);
      if (!Number.isFinite(t)) return null;
      let best=null, bestDiff=Infinity;
      for(const [l] of labelMap){
        const lt = parseTsMs(l);
        if (!Number.isFinite(lt)) continue;
        const d=Math.abs(lt-t);
        if(d<bestDiff){bestDiff=d;best=l;}
      }
      return best;
    }

    const buySigs  = sigs.filter(s=>s.signal==='buy');
    const sellSigs = sigs.filter(s=>s.signal==='sell');

    const buyPts  = buySigs
      .map(s=>({ x:nearestLabel(s.candle_close_ts), y:parsePrice(s.close ?? s.candle_data?.close), sig:s }))
      .filter(p=>p.x!=null && Number.isFinite(p.y));
    const sellPts = sellSigs
      .map(s=>({ x:nearestLabel(s.candle_close_ts), y:parsePrice(s.close ?? s.candle_data?.close), sig:s }))
      .filter(p=>p.x!=null && Number.isFinite(p.y));
    setPlotted({ buy: buyPts.length, sell: sellPts.length });

    chartInst.current = new Chart(chartRef.current, {
      type:'line',
      data:{
        labels,
        datasets:[
          { label:`${tkr} Price`, data:prices, borderColor:CH.blue, backgroundColor:'rgba(55,138,221,0.05)', borderWidth:1.5, pointRadius:0, pointHoverRadius:4, fill:true, tension:0.1, order:3 },
          { label:'Buy signals',  data:buyPts.map(p=>({x:p.x,y:p.y})), type:'scatter', showLine:false, pointStyle:'triangle', pointRadius:buyPts.map(p=>confRadius(p.sig.confidence)), pointBackgroundColor:CH.green, pointBorderColor:'#fff', pointBorderWidth:1.25, pointHoverRadius:9, order:1 },
          { label:'Sell signals', data:sellPts.map(p=>({x:p.x,y:p.y})), type:'scatter', showLine:false, pointStyle:'triangle', rotation:180, pointRadius:sellPts.map(p=>confRadius(p.sig.confidence)), pointBackgroundColor:CH.red, pointBorderColor:'#fff', pointBorderWidth:1.25, pointHoverRadius:9, order:2 },
        ],
      },
      options:{
        responsive:true, maintainAspectRatio:false, animation:{duration:350},
        interaction:{mode:'nearest',intersect:false},
        plugins:{
          legend:{ position:'top', labels:{ font:{size:12}, color:'#374151', usePointStyle:true, padding:16 } },
          tooltip:{
            backgroundColor:'rgba(255,255,255,.97)', titleColor:'#111827', bodyColor:'#374151', borderColor:'#e2e6ed', borderWidth:1, padding:10,
            callbacks:{
              title:items=>{
                if(!items?.length) return '';
                const first = items[0];
                if (first.datasetIndex === 0) return shortDate(labels[first.dataIndex]);
                const pts = first.datasetIndex===1?buyPts:sellPts;
                return shortDate(pts[first.dataIndex]?.x);
              },
              label:ctx=>{
                if(ctx.datasetIndex===0) return `Price: $${fmt.price(ctx.raw)}`;
                const pts=ctx.datasetIndex===1?buyPts:sellPts;
                const pt=pts[ctx.dataIndex]; if(!pt) return '';
                const s=pt.sig;
                return [`${s.signal?.toUpperCase()} @ $${fmt.price(pt.y)}`,`Ruleset: ${s.ruleset_number}`,`Confidence: ${s.confidence}`];
              },
            },
          },
        },
        scales:{
          x:{ grid:{color:'rgba(0,0,0,.04)'}, ticks:{ color:'#9ca3af', font:{size:10}, maxTicksLimit:10, callback:function(val){ return shortDate(this.getLabelForValue(val)); } } },
          y:{ position:'right', grid:{color:'rgba(0,0,0,.04)'}, ticks:{ color:'#9ca3af', font:{size:10}, maxTicksLimit:6, callback:v=>`$${Number(v).toLocaleString()}` } },
        },
        onClick:(evt,elements)=>{
          const el=elements.find(e=>e.datasetIndex===1||e.datasetIndex===2);
          if(!el){setSelected(null);return;}
          const pts=el.datasetIndex===1?buyPts:sellPts;
          const pt=pts[el.index]; if(pt) setSelected(pt.sig);
        },
      },
    });
    setChartReady(true);
  }

  function calcHorizons(sigs,type){
    const f=sigs.filter(s=>s.signal===type);
    if(!f.length) return null;
    return [6,12,18,24].map(h=>{
      const vals=f.map(s=>s.candle_data?.future_performance_data?.horizons?.[`${h}_candles`]?.price_movement?.final_return_percent).filter(v=>v!=null);
      if(!vals.length) return{h,avg:null,med:null,win:null,n:0};
      const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
      const sorted=[...vals].sort((a,b)=>a-b);
      const med=sorted.length%2?sorted[Math.floor(sorted.length/2)]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2;
      const win=vals.filter(v=>v>0).length/vals.length*100;
      return{h,avg:avg.toFixed(2),med:med.toFixed(2),win:win.toFixed(1),n:vals.length};
    });
  }

  const buyH=signals.length?calcHorizons(signals,'buy'):null;
  const sellH=signals.length?calcHorizons(signals,'sell'):null;

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader title="Chart Analysis" sub="Price chart with signal overlays · forward returns · signal detail inspector" />

      <Card title="Parameters">
        <Grid container spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Asset
            </Typography>
            <Select fullWidth size="small" value={ticker} onChange={e=>setTicker(e.target.value)} sx={selectSx}>
              {(assetNames.length?assetNames:[ticker]).map(n=>(
                <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Interval
            </Typography>
            <Select fullWidth size="small" value={interval} onChange={e=>setInterval(e.target.value)} sx={selectSx}>
              {(tfValues.length?tfValues:INTERVALS).map(v=>(
                <MenuItem key={v} value={v} sx={{ fontSize: 13 }}>{v}</MenuItem>
              ))}
            </Select>
          </Grid>
          <Grid item xs={12} sm={6}>
            <DateRangePicker
              from={fromDate} to={toDate}
              onFromChange={v => { setFromDate(v); if (!toDate || (v && toDate < v)) setToDate(v); }}
              onToChange={setToDate}
            />
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={() => loadWithCache(true)}
          disabled={loading || !ticker}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
          sx={{ height: 38 }}
        >
          {loading ? 'Loading…' : 'Generate Chart'}
        </Button>
        {error && <Alert type="error" style={{ mt: 2 }}>{error}</Alert>}
      </Card>

      {loading && <Card title="Loading data…"><Loading text="Fetching price data and signals simultaneously…" /></Card>}

      {/* Price chart */}
      <Card
        title={`${ticker} ${interval} — price chart with signal overlays`}
        subtitle="Click a signal triangle to inspect full indicator data below · larger triangle = higher confidence"
      >
        <Box sx={{ position: 'relative', height: 400 }}>
          <canvas ref={chartRef} />
          {!signals.length && !loading && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', fontSize: 13, pointerEvents: 'none', flexDirection: 'column', gap: 1 }}>
              <Typography sx={{ fontSize: 28, opacity: .2 }}>📈</Typography>
              <Typography variant="body2" color="text.disabled">Configure parameters and click Generate chart</Typography>
            </Box>
          )}
        </Box>
        {signals.length > 0 && (
          <Box sx={{ display: 'flex', gap: 2, mt: 1.5, flexWrap: 'wrap', px: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ color: '#15803d', fontWeight: 700 }}>▲ Buy</Box> — green triangles
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              <Box component="span" sx={{ color: '#dc2626', fontWeight: 700 }}>▼ Sell</Box> — red triangles
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Larger triangle = higher confidence
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Plotted: <strong>{plotted.buy}</strong>/{signals.filter(s=>s.signal==='buy').length} buy,{' '}
              <strong>{plotted.sell}</strong>/{signals.filter(s=>s.signal==='sell').length} sell
            </Typography>
          </Box>
        )}
      </Card>

      {signals.length > 0 && !loading && (
        <>
          <MetricGrid metrics={[
            { label: 'Total signals', value: fmt.num(signals.length),                      color: 'blue',   sub: '' },
            { label: 'Buy signals',   value: signals.filter(s=>s.signal==='buy').length,   color: 'green' },
            { label: 'Sell signals',  value: signals.filter(s=>s.signal==='sell').length,  color: 'red' },
            { label: 'Avg confidence', value: stats?.avg_confidence?.toFixed(1) ?? '—',   color: 'purple' },
          ]} />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Card title="📈 Buy — forward returns" subtitle="Return N candles after buy signal" accent="green">
                <HorizonsTable data={buyH} type="buy" />
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card title="📉 Sell — forward returns" subtitle="Return N candles after sell signal" accent="red">
                <HorizonsTable data={sellH} type="sell" />
              </Card>
            </Grid>
          </Grid>

          <Card title="All signals" subtitle="Click any row to inspect full indicator snapshot" noPad>
            <Box sx={{ overflowX: 'auto', maxHeight: 580, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Date (PDT)', 'Signal', 'Close', 'Confidence', 'Ruleset', 'RSI', 'SRSI-K', 'BB status', 'Divergence', 'Div len'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #e0e5ef', whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1, background: '#f7f9fc' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {signals.map(s => {
                    const cd=s.candle_data||{},bb=cd.bb_data||{},div=cd.divergence_data||{};
                    const isSel=selected?.id===s.id;
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelected(isSel ? null : s)}
                        style={{ cursor:'pointer', background: isSel ? '#eef3ff' : 'transparent', borderBottom: '1px solid rgba(0,0,0,.04)', transition: 'background .1s' }}
                      >
                        <td style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 11, whiteSpace: 'nowrap' }}>{fmt.ts(s.candle_close_ts)}</td>
                        <td style={{ padding: '8px 14px' }}><SignalBadge signal={s.signal} /></td>
                        <td style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 12, fontWeight: 500 }}>${fmt.price(s.close)}</td>
                        <td style={{ padding: '8px 14px' }}><ConfBadge value={s.confidence} /></td>
                        <td style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 12, color: '#1d4ed8' }}>{s.ruleset_number}</td>
                        <td style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 12 }}>{cd.rsi?.toFixed(1)||'—'}</td>
                        <td style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 12 }}>{cd.srsi_k?.toFixed(1)||'—'}</td>
                        <td style={{ padding: '8px 14px', fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{bb.candle_status?.replace(/_/g,' ')||'—'}</td>
                        <td style={{ padding: '8px 14px', fontSize: 12, fontWeight: 500, color: div.type==='bullish'?'#15803d':div.type==='bearish'?'#dc2626':'#94a3b8' }}>{div.type||'—'}</td>
                        <td style={{ padding: '8px 14px', fontFamily: MONO, fontSize: 12 }}>{div.length||'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Box>
          </Card>
        </>
      )}

      {/* Signal detail inspector */}
      {selected && (
        <Card
          title={`Signal detail — ${selected.ruleset_number} · ${selected.ruleset_name || ''}`}
          actions={
            <Button
              size="small"
              variant="outlined"
              startIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              onClick={() => setSelected(null)}
              sx={{ fontSize: 11 }}
            >
              Close
            </Button>
          }
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Candle indicators
              </Typography>
              {[
                ['Signal',          <SignalBadge signal={selected.signal}/>],
                ['Close price',     `$${fmt.price(selected.close)}`],
                ['Confidence',      <ConfBadge value={selected.confidence}/>],
                ['Candle type',     selected.candle_data?.candle_type],
                ['RSI',             selected.candle_data?.rsi?.toFixed(2)],
                ['SRSI-K',          selected.candle_data?.srsi_k?.toFixed(2)],
                ['SRSI-D',          selected.candle_data?.srsi_d?.toFixed(2)],
                ['BB status',       selected.candle_data?.bb_data?.candle_status?.replace(/_/g,' ')],
                ['BBP (%B)',         selected.candle_data?.bb_data?.bbp?.toFixed(3)],
                ['BBB (bandwidth)', selected.candle_data?.bb_data?.bbb?.toFixed(3)],
                ['ADX',             selected.candle_data?.adx_data?.adx?.toFixed(1)],
                ['DI+',             selected.candle_data?.adx_data?.dip?.toFixed(1)],
                ['DI−',             selected.candle_data?.adx_data?.din?.toFixed(1)],
                ['Divergence',      selected.candle_data?.divergence_data?.type],
                ['Div length',      selected.candle_data?.divergence_data?.length],
                ['Div price chg%',  selected.candle_data?.divergence_data?.price_change_percent!=null ? `${selected.candle_data.divergence_data.price_change_percent.toFixed(2)}%` : null],
              ].map(([k,v]) => (
                <Box key={k} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', minWidth: 130, flexShrink: 0 }}>{k}</Typography>
                  <Box sx={{ fontSize: 13, color: 'text.primary', fontWeight: 500 }}>{v ?? '—'}</Box>
                </Box>
              ))}
            </Grid>

            <Grid item xs={12} md={6}>
              {selected.candle_data?.divergence_data?.from_candle_data && (
                <>
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'text.secondary', display: 'block', mb: 1.5 }}>
                    Divergence from-candle
                  </Typography>
                  {[
                    ['Timestamp', fmt.ts(selected.candle_data.divergence_data.from_candle_ts_pdt||selected.candle_data.divergence_data.from_candle_ts_utc)],
                    ['Close',`$${fmt.price(selected.candle_data.divergence_data.from_candle_data.close)}`],
                    ['RSI',   selected.candle_data.divergence_data.from_candle_data.rsi?.toFixed(2)],
                    ['BB status', selected.candle_data.divergence_data.from_candle_data.bb_data?.candle_status?.replace(/_/g,' ')],
                    ['BBP',   selected.candle_data.divergence_data.from_candle_data.bb_data?.bbp?.toFixed(3)],
                  ].map(([k,v]) => (
                    <Box key={k} sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary', minWidth: 100, flexShrink: 0 }}>{k}</Typography>
                      <Box sx={{ fontSize: 13, color: 'text.primary', fontWeight: 500 }}>{v ?? '—'}</Box>
                    </Box>
                  ))}
                  <Divider sx={{ my: 2 }} />
                </>
              )}

              <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'text.secondary', display: 'block', mb: 1.5 }}>
                Future performance
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {['Horizon', 'Return%', 'Max gain', 'Max loss'].map(h => (
                        <th key={h} style={{ textAlign: h === 'Horizon' ? 'left' : 'right', padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#64748b', borderBottom: '2px solid #e0e5ef' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[6,12,18,24].map(h => {
                      const hd=selected.candle_data?.future_performance_data?.horizons?.[`${h}_candles`];
                      const pm=hd?.price_movement||{};
                      return (
                        <tr key={h} style={{ borderBottom: '1px solid rgba(0,0,0,.04)' }}>
                          <td style={{ padding: '7px 12px', fontFamily: MONO, fontWeight: 600, color: '#0f172a' }}>{h}c</td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: MONO, color: pm.final_return_percent>0?'#15803d':pm.final_return_percent<0?'#dc2626':'#94a3b8', fontWeight: 600 }}>
                            {pm.final_return_percent!=null?`${pm.final_return_percent.toFixed(2)}%`:'—'}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: MONO, color: '#15803d' }}>
                            {pm.max_gain_percent!=null?`${pm.max_gain_percent.toFixed(2)}%`:'—'}
                          </td>
                          <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: MONO, color: '#dc2626' }}>
                            {pm.max_loss_percent!=null?`${pm.max_loss_percent.toFixed(2)}%`:'—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Box>
            </Grid>
          </Grid>
        </Card>
      )}
    </Box>
  );
}
