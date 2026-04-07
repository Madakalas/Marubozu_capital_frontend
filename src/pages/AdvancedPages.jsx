import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart, LineElement, PointElement, LineController, ScatterController,
  BarElement, BarController, ArcElement, DoughnutController,
  CategoryScale, LinearScale, TimeScale, Tooltip, Legend, Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import {
  Box, Grid, Typography, Button, MenuItem, Select, Paper,
  CircularProgress, Tabs, Tab, TextField,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useAppCtx } from '../context/AppContext';
import { API, INTERVALS, fmt } from '../api';
import { PageHeader, Card, Alert, Loading, SignalBadge, MetricGrid, MiniBar } from '../components/UI';
import { COLOR } from '../theme';

Chart.register(LineElement,PointElement,LineController,ScatterController,BarElement,BarController,ArcElement,DoughnutController,CategoryScale,LinearScale,TimeScale,Tooltip,Legend,Filler);

const MONO = "'JetBrains Mono','Fira Code',monospace";
const selectSx = { fontSize: 13, height: 38 };
const CH = { blue:'#378ADD',green:'#1D9E75',red:'#E24B4A',purple:'#7F77DD',amber:'#EF9F27',teal:'#4fd1c5' };
const DOW_LABELS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_LABELS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const BUY_COLORS =['#1D9E75','#20c997','#17a2b8','#00d4aa','#00e676','#64dd17','#00c853','#76ff03','#c6ff00','#aeea00'];
const SELL_COLORS=['#E24B4A','#fd7e14','#e83e8c','#f012be','#ff4444','#ff6b6b','#ff5252','#ff1744','#d50000','#ff9ff3'];

function dotRadius(sec){ return sec<=14400?4:sec<=28800?6:sec<=43200?8:sec<=86400?10:14; }

/* ══════════════════════════════════════════
   SIGNAL EDA
══════════════════════════════════════════ */
export function SignalEDA({ isActive }) {
  const { ticker, setTicker, interval, setInterval, fromDate, setFromDate, toDate, setToDate, assetNames, tfValues } = useAppCtx();
  const [limit,setLimit]=useState('2000');
  const [loading,setLoading]=useState(false);
  const [progress,setProgress]=useState('');
  const [analysis,setAnalysis]=useState(null);
  const [error,setError]=useState('');
  const [tab,setTab]=useState(0);
  const charts=useRef({});
  const rDist=useRef(null),rCum=useRef(null),rFwdB=useRef(null),rFwdS=useRef(null);
  const rConfWR=useRef(null),rRule=useRef(null),rConfBar=useRef(null);
  const rHour=useRef(null),rDow=useRef(null),rMon=useRef(null);
  const prevActive = useRef(false);
  const lastLoadedKey = useRef(null);

  useEffect(()=>()=>{ Object.values(charts.current).forEach(c=>c?.destroy()); },[]);

  function dc(k){ charts.current[k]?.destroy(); charts.current[k]=null; }
  function destroyAll(){ Object.keys(charts.current).forEach(k=>dc(k)); }

  const CHART_BASE = {
    responsive:true, maintainAspectRatio:false, animation:{duration:400},
    plugins:{legend:{display:false}},
  };
  const SCALES_STD = {
    x:{grid:{display:false},ticks:{color:'#64748b',font:{size:11}}},
    y:{grid:{color:'rgba(0,0,0,.05)'},ticks:{color:'#64748b',font:{size:11}}},
  };

  function mkBar(k,ref,labels,data,colors,extraOpts={}){
    dc(k); if(!ref.current) return;
    charts.current[k]=new Chart(ref.current,{
      type:'bar',
      data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:5,borderSkipped:false}]},
      options:{...CHART_BASE,...extraOpts,scales:{...SCALES_STD,...(extraOpts.scales||{})}},
    });
  }
  function mkHBar(k,ref,labels,data,colors){
    dc(k); if(!ref.current) return;
    charts.current[k]=new Chart(ref.current,{
      type:'bar',
      data:{labels,datasets:[{data,backgroundColor:colors,borderRadius:4,borderSkipped:false}]},
      options:{...CHART_BASE,indexAxis:'y',scales:{x:{...SCALES_STD.y},y:{...SCALES_STD.x}}},
    });
  }
  function mkLine(k,ref,labels,datasets){
    dc(k); if(!ref.current) return;
    charts.current[k]=new Chart(ref.current,{
      type:'line',data:{labels,datasets},
      options:{...CHART_BASE,plugins:{legend:{display:true,position:'top',labels:{font:{size:11},color:'#334155',usePointStyle:true}}},scales:{...SCALES_STD}},
    });
  }

  function median(arr){ if(!arr.length) return null; const s=[...arr].sort((a,b)=>a-b); return s.length%2?s[Math.floor(s.length/2)]:(s[s.length/2-1]+s[s.length/2])/2; }

  function calcForwardReturns(signals, priceData){
    const CANDLES=[6,12,18,24];
    const priceArr=priceData.map(p=>({t:p.x.getTime(),y:p.y})).sort((a,b)=>a.t-b.t);
    return signals.map(s=>{
      const sigTime=new Date(s.candle_close_ts+(s.candle_close_ts.endsWith('Z')?'':'Z')).getTime();
      const sigPrice=parseFloat(s.close);
      let sigIdx=priceArr.findIndex(p=>Math.abs(p.t-sigTime)<300000);
      if(sigIdx<0) sigIdx=priceArr.reduce((b,p,i)=>Math.abs(p.t-sigTime)<Math.abs(priceArr[b].t-sigTime)?i:b,0);
      const returns={};
      CANDLES.forEach(h=>{
        const futIdx=sigIdx+h;
        if(futIdx<priceArr.length){ returns[`${h}c`]=((priceArr[futIdx].y-sigPrice)/sigPrice)*100; }
        else {
          const hd=s.candle_data?.future_performance_data?.horizons?.[`${h}_candles`];
          returns[`${h}c`]=hd?.available?hd.price_movement?.final_return_percent:null;
        }
      });
      return {...s,returns};
    });
  }

  function calcMetrics(enriched,type){
    const f=enriched.filter(s=>s.signal===type); if(!f.length) return null;
    return ['6c','12c','18c','24c'].map(h=>{
      const vals=f.map(s=>s.returns[h]).filter(v=>v!=null);
      if(!vals.length) return{h,avg:null,med:null,win:null,n:0};
      const avg=vals.reduce((a,b)=>a+b,0)/vals.length, med=median(vals);
      const win=f.filter(s=>s.returns[h]!=null&&(s.signal==='buy'?s.returns[h]>0:s.returns[h]<0)).length/vals.length*100;
      return{h,avg:avg.toFixed(2),med:med?.toFixed(2),win:win.toFixed(1),n:vals.length};
    });
  }

  function calcQuality(enriched){
    const valid=enriched.filter(s=>s.returns['24c']!=null);
    if(!valid.length) return{tp:0,tn:0,fp:0,fn:0,precision:0,recall:0,accuracy:0,f1:0};
    let tp=0,tn=0,fp=0,fn=0;
    valid.forEach(s=>{
      const pred=s.signal==='buy'?1:-1, actual=s.returns['24c']>0?1:-1;
      if(pred===1&&actual===1) tp++;
      else if(pred===-1&&actual===-1) tn++;
      else if(pred===1&&actual===-1) fp++;
      else fn++;
    });
    const precision=tp/(tp+fp)||0,recall=tp/(tp+fn)||0,accuracy=(tp+tn)/(tp+tn+fp+fn)||0;
    const f1=2*(precision*recall)/(precision+recall)||0;
    return{tp,tn,fp,fn,precision:precision*100,recall:recall*100,accuracy:accuracy*100,f1:f1*100};
  }

  function calcTemporal(enriched){
    const byHour={},byDOW={},byMonth={};
    enriched.forEach(s=>{
      const d=new Date(s.candle_close_ts+(s.candle_close_ts.endsWith('Z')?'':'Z'));
      [[d.getUTCHours(),byHour],[d.getUTCDay(),byDOW],[d.getUTCMonth(),byMonth]].forEach(([k,map])=>{
        if(!map[k]) map[k]={count:0,wins:0};
        map[k].count++;
        const r24=s.returns?.['24c'];
        if(r24!=null&&(s.signal==='buy'?r24>0:r24<0)) map[k].wins++;
      });
    });
    return{byHour,byDOW,byMonth};
  }

  function buildAllCharts(an){
    const {enriched,buyMetrics,sellMetrics,temporal,rulesetDist,bbDist,divDist,confBuckets}=an;

    mkBar('dist',rDist,['Buy','Sell'],[enriched.filter(s=>s.signal==='buy').length,enriched.filter(s=>s.signal==='sell').length],[`${CH.green}cc`,`${CH.red}cc`]);

    const sorted=[...enriched].filter(s=>s.returns?.['24c']!=null).sort((a,b)=>new Date(a.candle_close_ts)-new Date(b.candle_close_ts));
    let cumB=0,cumS=0;
    const cumBuyPts=[],cumSellPts=[],cumLabels=[];
    sorted.forEach((s)=>{
      const r=s.returns['24c'],dir=s.signal==='buy'?r:-r;
      cumLabels.push(fmt.ts(s.candle_close_ts).replace(/,.*$/,''));
      if(s.signal==='buy'){ cumB+=dir; cumBuyPts.push(parseFloat(cumB.toFixed(2))); cumSellPts.push(null); }
      else { cumS+=dir; cumSellPts.push(parseFloat(cumS.toFixed(2))); cumBuyPts.push(null); }
    });
    if(sorted.length>1) mkLine('cum',rCum,cumLabels,[
      {label:'Buy cumulative %',data:cumBuyPts,borderColor:CH.green,backgroundColor:`${CH.green}22`,fill:false,pointRadius:0,tension:.4,borderWidth:2,spanGaps:true},
      {label:'Sell cumulative %',data:cumSellPts,borderColor:CH.red,backgroundColor:`${CH.red}22`,fill:false,pointRadius:0,tension:.4,borderWidth:2,spanGaps:true},
    ]);

    if(buyMetrics){
      const v=buyMetrics.filter(r=>r.avg!=null);
      mkBar('fwdB',rFwdB,v.map(r=>r.h),v.map(r=>parseFloat(r.avg)),v.map(r=>parseFloat(r.avg)>=0?`${CH.green}cc`:`${CH.red}cc`),{scales:{...SCALES_STD,y:{...SCALES_STD.y,ticks:{...SCALES_STD.y.ticks,callback:v=>`${v}%`}}}});
    }
    if(sellMetrics){
      const v=sellMetrics.filter(r=>r.avg!=null);
      mkBar('fwdS',rFwdS,v.map(r=>r.h),v.map(r=>parseFloat(r.avg)),v.map(r=>parseFloat(r.avg)>=0?`${CH.green}cc`:`${CH.red}cc`),{scales:{...SCALES_STD,y:{...SCALES_STD.y,ticks:{...SCALES_STD.y.ticks,callback:v=>`${v}%`}}}});
    }

    const confWRData=['100','110','120','130','140'].map(c=>{
      const sigs=enriched.filter(s=>String(s.confidence)===c&&s.returns?.['24c']!=null);
      if(!sigs.length) return null;
      const wins=sigs.filter(s=>s.signal==='buy'?s.returns['24c']>0:s.returns['24c']<0).length;
      return{c,wr:(wins/sigs.length*100).toFixed(1),n:sigs.length};
    }).filter(Boolean);
    if(confWRData.length) mkBar('confWR',rConfWR,confWRData.map(x=>`${x.c} (n=${x.n})`),confWRData.map(x=>parseFloat(x.wr)),confWRData.map(x=>parseFloat(x.wr)>55?`${CH.green}cc`:parseFloat(x.wr)<45?`${CH.red}cc`:`${CH.amber}cc`),{scales:{...SCALES_STD,y:{...SCALES_STD.y,max:100,ticks:{...SCALES_STD.y.ticks,callback:v=>`${v}%`}}}});

    const re=Object.entries(rulesetDist).sort((a,b)=>b[1]-a[1]).slice(0,12);
    if(re.length) mkHBar('rule',rRule,re.map(([k])=>k),re.map(([,v])=>v),re.map((_,i)=>i%2===0?`${CH.blue}cc`:`${CH.blue}66`));

    const ce=Object.entries(confBuckets).sort((a,b)=>parseInt(a[0])-parseInt(b[0]));
    if(ce.length) mkBar('confBar',rConfBar,ce.map(([k])=>`Conf ${k}`),ce.map(([,v])=>v),ce.map(([k])=>{const n=parseInt(k);return n>=120?`${CH.green}cc`:n>=110?`${CH.amber}cc`:`${CH.blue}cc`;}));

    const hCnts=Array.from({length:24},(_,i)=>temporal.byHour[i]?.count||0);
    mkBar('hour',rHour,Array.from({length:24},(_,i)=>`${i}h`),hCnts,hCnts.map(v=>v>0?`${CH.blue}cc`:`${CH.blue}33`));
    const dCnts=Array.from({length:7},(_,i)=>temporal.byDOW[i]?.count||0);
    mkBar('dow',rDow,DOW_LABELS,dCnts,dCnts.map(()=>`${CH.purple}cc`));
    const mCnts=Array.from({length:12},(_,i)=>temporal.byMonth[i]?.count||0);
    mkBar('mon',rMon,MONTH_LABELS,mCnts,mCnts.map(()=>`${CH.teal}cc`));
  }

  const doRun=useCallback(async()=>{
    if(!ticker||!fromDate||!toDate){setError('Asset, From date, and To date are required');return;}
    setLoading(true);setAnalysis(null);setError('');setProgress('Fetching signals...');destroyAll();
    try{
      const p=new URLSearchParams({ticker,chart_interval:interval,limit});
      if(fromDate) p.append('from_date',fromDate);
      if(toDate)   p.append('to_date',toDate);
      const r=await fetch(`${API.backtestResults}?${p}`).then(r=>r.json());
      if(r.status!=='success'||!r.data?.results?.length){setError('No signals found for these parameters.');return;}
      const sigs=r.data.results;
      setProgress(`Fetching price data for ${sigs.length} signals...`);
      let priceData=[];
      try{
        const pr=await fetch(API.getData,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ticker,interval,from_datetime:fromDate+'T00:00',to_datetime:toDate+'T23:59'})}).then(r=>r.json());
        priceData=(pr.records||[]).map(rec=>({
          x:new Date(rec.data?.candle_close_ts+(rec.data?.candle_close_ts?.endsWith('Z')?'':'Z')),
          y:parseFloat(rec.data?.close)
        })).filter(p=>!isNaN(p.y)).sort((a,b)=>a.x-b.x);
      }catch{}
      setProgress('Calculating returns and patterns...');
      const enriched=priceData.length>5?calcForwardReturns(sigs,priceData):sigs.map(s=>({...s,returns:{}}));
      const buyMetrics=calcMetrics(enriched,'buy'),sellMetrics=calcMetrics(enriched,'sell');
      const quality=calcQuality(enriched),temporal=calcTemporal(enriched);
      const rulesetDist={},bbDist={},divDist={bullish:0,bearish:0,none:0},confBuckets={};
      enriched.forEach(s=>{
        rulesetDist[s.ruleset_number]=(rulesetDist[s.ruleset_number]||0)+1;
        const st=s.candle_data?.bb_data?.candle_status||'unknown'; bbDist[st]=(bbDist[st]||0)+1;
        const dt=s.candle_data?.divergence_data?.type||'none'; divDist[dt]=(divDist[dt]||0)+1;
        const b=Math.floor(s.confidence/10)*10; confBuckets[b]=(confBuckets[b]||0)+1;
      });
      const an={enriched,total:sigs.length,buy:enriched.filter(s=>s.signal==='buy').length,sell:enriched.filter(s=>s.signal==='sell').length,avgConf:(sigs.reduce((a,s)=>a+s.confidence,0)/sigs.length).toFixed(1),buyMetrics,sellMetrics,quality,temporal,rulesetDist,bbDist,divDist,confBuckets};
      setAnalysis(an);
      setTimeout(()=>buildAllCharts(an),80);
    }catch(e){setError(e.message);}
    finally{setLoading(false);setProgress('');}
  },[ticker,interval,fromDate,toDate,limit]);// eslint-disable-line

  const loadWithCache = useCallback(async (force=false) => {
    const key = `${ticker}|${interval}|${fromDate}|${toDate}`;
    if (!force && lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;
    await doRun();
  }, [ticker, interval, fromDate, toDate, limit, doRun]);

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

  function MetricsTable({data,type}){
    if(!data) return (
      <Box sx={{ py: 3, textAlign: 'center', color: 'text.disabled', fontSize: 13 }}>No {type} signals</Box>
    );
    return(
      <Box sx={{ overflowX: 'auto' }}>
        <table style={{fontSize:12.5,width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr>
              {['Horizon','N','Avg','Median','Win rate'].map(h=>(
                <th key={h} style={{textAlign:h==='Horizon'?'left':'right',padding:'8px 12px',fontSize:10,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'#64748b',borderBottom:'2px solid #e0e5ef'}}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{data.map(r=>(
            <tr key={r.h} style={{borderBottom:'1px solid rgba(0,0,0,.04)'}}>
              <td style={{padding:'7px 12px',fontFamily:MONO,fontWeight:600,color:'#0f172a'}}>{r.h}</td>
              <td style={{padding:'7px 12px',textAlign:'right',color:'#94a3b8',fontFamily:MONO}}>{r.n}</td>
              <td style={{padding:'7px 12px',textAlign:'right',fontFamily:MONO,color:parseFloat(r.avg)>0?'#15803d':parseFloat(r.avg)<0?'#dc2626':'#94a3b8'}}>
                {r.avg!=null?`${r.avg}%`:'--'}
              </td>
              <td style={{padding:'7px 12px',textAlign:'right',fontFamily:MONO,color:'#334155'}}>{r.med!=null?`${r.med}%`:'--'}</td>
              <td style={{padding:'7px 12px',textAlign:'right',fontFamily:MONO,fontWeight:600,color:parseFloat(r.win)>55?'#15803d':parseFloat(r.win)<45?'#dc2626':'#b45309'}}>
                {r.win!=null?`${r.win}%`:'--'}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </Box>
    );
  }

  return(
    <Box sx={{ p: 3 }}>
      <PageHeader title="Signal EDA" sub="Exploratory data analysis — forward returns, win rates, temporal patterns, signal quality"/>

      <Card title="Parameters">
        <Grid container spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Asset
            </Typography>
            <Select fullWidth size="small" value={ticker} onChange={e=>setTicker(e.target.value)} sx={selectSx}>
              {(assetNames.length?assetNames:[ticker]).map(n=><MenuItem key={n} value={n} sx={{fontSize:13}}>{n}</MenuItem>)}
            </Select>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Interval
            </Typography>
            <Select fullWidth size="small" value={interval} onChange={e=>setInterval(e.target.value)} sx={selectSx}>
              {(tfValues.length?tfValues:INTERVALS).map(v=><MenuItem key={v} value={v} sx={{fontSize:13}}>{v}</MenuItem>)}
            </Select>
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              From date
            </Typography>
            <TextField
              fullWidth type="date" size="small"
              value={fromDate}
              onChange={e => { const v=e.target.value; setFromDate(v); if(!toDate||(v&&toDate<v)) setToDate(v); }}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { height: 38 } }}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              To date
            </Typography>
            <TextField
              fullWidth type="date" size="small"
              value={toDate}
              inputProps={{ min: fromDate || undefined }}
              onChange={e=>setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { height: 38 } }}
            />
          </Grid>
          <Grid item xs={6} sm={2}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Max signals
            </Typography>
            <Select fullWidth size="small" value={limit} onChange={e=>setLimit(e.target.value)} sx={selectSx}>
              {['500','1000','2000','5000'].map(n=><MenuItem key={n} value={n} sx={{fontSize:13}}>{n}</MenuItem>)}
            </Select>
          </Grid>
        </Grid>
        <Button
          variant="contained"
          onClick={() => loadWithCache(true)}
          disabled={loading || !ticker}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
          sx={{ height: 38 }}
        >
          {loading ? (progress || 'Analyzing…') : 'Run EDA'}
        </Button>
        {error && <Alert type="error" style={{ mt: 2 }}>{error}</Alert>}
      </Card>

      {loading && <Card title="Running analysis"><Loading text={progress}/></Card>}

      {analysis && (
        <>
          <MetricGrid metrics={[
            {label:'Total signals', value:analysis.total, color:'blue'},
            {label:'Buy signals',   value:analysis.buy,   color:'green'},
            {label:'Sell signals',  value:analysis.sell,  color:'red'},
            {label:'Avg confidence',value:analysis.avgConf,color:'purple'},
          ]}/>

          {/* Tab navigation */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
            <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{ minHeight: 42 }}>
              {['Overview','Performance','Temporal Patterns','Quality Metrics'].map((label,i)=>(
                <Tab key={label} label={label} value={i} sx={{ fontSize: 13, fontWeight: 500, minHeight: 42, textTransform: 'none' }} />
              ))}
            </Tabs>
          </Box>

          {/* OVERVIEW */}
          {tab === 0 && (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <Card title="Buy vs sell distribution" accent="blue">
                    <Box sx={{ position: 'relative', height: 160 }}><canvas ref={rDist}/></Box>
                    <Box sx={{ display: 'flex', gap: 2, mt: 1, justifyContent: 'center' }}>
                      <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700, fontSize: 13 }}>{analysis.buy} Buy</Typography>
                      <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>{analysis.sell} Sell</Typography>
                    </Box>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <Card title="Cumulative return over time (24-candle horizon)" accent="green">
                    <Box sx={{ position: 'relative', height: 180 }}><canvas ref={rCum}/></Box>
                  </Card>
                </Grid>
              </Grid>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Card title="BB candle status at signal">
                    <MiniBar entries={Object.entries(analysis.bbDist).sort((a,b)=>b[1]-a[1])} getColor={k=>k.includes('bbl')?CH.green:k.includes('bbu')?CH.red:CH.amber}/>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card title="Divergence type at signal">
                    <MiniBar entries={Object.entries(analysis.divDist)} getColor={k=>k==='bullish'?CH.green:k==='bearish'?CH.red:'#94a3b8'}/>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Card title="Signals per confidence level">
                    <Box sx={{ position: 'relative', height: 140 }}><canvas ref={rConfBar}/></Box>
                  </Card>
                </Grid>
              </Grid>
            </>
          )}

          {/* PERFORMANCE */}
          {tab === 1 && (
            <>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} md={6}>
                  <Card title="Buy signals — avg forward return" subtitle="Positive = price rose after buy signal" accent="green">
                    <Box sx={{ position: 'relative', height: 180, mb: 2 }}><canvas ref={rFwdB}/></Box>
                    <MetricsTable data={analysis.buyMetrics} type="buy"/>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card title="Sell signals — avg forward return" subtitle="Negative = price fell after sell signal" accent="red">
                    <Box sx={{ position: 'relative', height: 180, mb: 2 }}><canvas ref={rFwdS}/></Box>
                    <MetricsTable data={analysis.sellMetrics} type="sell"/>
                  </Card>
                </Grid>
              </Grid>
              <Card title="Win rate by confidence level (24-candle horizon)" subtitle="% of signals where the predicted direction was correct">
                <Box sx={{ position: 'relative', height: 200 }}><canvas ref={rConfWR}/></Box>
              </Card>
              <Card title="Top rulesets by signal count">
                <Box sx={{ position: 'relative', height: 300 }}><canvas ref={rRule}/></Box>
              </Card>
            </>
          )}

          {/* TEMPORAL */}
          {tab === 2 && (
            <>
              <Card title="Signal frequency by hour (UTC)" subtitle="Which hours of day generate the most signals?">
                <Box sx={{ position: 'relative', height: 180 }}><canvas ref={rHour}/></Box>
              </Card>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Card title="Signal frequency by day of week">
                    <Box sx={{ position: 'relative', height: 200 }}><canvas ref={rDow}/></Box>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Card title="Signal frequency by month">
                    <Box sx={{ position: 'relative', height: 200 }}><canvas ref={rMon}/></Box>
                  </Card>
                </Grid>
              </Grid>
            </>
          )}

          {/* QUALITY */}
          {tab === 3 && (
            <>
              <MetricGrid metrics={[
                {label:'Accuracy',  value:`${analysis.quality.accuracy.toFixed(1)}%`, color:'blue'},
                {label:'Precision', value:`${analysis.quality.precision.toFixed(1)}%`,color:'green'},
                {label:'Recall',    value:`${analysis.quality.recall.toFixed(1)}%`,   color:'amber'},
                {label:'F1 Score',  value:`${analysis.quality.f1.toFixed(1)}%`,       color:'purple'},
              ]}/>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card title="Confusion matrix" subtitle="Signal correctness — based on 24-candle forward return">
                    <Grid container spacing={1.5}>
                      {[
                        {label:'True Positive',  value:analysis.quality.tp, desc:'Buy predicted, price went up',   color:COLOR.green},
                        {label:'True Negative',  value:analysis.quality.tn, desc:'Sell predicted, price went down',color:COLOR.green},
                        {label:'False Positive', value:analysis.quality.fp, desc:'Buy predicted, price went down', color:COLOR.red},
                        {label:'False Negative', value:analysis.quality.fn, desc:'Sell predicted, price went up',  color:COLOR.red},
                      ].map(m=>(
                        <Grid item xs={6} key={m.label}>
                          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: m.color.bg, borderColor: m.color.border }}>
                            <Typography sx={{ fontSize: 24, fontWeight: 700, color: m.color.text, fontFamily: MONO }}>{m.value}</Typography>
                            <Typography sx={{ fontSize: 11, fontWeight: 700, color: m.color.text }}>{m.label}</Typography>
                            <Typography sx={{ fontSize: 10, color: m.color.text, opacity: .75, mt: 0.25 }}>{m.desc}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card title="Metric definitions">
                    {[
                      ['Accuracy','Overall % of correct predictions (buy + sell combined)'],
                      ['Precision','% of buy signals followed by price increase'],
                      ['Recall','% of actual price increases captured by buy signals'],
                      ['F1 Score','Harmonic mean of precision and recall'],
                    ].map(([k,v],i,arr)=>(
                      <Box key={k} sx={{ pb: 1.25, mb: i<arr.length-1?1.25:0, borderBottom: i<arr.length-1?'1px solid':'none', borderColor: 'divider' }}>
                        <Typography sx={{ fontSize: 12, fontWeight: 600, color: 'text.primary', mb: 0.25 }}>{k}</Typography>
                        <Typography variant="caption" sx={{ fontSize: 12, color: 'text.secondary' }}>{v}</Typography>
                      </Box>
                    ))}
                  </Card>
                </Grid>
              </Grid>
            </>
          )}
        </>
      )}
    </Box>
  );
}

/* ══════════════════════════════════════════
   MTF BACKTEST ANALYSIS
══════════════════════════════════════════ */
export function MTFBacktestAnalysis({ isActive }) {
  const { ticker, setTicker, fromDate, setFromDate, toDate, setToDate, assetNames, timeframes } = useAppCtx();
  const [enabledTFs,setEnabledTFs]=useState({});
  const [loading,setLoading]=useState(false);
  const [allSignals,setAllSignals]=useState({});
  const [error,setError]=useState('');
  const [chartBuilt,setChartBuilt]=useState(false);
  const prevActive = useRef(false);
  const lastLoadedKey = useRef(null);
  const chartWrapRef = useRef(null);
  const chartRef=useRef(null), chartInst=useRef(null);

  useEffect(()=>{
    if(timeframes.length){ const init={}; timeframes.forEach(tf=>{init[tf.value]=true;}); setEnabledTFs(init); }
  },[timeframes]);
  useEffect(()=>()=>{chartInst.current?.destroy();},[]);

  // Chart.js can render "cropped / shifted" if the canvas is initialized before its container
  // has a stable size (common when switching tabs/panels). Observe size changes and force a resize.
  useEffect(() => {
    if (!chartWrapRef.current) return;
    if (typeof ResizeObserver === 'undefined') return;
    const el = chartWrapRef.current;

    let raf1 = 0;
    let raf2 = 0;
    const ro = new ResizeObserver(() => {
      if (!chartInst.current) return;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      // Double rAF helps after layout + Card padding settles.
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          try {
            chartInst.current?.resize();
            chartInst.current?.update('none');
          } catch {}
        });
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro.disconnect();
    };
  }, []);

  function pickPriceTimeframe() {
    const active = timeframes
      .filter(tf => enabledTFs?.[tf.value])
      .map(tf => ({ value: tf.value, seconds: tf.seconds }))
      .filter(tf => typeof tf.seconds === 'number' && isFinite(tf.seconds) && tf.seconds > 0);

    // Fallback if context hasn't populated yet.
    if (!active.length) return timeframes?.[0]?.value || '4hour';

    const start = new Date(`${fromDate}T00:00:00Z`);
    const end = new Date(`${toDate}T23:59:59Z`);
    const rangeSec = (!isNaN(start) && !isNaN(end)) ? Math.max(0, (end.getTime() - start.getTime()) / 1000) : null;

    // If we can't compute range, use the smallest timeframe for detail.
    if (!rangeSec) return active.slice().sort((a, b) => a.seconds - b.seconds)[0].value;

    // Choose a timeframe that yields a reasonable number of candles for the range.
    // Target ~1500 candles (cap at 2500) to keep the line detailed but performant.
    const TARGET = 1500;
    const MAX = 2500;
    const sorted = active.slice().sort((a, b) => a.seconds - b.seconds); // smallest → largest

    // Prefer the *largest* timeframe that still stays under MAX points (best perf).
    let choice = sorted[sorted.length - 1];
    for (let i = 0; i < sorted.length; i++) {
      const tf = sorted[i];
      const points = rangeSec / tf.seconds;
      if (points <= MAX) {
        choice = tf;
        // keep scanning to find the largest under MAX
      }
    }

    // If everything is under MAX, bias toward TARGET by picking the closest.
    const underMax = sorted.filter(tf => (rangeSec / tf.seconds) <= MAX);
    if (underMax.length) {
      choice = underMax.reduce((best, tf) => {
        const p = rangeSec / tf.seconds;
        const b = rangeSec / best.seconds;
        return Math.abs(p - TARGET) < Math.abs(b - TARGET) ? tf : best;
      }, underMax[0]);
    }

    return choice.value;
  }

  const doLoad=useCallback(async()=>{
    if(!ticker||!fromDate||!toDate){setError('Asset, From date, and To date required');return;}
    setLoading(true);setError('');setAllSignals({});setChartBuilt(false);
    chartInst.current?.destroy();chartInst.current=null;
    try{
      const priceTF=pickPriceTimeframe();
      const [priceRes,...sigResults]=await Promise.all([
        fetch(API.getData,{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({ticker,interval:priceTF,from_datetime:fromDate+'T00:00',to_datetime:toDate+'T23:59'})}).then(r=>r.json()),
        ...timeframes.map(tf=>
          fetch(`${API.backtestResults}?ticker=${ticker}&chart_interval=${tf.value}&from_date=${fromDate}&to_date=${toDate}&limit=10000`)
            .then(r=>r.json()).then(res=>({tf,signals:res.status==='success'&&res.data?.results?res.data.results:[]}))
        ),
      ]);
      const price=(priceRes?.records||[])
        .map(rec=>({x:new Date(rec.data?.candle_close_ts+(rec.data?.candle_close_ts?.endsWith('Z')?'':'Z')),y:parseFloat(rec.data?.close)}))
        .filter(p=>p.x instanceof Date&&!isNaN(p.x)&&!isNaN(p.y)).sort((a,b)=>a.x-b.x);
      const sigMap={}; sigResults.forEach(({tf,signals})=>{sigMap[tf.value]=signals;}); setAllSignals(sigMap);
      if(price.length>0) setTimeout(()=>{if(chartRef.current) buildChart(price,sigMap,ticker);},80);
      else setError('No price data found. Verify the date range has data for this ticker/interval.');
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[ticker,fromDate,toDate,timeframes,enabledTFs]);// eslint-disable-line

  const loadWithCache = useCallback(async (force=false) => {
    const key = `${ticker}|${fromDate}|${toDate}`;
    if (!force && lastLoadedKey.current === key) return;
    lastLoadedKey.current = key;
    await doLoad();
  }, [ticker, fromDate, toDate, doLoad]);

  useEffect(() => {
    const nowActive = isActive !== false;
    if (!nowActive) return;
    if (!ticker || !fromDate || !toDate) return;
    if (!timeframes.length) return;
    if (!Object.keys(enabledTFs || {}).length) return;
    loadWithCache(false);
  }, [isActive, ticker, fromDate, toDate, timeframes.length, enabledTFs, loadWithCache]);

  useEffect(() => {
    const nowActive = isActive !== false;
    if (nowActive && prevActive.current === false) {
      lastLoadedKey.current = null;
      if (ticker && fromDate && toDate) loadWithCache(true);
    }
    prevActive.current = nowActive;
  }, [isActive, ticker, fromDate, toDate, loadWithCache]);

  function stackSignals(signals,priceArr){
    const groups={};
    signals.forEach(s=>{
      const t=new Date(s.candle_close_ts+(s.candle_close_ts.endsWith('Z')?'':'Z')).getTime();
      const rnd=Math.floor(t/60000)*60000;
      if(!groups[rnd]) groups[rnd]=[]; groups[rnd].push(s);
    });
    const priceRange=priceArr.length?(Math.max(...priceArr.map(p=>p.y))-Math.min(...priceArr.map(p=>p.y)))||1:1;
    const out=[];
    Object.values(groups).forEach(group=>group.forEach((s,i)=>{
      out.push({
        x:new Date(s.candle_close_ts+(s.candle_close_ts.endsWith('Z')?'':'Z')),
        y:parseFloat(s.close)+priceRange*(i*0.003),
        originalY:parseFloat(s.close),confidence:s.confidence,ruleset:s.ruleset_number,ruleName:s.ruleset_name,signal:s,
      });
    }));
    return out;
  }

  function buildChart(price,sigMap,tkr){
    chartInst.current?.destroy();
    const minX = price?.[0]?.x instanceof Date && !isNaN(price[0].x) ? price[0].x : undefined;
    const maxX = price?.[price.length - 1]?.x instanceof Date && !isNaN(price[price.length - 1].x) ? price[price.length - 1].x : undefined;
    const datasets=[{label:`${tkr} Price`,data:price,borderColor:CH.blue,backgroundColor:'rgba(55,138,221,0.06)',borderWidth:2,pointRadius:0,fill:true,tension:0.1,order:100}];
    timeframes.forEach((tf,idx)=>{
      if(!enabledTFs[tf.value]) return;
      const sigs=sigMap[tf.value]||[], r=dotRadius(tf.seconds);
      const buyC=BUY_COLORS[idx%BUY_COLORS.length], sellC=SELL_COLORS[idx%SELL_COLORS.length];
      const buySigs=sigs.filter(s=>s.signal==='buy'), sellSigs=sigs.filter(s=>s.signal==='sell');
      if(buySigs.length) datasets.push({label:`${tf.displayName} BUY`,timeframe:tf.value,data:stackSignals(buySigs,price),backgroundColor:buyC,borderColor:buyC,pointRadius:r,pointHoverRadius:r+3,showLine:false,pointStyle:'circle',order:idx});
      if(sellSigs.length) datasets.push({label:`${tf.displayName} SELL`,timeframe:tf.value,data:stackSignals(sellSigs,price),backgroundColor:sellC,borderColor:sellC,pointRadius:r,pointHoverRadius:r+3,showLine:false,pointStyle:'triangle',rotation:180,order:idx});
    });
    chartInst.current=new Chart(chartRef.current,{
      type:'line',data:{datasets},
      options:{
        responsive:true,maintainAspectRatio:false,animation:{duration:350},
        interaction:{mode:'point',intersect:true},
        plugins:{
          legend:{display:false},
          tooltip:{backgroundColor:'rgba(255,255,255,.97)',titleColor:'#0f172a',bodyColor:'#334155',borderColor:'#e0e5ef',borderWidth:1,padding:10,
            callbacks:{
              title:ctx=>ctx[0]?.dataset?.label?.includes('Price')?'Price data':ctx[0]?.dataset?.label||'',
              label:ctx=>{
                const d=ctx.raw;
                if(ctx.dataset.label?.includes('Price')) return `$${fmt.price(d.y)}`;
                return [`Time: ${d.x?.toLocaleString('en-US',{month:'short',day:'2-digit',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}`,`Price: $${fmt.price(d.originalY||d.y)}`,`Confidence: ${d.confidence}`,`Ruleset: ${d.ruleset}`,`Rule: ${d.ruleName||'N/A'}`];
              },
            },
          },
        },
        scales:{
          x:{
            type:'time',
            min: minX,
            max: maxX,
            bounds: 'data',
            time:{tooltipFormat:'MMM dd yyyy HH:mm'},
            grid:{color:'rgba(0,0,0,.04)'},
            ticks:{color:'#64748b',font:{size:10},maxTicksLimit:12},
          },
          y:{grid:{color:'rgba(0,0,0,.04)'},ticks:{color:'#64748b',font:{size:10},callback:v=>`$${Number(v).toLocaleString()}`}},
        },
      },
    });
    setChartBuilt(true);
  }

  function toggleTF(v,on){
    setEnabledTFs(p=>({...p,[v]:on}));
    if(!chartInst.current) return;
    chartInst.current.data.datasets.forEach(ds=>{if(ds.timeframe===v) ds.hidden=!on;});
    chartInst.current.update('none');
  }

  const totalSigs=Object.values(allSignals).flat().length;
  const buySigs=Object.values(allSignals).flat().filter(s=>s.signal==='buy').length;
  const sellSigs=Object.values(allSignals).flat().filter(s=>s.signal==='sell').length;
  const activeTFCount=timeframes.filter(tf=>enabledTFs[tf.value]&&(allSignals[tf.value]?.length||0)>0).length;

  return(
    <Box sx={{ p: 3 }}>
      <PageHeader title="Multi-Timeframe Analysis" sub="All timeframe signals overlaid on one price chart — identify confluence where multiple timeframes agree"/>

      <Card title="Parameters">
        <Grid container spacing={2} alignItems="flex-end" sx={{ mb: 2 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              Asset
            </Typography>
            <Select fullWidth size="small" value={ticker} onChange={e=>setTicker(e.target.value)} sx={selectSx}>
              {(assetNames.length?assetNames:[ticker]).map(n=><MenuItem key={n} value={n} sx={{fontSize:13}}>{n}</MenuItem>)}
            </Select>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              From date
            </Typography>
            <TextField
              fullWidth type="date" size="small"
              value={fromDate}
              onChange={e => { const v=e.target.value; setFromDate(v); if(!toDate||(v&&toDate<v)) setToDate(v); }}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { height: 38 } }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'text.secondary', display: 'block', mb: 0.75 }}>
              To date
            </Typography>
            <TextField
              fullWidth type="date" size="small"
              value={toDate}
              inputProps={{ min: fromDate || undefined }}
              onChange={e=>setToDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { height: 38 } }}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => loadWithCache(true)}
              disabled={loading || !ticker}
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              sx={{ height: 38 }}
            >
              {loading ? 'Loading all timeframes…' : 'Load MTF signals'}
            </Button>
          </Grid>
        </Grid>

        {timeframes.length > 0 && (
          <>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.09em', color: 'text.secondary', display: 'block', mb: 1 }}>
              Timeframe visibility — click to show / hide on chart
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {timeframes.map((tf, idx) => {
                const on = enabledTFs[tf.value] ?? true;
                const cnt = allSignals[tf.value]?.length;
                const buyC = BUY_COLORS[idx % BUY_COLORS.length];
                const sellC = SELL_COLORS[idx % SELL_COLORS.length];
                const r = dotRadius(tf.seconds);
                return (
                  <Box
                    key={tf.value}
                    onClick={() => toggleTF(tf.value, !on)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.875,
                      background: on ? '#eef3ff' : '#f7f9fc',
                      border: `1.5px solid ${on ? '#4f7ef8' : '#e0e5ef'}`,
                      borderRadius: 1, cursor: 'pointer', userSelect: 'none',
                      transition: 'all .14s',
                      '&:hover': { borderColor: '#4f7ef8' },
                    }}
                  >
                    <Box sx={{ width: r*2, height: r*2, borderRadius: '50%', bgcolor: buyC, flexShrink: 0 }} />
                    <Box sx={{ width: 0, height: 0, borderLeft: `${r}px solid transparent`, borderRight: `${r}px solid transparent`, borderTop: `${r*1.5}px solid ${sellC}`, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 500, color: on ? '#1d4ed8' : '#94a3b8' }}>{tf.displayName}</Typography>
                    {cnt !== undefined && <Typography variant="caption" sx={{ fontSize: 10, color: 'text.disabled' }}>({cnt})</Typography>}
                  </Box>
                );
              })}
            </Box>
          </>
        )}
        {error && <Alert type="error" style={{ mt: 2 }}>{error}</Alert>}
      </Card>

      {loading && <Card title="Loading multi-timeframe data"><Loading text="Fetching price data and signals for all timeframes simultaneously…"/></Card>}

      {totalSigs > 0 && !loading && (
        <MetricGrid metrics={[
          {label:'Total signals',    value:totalSigs,    color:'blue'},
          {label:'Buy signals',      value:buySigs,      color:'green'},
          {label:'Sell signals',     value:sellSigs,     color:'red'},
          {label:'Active timeframes',value:activeTFCount,color:'purple'},
        ]}/>
      )}

      <Card
        title={`${ticker} — Multi-timeframe signal overlay`}
        subtitle="Circle = buy signal  |  Inverted triangle = sell signal  |  Dot size scales with timeframe duration"
        accent="blue"
      >
        <Box ref={chartWrapRef} sx={{ position: 'relative', height: 520 }}>
          <canvas ref={chartRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          {!chartBuilt && !loading && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', gap: 1, pointerEvents: 'none' }}>
              <Typography variant="body2" color="text.disabled">Configure parameters and click Load MTF signals</Typography>
              <Typography variant="caption" color="text.disabled">Circles = buy, inverted triangles = sell, size = timeframe duration</Typography>
            </Box>
          )}
        </Box>
        {chartBuilt && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, pt: 1.5, mt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary' }}>
              <Box sx={{ width: 16, height: 3, bgcolor: CH.blue, borderRadius: 0.5 }}/>
              <Typography variant="caption">Price line</Typography>
            </Box>
            {timeframes.filter(tf=>enabledTFs[tf.value]&&(allSignals[tf.value]?.length||0)>0).map(tf => {
              const idx = timeframes.indexOf(tf), r = dotRadius(tf.seconds);
              return (
                <React.Fragment key={tf.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: r*2, height: r*2, borderRadius: '50%', bgcolor: BUY_COLORS[idx%BUY_COLORS.length] }}/>
                    <Typography variant="caption" color="text.secondary">{tf.displayName} buy</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box sx={{ width: 0, height: 0, borderLeft: `${r}px solid transparent`, borderRight: `${r}px solid transparent`, borderTop: `${r*1.5}px solid ${SELL_COLORS[idx%SELL_COLORS.length]}` }}/>
                    <Typography variant="caption" color="text.secondary">{tf.displayName} sell</Typography>
                  </Box>
                </React.Fragment>
              );
            })}
          </Box>
        )}
      </Card>

      {totalSigs > 0 && !loading && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Card title="Signals by timeframe" noPad>
                <Box sx={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {['Timeframe','Buy','Sell','Total'].map(h=>(
                          <th key={h} style={{ textAlign: h==='Timeframe'?'left':'center', padding:'10px 14px', fontSize:10, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:'#64748b', borderBottom:'2px solid #e0e5ef', background:'#f7f9fc' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeframes.filter(tf=>allSignals[tf.value]?.length>0).map(tf=>{
                        const s=allSignals[tf.value]||[];
                        return(
                          <tr key={tf.value} style={{ borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                            <td style={{ padding:'8px 14px' }}>
                              <Typography sx={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: BUY_COLORS[timeframes.indexOf(tf)%BUY_COLORS.length] }}>{tf.value}</Typography>
                            </td>
                            <td style={{ padding:'8px 14px', textAlign:'center', color:'#15803d', fontWeight:600 }}>{s.filter(x=>x.signal==='buy').length}</td>
                            <td style={{ padding:'8px 14px', textAlign:'center', color:'#dc2626', fontWeight:600 }}>{s.filter(x=>x.signal==='sell').length}</td>
                            <td style={{ padding:'8px 14px', textAlign:'center', fontWeight:600 }}>{s.length}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card title="Reading the confluence chart">
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, mb: 1.5 }}>
                  <strong style={{ color: '#0f172a' }}>Vertical stacking</strong> = multiple timeframes fired at the same price level simultaneously. This is the highest-confidence setup.
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12 }}>
                  {[['1 timeframe','Normal signal'],['2 timeframes','Strong confluence'],['3+ timeframes','Very high confidence'],['All TFs','Rare — major reversal']].map(([k,v])=>(
                    <React.Fragment key={k}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.primary' }}>{k}</Typography>
                      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{v}</Typography>
                    </React.Fragment>
                  ))}
                </Box>
              </Card>
            </Grid>
          </Grid>

          <Card title={`All signals — ${totalSigs.toLocaleString()} total (showing latest 200)`} noPad>
            <Box sx={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['#','TF','Signal','Date (PDT)','Close','Confidence','Ruleset'].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:10, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:'#64748b', borderBottom:'2px solid #e0e5ef', whiteSpace:'nowrap', position:'sticky', top:0, zIndex:1, background:'#f7f9fc' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeframes.flatMap(tf=>(allSignals[tf.value]||[]).map(s=>({...s,_tf:tf.value,_idx:timeframes.indexOf(tf)}))).sort((a,b)=>new Date(b.candle_close_ts+'Z')-new Date(a.candle_close_ts+'Z')).slice(0,200).map((s,i)=>(
                    <tr key={`${s._tf}-${s.id}`} style={{ borderBottom:'1px solid rgba(0,0,0,.04)' }}>
                      <td style={{ padding:'8px 14px', fontFamily:MONO, fontSize:11, color:'#94a3b8' }}>{i+1}</td>
                      <td style={{ padding:'8px 14px', fontFamily:MONO, fontSize:11, color:BUY_COLORS[s._idx%BUY_COLORS.length], fontWeight:700 }}>{s._tf}</td>
                      <td style={{ padding:'8px 14px' }}><SignalBadge signal={s.signal}/></td>
                      <td style={{ padding:'8px 14px', fontFamily:MONO, fontSize:11, whiteSpace:'nowrap' }}>{fmt.ts(s.candle_close_ts)}</td>
                      <td style={{ padding:'8px 14px', fontFamily:MONO, fontSize:12, fontWeight:500 }}>${fmt.price(s.close)}</td>
                      <td style={{ padding:'8px 14px', fontWeight:600, color:s.confidence>=120?'#15803d':s.confidence>=110?'#b45309':'#1d4ed8' }}>{s.confidence}</td>
                      <td style={{ padding:'8px 14px', fontFamily:MONO, fontSize:11, color:'#1d4ed8' }}>{s.ruleset_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Card>
        </>
      )}
    </Box>
  );
}
