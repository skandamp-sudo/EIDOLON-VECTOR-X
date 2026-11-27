import { useEffect, useState } from 'react'
import { fmt, labRequest } from './labTypes'
import type { Workspace } from './labTypes'

type Point = {method:string; requested:number; applied:number|null; gain:number|null; drift:number|null; cosine:number|null; ndcg:number|null; feasible:boolean; frontier:boolean; top:number[]}
const names:Record<string,string> = {original:'Original', naive:'Naive centroid', learned:'Learned ridge', locked:'Semantic Lock', ungoverned:'Lock without governor'}
export default function Frontier() {
  const [space,setSpace]=useState<Workspace|null>(null), [query,setQuery]=useState('forest canopy gathers distant light')
  const [direction,setDirection]=useState(0), [protection,setProtection]=useState(1)
  const [strength,setStrength]=useState(1.5), [drift,setDrift]=useState(.035), [cos,setCos]=useState(.65)
  const [labels,setLabels]=useState(''), [status,setStatus]=useState(''), [points,setPoints]=useState<Point[]>([])
  const [selected,select]=useState(0), [previous,setPrevious]=useState<number|null>(null), [retry,setRetry]=useState(0)
  useEffect(()=>{const c=new AbortController()
    labRequest<Workspace>('workspace',{},c.signal).then(w=>{if(!c.signal.aborted)setSpace(w)}).catch(e=>{if(!c.signal.aborted)setStatus(e.message)})
    return ()=>c.abort()
  },[retry])
  useEffect(()=>{if(!space)return
    const c=new AbortController()
    setPoints([]); select(0); setPrevious(null); setStatus('Computing operating points…')
    const timer=setTimeout(async()=>{
      try {
        const relevant=labels.trim()?labels.split(',').map(s=>{if(!/^\d+$/.test(s.trim()))throw Error('Use numeric document IDs separated by commas.');return Number(s)-1}):null
        const r=await labRequest<{points:Point[]}>('frontier',{text:query,target:space.presets[direction].direction,
          protected:[space.presets[protection].direction],strength,max_drift:drift,min_cosine:cos,relevant},c.signal)
        if(!c.signal.aborted){setPoints(r.points);setStatus('')}
      }catch(e){if(!c.signal.aborted)setStatus(e instanceof Error?e.message:'Calculation failed.')}
    },200)
    return ()=>{clearTimeout(timer);c.abort()}
  },[space,query,direction,protection,strength,drift,cos,labels,retry])
  const [rejected,setRejected]=useState(false)
  useEffect(()=>setRejected(false),[points])
  const feasible=points.map((p,i)=>({p,i})).filter(({p})=>p.feasible)
  const rec=feasible.filter(({p})=>p.frontier && (p.gain??0)>1e-9).sort((a,b)=>(b.p.ndcg??0)-(a.p.ndcg??0)||(b.p.gain??0)-(a.p.gain??0)||(a.p.drift??0)-(b.p.drift??0))[0]
  const current=points[selected]
  const maxD=Math.max(.01,...points.map(p=>p.drift??0)), minG=Math.min(0,...points.map(p=>p.gain??0)), maxG=Math.max(.01,...points.map(p=>p.gain??0))
  function choose(i:number){setPrevious(selected);select(i)}
  return <section className="panel foundry-panel"><h2>Semantic Pareto frontier</h2>
    <p>Live calibration index · 17 requested strengths per steering method from zero to the signed limit. Feasible nondominated points maximize signed gain, cosine and labeled nDCG while minimizing drift.</p>
    <div className="rank-pair"><label>Sweep query<input value={query} maxLength={400} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Relevant calibration point IDs<input value={labels} placeholder="Optional, e.g. 7,10" maxLength={90} onChange={e=>setLabels(e.target.value)}/></label></div>
    <div className="frontier-controls">{['Target concept','Protect concept'].map((label,i)=><label key={i}>{label}
      <select value={i?protection:direction} onChange={e=>(i?setProtection:setDirection)(Number(e.target.value))}>{space?.presets.map((p,j)=><option value={j} key={j}>{p.direction.name}</option>)}</select></label>)}
      <label>Sweep limit<input type="number" min="-2" max="2" step=".25" value={strength} onChange={e=>setStrength(Number(e.target.value))}/></label>
      <label>Drift limit<input type="number" min="0" max="2" step=".005" value={drift} onChange={e=>setDrift(Number(e.target.value))}/></label>
      <label>Cosine floor<input type="number" min="-1" max="1" step=".05" value={cos} onChange={e=>setCos(Number(e.target.value))}/></label></div>
    {status && <p role="status">{status} <button onClick={()=>setRetry(v=>v+1)}>Retry sweep</button></p>}
    {current && <><figure className="pareto-figure"><svg viewBox="0 0 600 190" role="img" aria-label="Candidate points by protected drift horizontally and signed target gain vertically">
      <path d="M45 12V161H583" fill="none" stroke="#65828c"/><text x="45" y="181">0 drift</text><text x="475" y="181">{fmt(maxD)} drift</text>
      <text x="1" y="21">{fmt(maxG)}</text><text x="1" y="158">{fmt(minG)}</text>
      {points.map((p,i)=>p.drift!=null&&p.gain!=null&&<circle key={i} cx={45+535*p.drift/maxD} cy={159-141*(p.gain-minG)/(maxG-minG)}
        r={selected===i?6:p.frontier?4:2.8} fill={p.feasible?(p.frontier?'#8be3d1':'#9caec4'):'#dd9b7d'} stroke={selected===i?'white':'none'}><title>{names[p.method]} · gain {fmt(p.gain)} · drift {fmt(p.drift)}</title></circle>)}</svg>
      <figcaption>{feasible.length} feasible of {points.length} · {points.filter(p=>p.frontier).length} nondominated candidates (ties retained). The chart shows two of the decision variables.</figcaption></figure>
      <label>Feasible operating point<select value={selected} onChange={e=>choose(Number(e.target.value))}>{feasible.map(({p,i})=><option key={i} value={i}>{names[p.method]} · requested {fmt(p.requested)} · gain {fmt(p.gain)}{p.frontier?' · frontier':''}</option>)}</select></label>
      <p>Applied {fmt(current.applied)} · gain {fmt(current.gain)} · drift {fmt(current.drift)} · cosine {fmt(current.cosine)} · nDCG@3 {fmt(current.ndcg)}.</p>
      <ol>{current.top.map(i=><li key={i}>{space?.documents[i]}</li>)}</ol><h3>SYMBIOSIS recommendation</h3>
      {rec ? <p>{names[rec.p.method]} at {fmt(rec.p.requested)} gives gain {fmt(rec.p.gain)} with drift {fmt(rec.p.drift)}. The recommendation prioritizes labeled retrieval, then gain, among feasible frontier points.</p>:<p>No sampled feasible configuration increases the signed target score.</p>}
      <div className="foundry-actions"><button disabled={!rec||rejected||rec.i===selected} onClick={()=>rec&&choose(rec.i)}>Approve recommendation</button>
        {rec&&<button onClick={()=>setRejected(!rejected)}>{rejected?'Restore recommendation':'Reject recommendation'}</button>}
        {rejected&&<span role="status">Recommendation rejected. Current setting retained.</span>}
        <button disabled={previous===null} onClick={()=>{if(previous!==null)select(previous);setPrevious(null)}}>Undo selection</button></div>
      <details><summary>Inspect all candidates</summary><div className="preview-scroll"><table><thead><tr>{['Method','Requested','Applied','Gain','Drift','Cosine','nDCG','Status'].map(x=><th key={x}>{x}</th>)}</tr></thead>
      <tbody>{points.map((p,i)=><tr key={i}><th>{names[p.method]}</th>{[p.requested,p.applied,p.gain,p.drift,p.cosine,p.ndcg].map((v,j)=><td key={j}>{fmt(v)}</td>)}<td>{p.frontier?'Frontier':p.feasible?'Feasible':'Infeasible'}</td></tr>)}</tbody></table></div></details></>}
  </section>
}
