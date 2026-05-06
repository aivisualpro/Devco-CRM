import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

const C = { brand:'#0F4C75', brandDark:'#0a3352', emerald:'#059669', red:'#dc2626', amber:'#d97706', blue:'#2563eb', violet:'#7c3aed', slate1:'#f1f5f9', slate2:'#e2e8f0', slate4:'#94a3b8', slate6:'#475569', slate7:'#334155', slate8:'#1e293b', slate9:'#0f172a', white:'#ffffff' };

const s = StyleSheet.create({
  page:{ fontFamily:'Helvetica', backgroundColor:'#f8fafc', padding:0 },
  // Header
  hdr:{ backgroundColor:C.brand, paddingHorizontal:28, paddingTop:18, paddingBottom:0 },
  hdrTop:{ flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start' },
  hdrLogo:{ fontSize:20, fontFamily:'Helvetica-Bold', color:C.white, letterSpacing:1 },
  hdrSub:{ fontSize:8.5, color:'rgba(255,255,255,0.6)', marginTop:2 },
  hdrRight:{ alignItems:'flex-end' },
  hdrDate:{ fontSize:7.5, color:'rgba(255,255,255,0.6)' },
  hdrPeriod:{ fontSize:10, fontFamily:'Helvetica-Bold', color:C.white, marginTop:2 },
  // Exec strip (dark bar inside header)
  strip:{ flexDirection:'row', marginTop:14, backgroundColor:'rgba(0,0,0,0.25)', borderRadius:6, paddingVertical:8, paddingHorizontal:4 },
  stripItem:{ flex:1, alignItems:'center' },
  stripVal:{ fontSize:12, fontFamily:'Helvetica-Bold', color:C.white },
  stripLbl:{ fontSize:7, color:'rgba(255,255,255,0.55)', marginTop:1 },
  stripDiv:{ width:1, backgroundColor:'rgba(255,255,255,0.15)' },
  // Body
  body:{ paddingHorizontal:22, paddingTop:14, paddingBottom:36 },
  // Section
  sh:{ flexDirection:'row', alignItems:'center', marginBottom:7, marginTop:14 },
  shLine:{ flex:1, height:1, backgroundColor:C.slate2, marginLeft:7 },
  shTxt:{ fontSize:8, fontFamily:'Helvetica-Bold', color:C.slate8, textTransform:'uppercase', letterSpacing:0.7 },
  // KPI grid (5-col)
  kpiRow:{ flexDirection:'row', gap:5 },
  kpiCard:{ flex:1, backgroundColor:C.white, borderRadius:7, padding:9, borderWidth:1, borderColor:C.slate2 },
  kpiAccent:{ width:3, borderRadius:2, marginRight:7 },
  kpiInner:{ flexDirection:'row', alignItems:'stretch' },
  kpiLbl:{ fontSize:6.5, color:C.slate4, fontFamily:'Helvetica-Bold', textTransform:'uppercase', letterSpacing:0.3 },
  kpiVal:{ fontSize:13, fontFamily:'Helvetica-Bold', color:C.slate9, marginTop:3 },
  kpiSub:{ fontSize:6.5, color:C.slate4, marginTop:2 },
  // Insight cards (full width, left border)
  insCard:{ flexDirection:'row', marginBottom:5, borderRadius:6 },
  insBorder:{ width:4 },
  insBody:{ flex:1, backgroundColor:C.white, borderWidth:1, borderColor:C.slate2, padding:7 },
  insTitleRow:{ flexDirection:'row', alignItems:'center', gap:5 },
  insTitle:{ fontSize:8, fontFamily:'Helvetica-Bold' },
  insBadge:{ paddingHorizontal:5, paddingVertical:1.5, borderRadius:3 },
  insBadgeTxt:{ fontSize:6, fontFamily:'Helvetica-Bold', color:C.white },
  insDetail:{ fontSize:7.5, color:C.slate6, marginTop:3, lineHeight:1.4 },
  insMetric:{ fontSize:7.5, fontFamily:'Helvetica-Bold', marginTop:3 },
  // Table
  tHead:{ flexDirection:'row', backgroundColor:C.slate8, paddingVertical:5, paddingHorizontal:4 },
  tHeadTxt:{ fontSize:6.5, fontFamily:'Helvetica-Bold', color:'rgba(255,255,255,0.7)', textTransform:'uppercase', letterSpacing:0.3 },
  tRow:{ flexDirection:'row', paddingVertical:4.5, paddingHorizontal:4, borderBottomWidth:1, borderBottomColor:'#f1f5f9' },
  tCell:{ fontSize:7.5, color:C.slate7 },
  tCellB:{ fontSize:7.5, fontFamily:'Helvetica-Bold', color:C.slate8 },
  // Badge
  marginBar:{ height:4, borderRadius:2, marginTop:3 },
  // Footer
  footer:{ position:'absolute', bottom:10, left:22, right:22, flexDirection:'row', justifyContent:'space-between', borderTopWidth:1, borderTopColor:C.slate2, paddingTop:5 },
  footerTxt:{ fontSize:7, color:C.slate4 },
});

const SEV: Record<string,{border:string;bg:string;text:string;badge:string}> = {
  critical:{ border:'#ef4444', bg:'#fff1f2', text:'#991b1b', badge:'#ef4444' },
  warning: { border:'#f59e0b', bg:'#fffbeb', text:'#92400e', badge:'#f59e0b' },
  info:    { border:'#3b82f6', bg:'#eff6ff', text:'#1e3a8a', badge:'#3b82f6' },
  positive:{ border:'#22c55e', bg:'#f0fdf4', text:'#14532d', badge:'#22c55e' },
};

function M(n:number):string { const a=Math.abs(n),s=n<0?'-':''; return a>=1e6?`${s}$${(a/1e6).toFixed(2)}M`:a>=1000?`${s}$${(a/1000).toFixed(1)}k`:`${s}$${Math.round(a)}`; }
function P(n:number):string { return `${n.toFixed(1)}%`; }
function clamp(n:number,mn:number,mx:number):number { return Math.max(mn,Math.min(mx,n)); }

function KpiCard({label,value,sub,color,accentColor}:{label:string;value:string;sub?:string;color?:string;accentColor?:string}) {
  return React.createElement(View,{style:s.kpiCard},
    React.createElement(View,{style:s.kpiInner},
      accentColor ? React.createElement(View,{style:[s.kpiAccent,{backgroundColor:accentColor}]}) : null,
      React.createElement(View,{style:{flex:1}},
        React.createElement(Text,{style:s.kpiLbl},label),
        React.createElement(Text,{style:[s.kpiVal,color?{color}:{}]},value),
        sub ? React.createElement(Text,{style:s.kpiSub},sub) : null,
      ),
    ),
  );
}

function Section({title}:{title:string}) {
  return React.createElement(View,{style:s.sh},
    React.createElement(Text,{style:s.shTxt},title),
    React.createElement(View,{style:s.shLine}),
  );
}

function FinancialsPDF({kpis,insights,projects,periodLabel,projectCount}:{kpis:any;insights:any[];projects:any[];periodLabel:string;projectCount:number}) {
  const generated = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  const allProjects = [...projects].sort((a,b)=>(b.calcProfit||0)-(a.calcProfit||0));
  const topLosers  = [...projects].filter(p=>(p.calcProfit||0)<0).sort((a,b)=>(a.calcProfit||0)-(b.calcProfit||0)).slice(0,5);

  return React.createElement(Document,{title:`DEVCO Financials — ${periodLabel}`,author:'Devco CRM'},

    // ── PAGE 1 ──────────────────────────────────────────────────────────────────
    React.createElement(Page,{size:'LETTER',style:s.page},

      // Header
      React.createElement(View,{style:s.hdr},
        React.createElement(View,{style:s.hdrTop},
          React.createElement(View,null,
            React.createElement(Text,{style:s.hdrLogo},'DEVCO'),
            React.createElement(Text,{style:s.hdrSub},'Financial Performance Report'),
          ),
          React.createElement(View,{style:s.hdrRight},
            React.createElement(Text,{style:s.hdrDate},`Generated ${generated}`),
            React.createElement(Text,{style:s.hdrPeriod},periodLabel),
          ),
        ),
        // Exec strip
        React.createElement(View,{style:s.strip},
          ...[
            {v:M(kpis.income),        l:'Total Revenue'},
            {v:M(kpis.profit),        l:'Gross Profit'},
            {v:P(kpis.marginPct),     l:'Gross Margin'},
            {v:M(kpis.arOutstanding), l:'A/R Outstanding'},
            {v:`${projectCount}`,     l:'Projects'},
            {v:M(kpis.backlog),       l:'Backlog'},
          ].flatMap((item,i,arr)=>{
            const el = React.createElement(View,{key:i,style:s.stripItem},
              React.createElement(Text,{style:s.stripVal},item.v),
              React.createElement(Text,{style:s.stripLbl},item.l),
            );
            return i<arr.length-1 ? [el, React.createElement(View,{key:`d${i}`,style:s.stripDiv})] : [el];
          }),
        ),
      ),

      React.createElement(View,{style:s.body},

        // ── Revenue & Backlog ─────────────────────────────────────────────────
        React.createElement(Section,{title:'Revenue & Backlog'}),
        React.createElement(View,{style:s.kpiRow},
          React.createElement(KpiCard,{label:'Contract Value',   value:M(kpis.contractValue),  sub:`Orig ${M(kpis.originalContract)} + CO ${M(kpis.changeOrders)}`, accentColor:C.emerald}),
          React.createElement(KpiCard,{label:'Earned Revenue',   value:M(kpis.income),         sub:`${projectCount} active projects`,accentColor:C.emerald}),
          React.createElement(KpiCard,{label:'Backlog',          value:M(kpis.backlog),         sub:'remaining to bill', accentColor:C.blue}),
          React.createElement(KpiCard,{label:'% Complete',       value:P(kpis.pctComplete),     sub:'weighted by revenue', accentColor:C.blue}),
          React.createElement(KpiCard,{label:'Avg Project Size', value:M(kpis.avgProjectSize),  sub:kpis.income>0?`${M(kpis.income)} total rev`:'', accentColor:C.slate4}),
        ),

        // ── Cost & Profitability ──────────────────────────────────────────────
        React.createElement(Section,{title:'Cost & Profitability'}),
        React.createElement(View,{style:s.kpiRow},
          React.createElement(KpiCard,{label:'Total Cost',       value:M(kpis.totalCost),       sub:kpis.income>0?`${((kpis.totalCost/kpis.income)*100).toFixed(0)}% of revenue`:'', accentColor:C.amber}),
          React.createElement(KpiCard,{label:'Gross Profit',     value:M(kpis.profit),          sub:kpis.income>0?`on ${M(kpis.income)} revenue`:'', color:kpis.profit>=0?C.emerald:C.red, accentColor:kpis.profit>=0?C.emerald:C.red}),
          React.createElement(KpiCard,{label:'Gross Margin %',   value:P(kpis.marginPct),       sub:kpis.marginPct>=20?'Healthy margin':kpis.marginPct>=10?'Acceptable':'Below target', color:kpis.marginPct>=20?C.emerald:kpis.marginPct>=10?C.amber:C.red, accentColor:kpis.marginPct>=20?C.emerald:C.red}),
          React.createElement(KpiCard,{label:'EAC (Forecast)',   value:M(kpis.eac),             sub:kpis.pctComplete>0?`at ${kpis.pctComplete.toFixed(0)}% complete`:'pending progress', accentColor:C.blue}),
          React.createElement(KpiCard,{label:'Over/Under Bill',  value:M(kpis.overUnderBilling),sub:kpis.overUnderBilling>=0?'over-billed ✓':'under-billed ⚠', color:kpis.overUnderBilling>=0?C.emerald:C.red, accentColor:kpis.overUnderBilling>=0?C.emerald:C.red}),
        ),

        // ── Cash Position ─────────────────────────────────────────────────────
        React.createElement(Section,{title:'Cash Position'}),
        React.createElement(View,{style:s.kpiRow},
          React.createElement(KpiCard,{label:'Payments Received', value:M(kpis.paymentsReceived), sub:kpis.income>0?`${kpis.collectedPct.toFixed(0)}% of revenue collected`:'', accentColor:C.emerald}),
          React.createElement(KpiCard,{label:'A/R Outstanding',   value:M(kpis.arOutstanding),    sub:kpis.income>0?`${((kpis.arOutstanding/kpis.income)*100).toFixed(0)}% uncollected`:'', color:kpis.arOutstanding>0?C.red:C.slate7, accentColor:kpis.arOutstanding>0?C.red:C.slate4}),
          React.createElement(KpiCard,{label:'Payables (A/P)',    value:M(kpis.payables),         sub:kpis.income>0?`${((kpis.payables/kpis.income)*100).toFixed(0)}% of revenue`:'', accentColor:C.violet}),
          React.createElement(KpiCard,{label:'Days Sales Out',    value:`${kpis.dso}d`,           sub:`over ${kpis.periodDays}-day period`, color:kpis.dso>60?C.red:kpis.dso>30?C.amber:C.emerald, accentColor:kpis.dso>60?C.red:C.emerald}),
          React.createElement(KpiCard,{label:'Net Cash Est.',     value:M(kpis.paymentsReceived-kpis.payables), sub:'received minus payables', color:(kpis.paymentsReceived-kpis.payables)>=0?C.emerald:C.red, accentColor:C.violet}),
        ),

        // ── Insights ─────────────────────────────────────────────────────────
        insights.length>0 && React.createElement(View,null,
          React.createElement(Section,{title:`Insights & Alerts (${insights.length})`}),
          ...insights.slice(0,8).map((ins:any,i:number)=>{
            const c = SEV[ins.severity] || SEV.info;
            return React.createElement(View,{key:i,style:s.insCard},
              React.createElement(View,{style:[s.insBorder,{backgroundColor:c.border}]}),
              React.createElement(View,{style:[s.insBody,{backgroundColor:c.bg,borderColor:c.border}]},
                React.createElement(View,{style:s.insTitleRow},
                  React.createElement(Text,{style:[s.insTitle,{color:c.text}]},ins.title),
                  React.createElement(View,{style:[s.insBadge,{backgroundColor:c.badge}]},
                    React.createElement(Text,{style:s.insBadgeTxt},ins.severity.toUpperCase()),
                  ),
                  ins.metric && React.createElement(Text,{style:[s.insMetric,{color:c.text,marginLeft:'auto'}]},`${ins.metric.label}: ${ins.metric.value}`),
                ),
                React.createElement(Text,{style:s.insDetail},ins.detail),
              ),
            );
          }),
        ),
      ),

      // Footer
      React.createElement(View,{style:s.footer,fixed:true},
        React.createElement(Text,{style:s.footerTxt},'DEVCO CRM — Confidential Financial Report'),
        React.createElement(Text,{style:s.footerTxt,render:({pageNumber,totalPages}:any)=>`Page ${pageNumber} of ${totalPages}`}),
      ),
    ),

    // ── PAGE 2 — Full Projects Table ────────────────────────────────────────
    React.createElement(Page,{size:'LETTER',style:s.page},
      // Page 2 header strip
      React.createElement(View,{style:{backgroundColor:C.brand,paddingHorizontal:22,paddingVertical:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}},
        React.createElement(Text,{style:{fontSize:11,fontFamily:'Helvetica-Bold',color:C.white}},'All Projects — Profit Ranking'),
        React.createElement(Text,{style:{fontSize:8,color:'rgba(255,255,255,0.65)'}},'DEVCO Financial Report · '+periodLabel),
      ),

      React.createElement(View,{style:{paddingHorizontal:22,paddingTop:12,paddingBottom:36}},
        // Table header
        React.createElement(View,{style:s.tHead},
          React.createElement(Text,{style:[s.tHeadTxt,{width:'3%'}]},'#'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'9%'}]},'Proposal'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'20%'}]},'Customer'),
          React.createElement(Text,{style:[s.tHeadTxt,{flex:1}]},'Project Name'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'9%',textAlign:'right'}]},'Contract'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'9%',textAlign:'right'}]},'Revenue'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'9%',textAlign:'right'}]},'Cost'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'9%',textAlign:'right'}]},'Profit'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'7%',textAlign:'right'}]},'Margin'),
          React.createElement(Text,{style:[s.tHeadTxt,{width:'7%',textAlign:'right'}]},'A/R'),
        ),

        // Rows
        ...allProjects.slice(0,40).map((p:any,i:number)=>{
          const inc     = p.calcIncome  || 0;
          const cost    = p.calcCost    || 0;
          const profit  = p.calcProfit  || 0;
          const margin  = p.calcMargin  || 0;
          const ar      = p.calcAR      || 0;
          const cv      = (p.originalContract||0)+(p.changeOrders||0);
          const bg      = i%2===0 ? C.white : '#f8fafc';
          return React.createElement(View,{key:i,style:[s.tRow,{backgroundColor:bg}]},
            React.createElement(Text,{style:[s.tCell,{width:'3%',color:C.slate4}]},String(i+1)),
            React.createElement(Text,{style:[s.tCell,{width:'9%',color:C.blue,fontFamily:'Helvetica-Bold'}]},p.proposalNumber||'—'),
            React.createElement(Text,{style:[s.tCell,{width:'20%'}]},(p.CompanyName||'—').substring(0,24)),
            React.createElement(Text,{style:[s.tCell,{flex:1}]},(p.DisplayName||'').substring(0,30)),
            React.createElement(Text,{style:[s.tCell,{width:'9%',textAlign:'right',color:C.slate6}]},cv>0?M(cv):'—'),
            React.createElement(Text,{style:[s.tCell,{width:'9%',textAlign:'right'}]},M(inc)),
            React.createElement(Text,{style:[s.tCell,{width:'9%',textAlign:'right',color:C.slate6}]},M(cost)),
            React.createElement(Text,{style:[s.tCellB,{width:'9%',textAlign:'right',color:profit>=0?C.emerald:C.red}]},M(profit)),
            React.createElement(Text,{style:[s.tCell,{width:'7%',textAlign:'right',color:margin>=20?C.emerald:margin>=0?C.amber:C.red}]},P(margin)),
            React.createElement(Text,{style:[s.tCell,{width:'7%',textAlign:'right',color:ar>0?C.red:C.slate4}]},ar>0?M(ar):'—'),
          );
        }),

        // Totals row
        React.createElement(View,{style:{flexDirection:'row',backgroundColor:C.brand,paddingVertical:6,paddingHorizontal:4,borderRadius:4,marginTop:6}},
          React.createElement(Text,{style:[s.tCellB,{width:'3%',color:C.white}]},''),
          React.createElement(Text,{style:[s.tCellB,{width:'9%',color:C.white}]},''),
          React.createElement(Text,{style:[s.tCellB,{width:'20%',color:'rgba(255,255,255,0.6)'}]},''),
          React.createElement(Text,{style:[s.tCellB,{flex:1,color:C.white}]},'TOTALS'),
          React.createElement(Text,{style:[s.tCellB,{width:'9%',textAlign:'right',color:C.white}]},M((kpis.originalContract||0)+(kpis.changeOrders||0))),
          React.createElement(Text,{style:[s.tCellB,{width:'9%',textAlign:'right',color:C.white}]},M(kpis.income)),
          React.createElement(Text,{style:[s.tCellB,{width:'9%',textAlign:'right',color:'rgba(255,255,255,0.75)'}]},M(kpis.totalCost)),
          React.createElement(Text,{style:[s.tCellB,{width:'9%',textAlign:'right',color:kpis.profit>=0?'#86efac':'#fca5a5'}]},M(kpis.profit)),
          React.createElement(Text,{style:[s.tCellB,{width:'7%',textAlign:'right',color:'#86efac'}]},P(kpis.marginPct)),
          React.createElement(Text,{style:[s.tCellB,{width:'7%',textAlign:'right',color:'#fca5a5'}]},M(kpis.arOutstanding)),
        ),

        // Loss leaders section
        topLosers.length>0 && React.createElement(View,{style:{marginTop:16}},
          React.createElement(View,{style:s.sh},
            React.createElement(Text,{style:[s.shTxt,{color:C.red}]},'Loss Leaders — Bottom 5 Projects'),
            React.createElement(View,{style:[s.shLine,{backgroundColor:'#fecaca'}]}),
          ),
          React.createElement(View,{style:{backgroundColor:'#fff1f2',borderRadius:6,borderWidth:1,borderColor:'#fecaca'}},
            React.createElement(View,{style:[s.tHead,{backgroundColor:'#ef4444'}]},
              React.createElement(Text,{style:[s.tHeadTxt,{width:'10%'}]},'Proposal'),
              React.createElement(Text,{style:[s.tHeadTxt,{width:'22%'}]},'Customer'),
              React.createElement(Text,{style:[s.tHeadTxt,{flex:1}]},'Project'),
              React.createElement(Text,{style:[s.tHeadTxt,{width:'13%',textAlign:'right'}]},'Revenue'),
              React.createElement(Text,{style:[s.tHeadTxt,{width:'13%',textAlign:'right'}]},'Cost'),
              React.createElement(Text,{style:[s.tHeadTxt,{width:'13%',textAlign:'right'}]},'Loss'),
              React.createElement(Text,{style:[s.tHeadTxt,{width:'10%',textAlign:'right'}]},'Margin'),
            ),
            ...topLosers.map((p:any,i:number)=>
              React.createElement(View,{key:i,style:[s.tRow,{backgroundColor:i%2===0?'#fff1f2':'#fff'}]},
                React.createElement(Text,{style:[s.tCellB,{width:'10%',color:C.blue}]},p.proposalNumber||'—'),
                React.createElement(Text,{style:[s.tCell,{width:'22%'}]},(p.CompanyName||'').substring(0,22)),
                React.createElement(Text,{style:[s.tCell,{flex:1}]},(p.DisplayName||'').substring(0,28)),
                React.createElement(Text,{style:[s.tCell,{width:'13%',textAlign:'right'}]},M(p.calcIncome||0)),
                React.createElement(Text,{style:[s.tCell,{width:'13%',textAlign:'right'}]},M(p.calcCost||0)),
                React.createElement(Text,{style:[s.tCellB,{width:'13%',textAlign:'right',color:C.red}]},M(p.calcProfit||0)),
                React.createElement(Text,{style:[s.tCell,{width:'10%',textAlign:'right',color:C.red}]},P(p.calcMargin||0)),
              )
            ),
          ),
        ),
      ),

      React.createElement(View,{style:s.footer,fixed:true},
        React.createElement(Text,{style:s.footerTxt},'DEVCO CRM — Confidential Financial Report'),
        React.createElement(Text,{style:s.footerTxt,render:({pageNumber,totalPages}:any)=>`Page ${pageNumber} of ${totalPages}`}),
      ),
    ),
  );
}

export async function POST(req: NextRequest) {
  try {
    const { kpis, insights, top10, projects, periodLabel, projectCount } = await req.json();
    if (!kpis) return NextResponse.json({ error: 'Missing kpis' }, { status: 400 });

    const el = React.createElement(FinancialsPDF, {
      kpis,
      insights: insights || [],
      projects: (projects || top10 || []).map((p: any) => {
        const inc = p.income || p.calcIncome || 0;
        const cost = (p.qbCost||0)+(p.devcoCost||0) || p.calcCost || 0;
        const calcProfit = inc - cost;
        const calcMargin = inc > 0 ? (calcProfit / inc) * 100 : 0;
        return { ...p, calcIncome: inc, calcCost: cost, calcProfit, calcMargin, calcAR: p.ar || p.calcAR || 0 };
      }),
      periodLabel: periodLabel || 'All Time',
      projectCount: projectCount || 0,
    });

    const buffer = await renderToBuffer(el as any);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DEVCO-Financials-${(periodLabel||'report').replace(/\s+/g,'-')}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error('[PDF]', err);
    return NextResponse.json({ error: err?.message || 'PDF generation failed' }, { status: 500 });
  }
}
