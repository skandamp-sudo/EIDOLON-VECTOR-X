import type {replay,Entry} from './inventoryLedger'

export default function StockFlow({state,day,log}:{state:ReturnType<typeof replay>;day:number;log:Entry[]}){
  const sums=state.balances.reduce((total,b)=>({stock:total.stock+b.onHand,incoming:total.incoming+b.incoming}),{stock:0,incoming:0})
  const metrics=[['Orders at risk',state.groups.filter(g=>g.risk).length],['Missing units',state.rows.reduce((n,r)=>n+r.missing,0)],['Open proposals',state.proposals.length],['On hand',sums.stock],['Incoming',sums.incoming],['Feed',state.stale?'Stale':'Current']]
  return <><div className="foundry-stats stock-metrics">{metrics.map(([label,value])=><span key={label}>{label}<b>{value}</b></span>)}</div>
  <div className="stock-grid"><section><h3>Allocation flow</h3><p>Committed quantities by source and order line.</p>
    <div className="flow-list">{state.rows.map(o=><figure key={o.id}><figcaption>{o.id} · {o.sku} <strong>{o.qty} requested</strong></figcaption>
      <svg viewBox="0 0 420 12" preserveAspectRatio="none" role="img" aria-label={o.allocation.map(a=>a.source+': '+a.qty).concat('Missing: '+o.missing).join(', ')}>
      {o.allocation.map((a,i)=><rect key={a.source} x={420*o.allocation.slice(0,i).reduce((n,v)=>n+v.qty,0)/o.qty} width={420*a.qty/o.qty} height="12" fill={a.source==='on-hand'?'#2dd4bf':'#60a5fa'}/>)}{o.missing>0&&<rect x={420*(1-o.missing/o.qty)} width={420*o.missing/o.qty} height="12" fill="#fbbf24"/>}</svg>
      <small>{o.allocation.map(a=>a.source+' → '+o.id+' × '+a.qty).join(' · ')}{o.missing>0&&' · Short '+o.missing}</small></figure>)}</div></section>
    <section><h3>Delivery timeline</h3><p>Simulated day {day}. CRD is the customer request date.</p><ol className="day-list">{[...log.filter(e=>e.kind==='purchase'||e.kind==='approve').map(e=>({day:log.filter(v=>v.kind==='delivery'&&v.ref===e.id).at(-1)?.due??e.due,label:e.id+' · expected arrival'})),...state.rows.flatMap(o=>[{day:o.due,label:o.id+' · CRD'},...(o.ship===null?[]:[{day:o.ship,label:o.id+' · projected shipment'}])])].sort((a,b)=>a.day-b.day).map((e,i)=><li key={i}><b>Day {e.day}</b>{e.label}</li>)}</ol>{state.rows.filter(o=>o.ship===null).map(o=><p key={o.id}>{o.id} · shipment date unknown</p>)}</section></div></>
}
