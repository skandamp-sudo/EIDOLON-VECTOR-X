import {useState} from 'react'
import GraphCanvas,{type GraphEdge,type GraphNode} from '../GraphCanvas'
import {fixture,replay,type Entry} from './inventoryLedger'
import {tourAction} from '../tourState'

export default function StockFlow({state,day,log}:{state:ReturnType<typeof replay>;day:number;log:Entry[]}){
 const [chosen,choose]=useState('O1'),[date,setDate]=useState<number|null>(null)
 const order=state.rows.find(r=>r.id===chosen)??state.rows[0]
 const base=replay(fixture,day),before=base.rows.find(r=>r.id===order?.id)
 const delay=log.filter(e=>e.kind==='delivery').at(-1)
 const incoming=log.filter(e=>e.kind==='purchase'||e.kind==='approve').map(e=>({day:log.filter(v=>v.kind==='delivery'&&v.ref===e.id).at(-1)?.due??e.due,label:e.id+' · expected arrival'}))
 const timeline=[...incoming,...state.rows.flatMap(o=>[{day:o.due,label:o.id+' · CRD'},...(o.ship===null?[]:[{day:o.ship,label:o.id+' · projected shipment'}])])].sort((a,b)=>a.day-b.day)
 const days=[...new Set(timeline.map(x=>x.day))]
 const sources=order?.allocation??[], nodes:GraphNode[]=order?[...sources.map((a,i)=>({title:a.source,x:86,y:65+i*88,kind:'store' as const})),{title:order.sku,x:299,y:106},{title:'Order '+order.id,x:517,y:106,kind:'end'}]:[]
 const edges:GraphEdge[]=order?[...sources.map((a,i)=>({src:i,dst:sources.length,label:a.qty+' units',accent:a.source===delay?.ref})),{src:sources.length,dst:sources.length+1,label:(order.qty-order.missing)+' allocated'}]:[]
 const [inspected,setInspected]=useState<number|null>(null)
 const oldLot=fixture.find(e=>e.id===delay?.ref)
 return <><div className="stock-metrics">{[['At-risk orders',state.groups.filter(g=>g.risk).length],['Units unfilled',state.rows.reduce((n,r)=>n+r.missing,0)],['Purchase proposals',state.proposals.length],['Available on hand',state.balances.reduce((n,b)=>n+b.onHand,0)]].map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>
 <div className="logistics-grid"><section className="flow-list"><h3>Allocation flow</h3><div className="pill-row" data-tour="supply-order">{state.rows.map(o=><button aria-pressed={order?.id===o.id} key={o.id} onClick={()=>{choose(o.id);setInspected(null);tourAction('supply-order')}}>{o.id} · {o.risk?'At risk':'On schedule'}</button>)}</div>
 <GraphCanvas title="Source → material → order" nodes={nodes} edges={edges} selected={inspected??nodes.length-1} onSelect={setInspected} color="#f1bc6a"/>{order&&<p>{inspected!=null&&nodes[inspected]?nodes[inspected].title+' · ':''}{order.qty-order.missing} of {order.qty} requested units allocated. {order.shortByDate} short on day {order.due}.</p>}</section>
 <section className="shipment-note" data-tour="supply-impact"><small>Order inspection</small><h3>{order?.id} shipment</h3><div className="date-shift"><span>Starting day<b>{before?.ship??'Unknown'}</b></span><span>Projected day<b>{order?.ship??'Unknown'}</b></span></div>{delay&&<p>Lot {delay.ref} moved from {oldLot?'day '+oldLot.due:'its previous date'} to day {delay.due}. Orders using this lot: {state.rows.filter(r=>r.allocation.some(a=>a.source===delay.ref)).map(r=>r.id).join(', ')||'none'}.</p>}<p>{order?.missing?'Some units have no available source. A complete shipment date is unavailable.':order?.risk?'A required lot arrives after the customer’s request date.':'Allocated units arrive by the customer’s request date.'}</p></section></div>
 <section className="timeline"><h3>Delivery timeline</h3><div className="pill-row">{days.map(d=><button key={d} aria-pressed={date===d} onClick={()=>setDate(date===d?null:d)}>Day {d}</button>)}</div><ol className="day-list">{timeline.filter(e=>date===null||!days.includes(date)||date===e.day).map((e,i)=><li key={i}><b>Day {e.day}</b><span>{e.label}</span></li>)}</ol></section></>
}
