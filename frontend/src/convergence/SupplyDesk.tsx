import {useState} from 'react'
import {fixture,replay} from './inventoryLedger'
import type {Entry,Kind} from './inventoryLedger'
import {exportEvidence,record} from './session'
export default function Supply(){
 const [log,setLog]=useState<Entry[]>(fixture),[day,setDay]=useState(1),[error,report]=useState(''),[role,setRole]=useState('Planner'),[amount,modify]=useState<Record<string,string>>({}),[raw,edit]=useState('')
 const state=replay(log,day)
 const append=(e:Entry)=>{try{const next=[...log,e];replay(next,day);setLog(next);report('');modify({});return true}catch(err){report((err as Error).message);return false}}
 const event=(kind:Kind,qty:number,ref='',due=day,sku='membrane')=>{let n=log.length+1;while(log.some(e=>e.id==='E'+n))n++;return {id:'E'+n,day,kind,sku,qty,ref,due}}
 return <section className="panel foundry-panel"><h2>SUPPLY planning desk</h2><p>Simulated days from scenario start · one warehouse · first-booked orders consume physical stock, then dated incoming lots. Ship dates assume overdue arrivals can arrive today. Shortages without an arrival have no projected date.</p>
 <label>Briefing<select value={role} onChange={e=>setRole(e.target.value)}><option>Planner</option><option>Manager</option></select></label><p role="status">Day {day} · feed {state.stale?'stale':'current'} · {state.rows.filter(r=>r.risk).length} at-risk orders · {state.proposals.length} open proposals</p>
 {state.balances.map(b=><p key={b.sku}>{b.sku}: {b.onHand} on hand + {b.incoming} incoming − {b.allocated} allocated = {b.net} available across all dates.</p>)}
 {state.groups.filter(g=>g.lines.length>1).map(g=><p key={g.id}>Order {g.id} · material lines {g.lines.join(', ')} · complete shipment day {g.ship??'unknown'} · {g.risk?'at risk':'on schedule'}</p>)}
 {role==='Planner'&&state.rows.map(o=><p key={o.id}>{o.id} · CRD {o.due} · projected {o.ship??'unknown'} · {o.shortByDate} units short at CRD · allocation {o.allocation.map(a=>a.source+' × '+a.qty).join(', ')||'none'}</p>)}
 <h3>Scenario controls</h3><div className="foundry-actions"><button onClick={()=>append(event('delivery',0,'P1',day+7))}>Delay supplier</button><button onClick={()=>append(event('demand',state.rows[0].qty+4,'O1'))}>Spike demand</button><button onClick={()=>append(event('adjustment',-1))}>Stock discrepancy</button><button onClick={()=>append(log[log.length-1])}>Replay duplicate</button><button disabled={day>9996} onClick={()=>setDay(day+3)}>Interrupt feed for 3 days</button></div>
 <details><summary>Append an event</summary><p>Use the seven fields shown in the audit log. Link receipts and supplier updates to a purchase ID. For multi-material orders, put the same group ID in each order line’s ref field and use the same CRD. Demand revisions reference a line ID. Approval decisions require the review controls below.</p>
 <textarea aria-label="Inventory event JSON" maxLength={2048} value={raw} onChange={e=>edit(e.target.value)}/><button onClick={()=>{try{const e=JSON.parse(raw);if(['approve','reject'].includes(e?.kind))throw Error('Use proposal review.');append(e)}catch(err){report((err as Error).message)}}}>Append event</button></details>
 {state.proposals.map(p=><article key={p.order}><h3>Proposal for {p.order}</h3><p>Purchase {p.qty} {p.sku} units based on events {p.evidence.join(', ')}. Proposed arrival day {day+1} is a scenario assumption.</p>
 <label>Approved quantity<input type="number" min="1" max={p.qty} value={amount[p.order]??p.qty} onChange={e=>modify({...amount,[p.order]:e.target.value})}/></label>
 <button onClick={()=>{if(append(event('approve',Number(amount[p.order]??p.qty),p.order,day+1,p.sku)))record('SUPPLY','approve')}}>Approve simulated PO</button><button onClick={()=>{if(append(event('reject',0,p.order,day,p.sku)))record('SUPPLY','reject')}}>Reject proposal</button></article>)}
 <p role="alert">{error}</p><details><summary>Replayable audit log</summary><pre style={{whiteSpace:'pre-wrap'}}>{log.map(e=>JSON.stringify(e)).join('\n')}</pre></details><button onClick={()=>exportEvidence('supply-simulation',{day,log,...state})}>Export simulation</button></section>
}
