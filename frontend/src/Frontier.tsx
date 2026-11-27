import { useEffect, useRef, useState } from 'react'
import {takeReview,sameDirection} from './reviewDraft'
import { exportEvidence,record } from './convergence/session'
import { fmt, labRequest } from './labTypes'
import type { Workspace } from './labTypes'

type Point = {method:string; requested:number; applied:number|null; gain:number|null; drift:number|null; cosine:number|null; ndcg:number|null; feasible:boolean; frontier:boolean; top:number[]}
const names:Record<string,string> = {original:'Original', naive:'Naive centroid', learned:'Learned ridge', locked:'Semantic Lock', ungoverned:'Lock without governor'}
export default function Frontier() {
  const [draft]=useState(takeReview)
  const initialized=useRef(false)
  const [space,setSpace]=useState<Workspace|null>(null), [query,setQuery]=useState('forest canopy gathers distant light')
  const [direction,setDirection]=useState(0), [protection,setProtection]=useState(1)
  const [strength,setStrength]=useState(1.5), [drift,setDrift]=useState(.035), [cos,setCos]=useState(.65)
  const [labels,setLabels]=useState(''), [status,setStatus]=useState(''), [points,setPoints]=useState<Point[]>([])
  const [selected,select]=useState(0), [previous,setPrevious]=useState<number|null>(null), [retry,setRetry]=useState(0)
  const [paused,pause]=useState(false),[mode,modeTo]=useState('Approval required'),[goal,goalTo]=useState('Maximize gain')
  const [timeline,setTimeline]=useState<{time:number;action:string}[]>([]),[rating,rate]=useState(''),[trust,setTrust]=useState('')
  const [began]=useState(()=>Date.now()),[finished,finish]=useState<number|null>(null)
  const [formRevision,submitForm]=useState(0)
  const sequential=mode==='Sequential form'
  const sweepKey=JSON.stringify([query,direction,protection,strength,drift,cos,labels])
  const approvedForm=useRef('')
  const automatic=useRef<Point[]|null>(null)
  function log(action:string){setTimeline(v=>[...v.slice(-127),{time:Date.now(),action}])}
  useEffect(()=>{const c=new AbortController()
    labRequest<Workspace>('workspace',{},c.signal).then(w=>{if(c.signal.aborted)return
      if(draft&&!initialized.current){
        const t=w.presets.findIndex(p=>sameDirection(p.direction,draft.target)),b=w.presets.findIndex(p=>sameDirection(p.direction,draft.protection))
        if(w.model_id!==draft.model||t<0||b<0)throw Error('This review requires the original calibration model and supported preset directions. Return to the debugger to select a compatible task.')
        setQuery(draft.query);setLabels(draft.relevant.join(','));setDirection(t);setProtection(b)
        setStrength(draft.strength);setDrift(draft.drift);setCos(draft.cosine);initialized.current=true
      }
      setSpace(w)}).catch(e=>{if(!c.signal.aborted)setStatus(e.message)})
    return ()=>c.abort()
  },[retry])
  useEffect(()=>{if(!space||paused)return
    if(!query.trim()){setPoints([]);setStatus('Enter a nonempty sweep query.');return}
    if(sequential&&approvedForm.current!==sweepKey){setPoints([]);setStatus('Edit constraints and submit the form.');return}
    const c=new AbortController()
    log('Sweep requested · target '+direction+', protect '+protection+', strength '+strength+', drift '+drift+', cosine '+cos);setPoints([]); select(0); setPrevious(null); setStatus('Computing operating points…')
    const timer=setTimeout(async()=>{
      try {
        const relevant=labels.trim()?labels.split(',').map(s=>{if(!/^\d+$/.test(s.trim()))throw Error('Use numeric document IDs separated by commas.');return Number(s)-1}):null
        const r=await labRequest<{points:Point[];model_id:string}>('frontier',{text:query,target:space.presets[direction].direction,
          protected:[space.presets[protection].direction],strength,max_drift:drift,min_cosine:cos,relevant},c.signal)
        if(r.model_id!==space.model_id)throw Error('Model identity changed. Retry the sweep to reload the workspace.')
        if(!c.signal.aborted){setPoints(r.points);setStatus('')}
      }catch(e){if(!c.signal.aborted)setStatus(e instanceof Error?e.message:'Calculation failed.')}
    },200)
    return ()=>{clearTimeout(timer);c.abort()}
  },[space,query,direction,protection,strength,drift,cos,labels,retry,paused,sequential,sweepKey,formRevision])
  const [rejected,setRejected]=useState(false)
  useEffect(()=>setRejected(false),[points])
  const feasible=points.map((p,i)=>({p,i})).filter(({p})=>p.feasible)
  const rec=feasible.filter(({p})=>p.frontier && (p.gain??0)>1e-9).sort((a,b)=>(goal==='Minimize drift'?(a.p.drift??0)-(b.p.drift??0):(b.p.gain??0)-(a.p.gain??0))||(b.p.ndcg??0)-(a.p.ndcg??0)||(b.p.gain??0)-(a.p.gain??0)||(a.p.drift??0)-(b.p.drift??0))[0]
  useEffect(()=>{
    if(rec&&!paused&&mode!=='Sequential form')log('Proposed '+rec.p.method+' at '+fmt(rec.p.applied)+' · gain '+fmt(rec.p.gain)+' · drift '+fmt(rec.p.drift))
  },[points,goal])
  useEffect(()=>{
    if(mode==='Automatic preview'&&!paused&&rec&&!rejected&&automatic.current!==points){
      automatic.current=points;setPrevious(selected);select(rec.i);log('Automatic reversible preview '+rec.i)
    }
  },[mode,paused,rec,points,rejected,selected])
  const current=points[selected]
  const maxD=Math.max(.01,...points.map(p=>p.drift??0)), minG=Math.min(0,...points.map(p=>p.gain??0)), maxG=Math.max(.01,...points.map(p=>p.gain??0))
  function choose(i:number){if(paused)return;setPrevious(selected);select(i);log('Selected feasible point '+i)}
  return <section className="panel foundry-panel"><p className="kicker">{paused?'Paused':mode}</p><h2>Semantic Pareto frontier</h2>{draft&&<p className="studio-hash">Explicit local handoff from the Retrieval Debugger · dataset {draft.dataset} · model {draft.model}. The frontier recalculates alternatives for this calibration task.</p>}
    <div className="rank-pair"><label>Agent interaction mode<select value={mode} onChange={e=>{modeTo(e.target.value);log('Mode '+e.target.value)}}>{['Approval required','Suggestion only','Automatic preview','Sequential form'].map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Task objective<select value={goal} disabled={paused} onChange={e=>{goalTo(e.target.value);log('Goal changed')}}><option>Maximize gain</option><option>Minimize drift</option></select></label></div>
    {current && <figure className="pareto-figure"><svg viewBox="0 0 600 190" role="img" aria-label="Candidate points by protected drift horizontally and signed target gain vertically">
      <path d="M45 12V161H583" fill="none" stroke="#65828c"/><text x="45" y="181">0 drift</text><text x="475" y="181">{fmt(maxD)} drift</text>
      <text x="1" y="21">{fmt(maxG)}</text><text x="1" y="158">{fmt(minG)}</text>
      {points.map((p,i)=>p.drift!=null&&p.gain!=null&&<circle key={i} cx={45+535*p.drift/maxD} cy={159-141*(p.gain-minG)/(maxG-minG)}
        r={selected===i?6:p.frontier?4:2.8} fill={p.feasible?(p.frontier?'#8be3d1':'#9caec4'):'#dd9b7d'} stroke={selected===i?'white':'none'}><title>{names[p.method]} · gain {fmt(p.gain)} · drift {fmt(p.drift)}</title></circle>)}</svg>
      <figcaption>{feasible.length} feasible of {points.length} · {points.filter(p=>p.frontier).length} nondominated candidates (ties retained). The chart shows two of the decision variables.</figcaption></figure>}
    <p>Algorithmic frontier search. Automatic mode may select one reversible local preview per sweep. Constraints apply to the current model and index.</p>
    <button onClick={()=>{pause(!paused);log(paused?'Resumed':'Paused')}}>{paused?'Resume agent':'Pause agent'}</button>
    <button onClick={()=>{pause(true);setPoints([]);setPrevious(null);setStatus('Pending sweep aborted.');log('Aborted')}}>Abort pending action</button>
    <details><summary>Decision timeline and session measures</summary><ol className="decision-log">{timeline.map((t,i)=><li key={i}>{new Date(t.time).toLocaleTimeString()} · {t.action}</li>)}</ol>
    <label>Perceived control (1–7)<input type="number" min="1" max="7" value={rating} onChange={e=>rate(e.target.value)}/></label>
    <label>Trust (1–7)<input type="number" min="1" max="7" value={trust} onChange={e=>setTrust(e.target.value)}/></label>
    <button disabled={!current||finished!==null} onClick={()=>{finish(Date.now());log('Task completed by operator')}}>Mark steering task complete</button>
    <button onClick={()=>exportEvidence('agent-session',{mode,goal,completed:finished!==null,completion_ms:finished===null?null:finished-began,retained_events:timeline.length,timeline,control:+rating>=1&&+rating<=7?+rating:null,trust:+trust>=1&&+trust<=7?+trust:null})}>Export interaction record</button></details>
    <p>Live calibration index · 17 requested strengths per steering method from zero to the signed limit. Feasible nondominated points maximize signed gain, cosine and labeled nDCG while minimizing drift.</p>
    <fieldset disabled={paused}><div className="rank-pair"><label>Sweep query<input value={query} maxLength={400} onChange={e=>setQuery(e.target.value)}/></label>
    <label>Relevant calibration point IDs<input value={labels} placeholder="Optional, e.g. 7,10" maxLength={90} onChange={e=>setLabels(e.target.value)}/></label></div>
    <div className="frontier-controls">{['Target concept','Protect concept'].map((label,i)=><label key={i}>{label}
      <select value={i?protection:direction} onChange={e=>(i?setProtection:setDirection)(Number(e.target.value))}>{space?.presets.map((p,j)=><option value={j} key={j}>{p.direction.name}</option>)}</select></label>)}
      <label>Sweep limit<input type="number" min="-2" max="2" step=".25" value={strength} onChange={e=>setStrength(Number(e.target.value))}/></label>
      <label>Drift limit<input type="number" min="0" max="2" step=".005" value={drift} onChange={e=>setDrift(Number(e.target.value))}/></label>
      <label>Cosine floor<input type="number" min="-1" max="1" step=".05" value={cos} onChange={e=>setCos(Number(e.target.value))}/></label></div></fieldset>
    {sequential&&<button disabled={paused} onClick={()=>{approvedForm.current=sweepKey;submitForm(n=>n+1);log('Submitted baseline form')}}>Calculate form settings</button>}
    {status && <p role="status">{status} <button onClick={()=>setRetry(v=>v+1)}>Retry sweep</button></p>}
    {current && <>
      <label>Feasible operating point<select disabled={paused} value={selected} onChange={e=>choose(Number(e.target.value))}>{feasible.map(({p,i})=><option key={i} value={i}>{names[p.method]} · requested {fmt(p.requested)} · gain {fmt(p.gain)}{p.frontier?' · frontier':''}</option>)}</select></label>
      <p>Applied {fmt(current.applied)} · gain {fmt(current.gain)} · drift {fmt(current.drift)} · cosine {fmt(current.cosine)} · nDCG@3 {fmt(current.ndcg)}.</p>
      <ol>{current.top.map(i=><li key={i}>{space?.documents[i]}</li>)}</ol><h3>SYMBIOSIS recommendation</h3>
      {mode==='Sequential form'?<p>Choose a feasible setting manually in this baseline.</p>:rec ? <p>{names[rec.p.method]} at {fmt(rec.p.requested)} gives gain {fmt(rec.p.gain)} with drift {fmt(rec.p.drift)}. Objective: {goal}. Ties favor labeled retrieval, then gain, among feasible frontier points.</p>:<p>No sampled feasible configuration increases the signed target score.</p>}
      {rec&&mode!=='Sequential form'&&<div className="preview-scroll"><table><caption>Current selection and agent proposal</caption>
      <thead><tr><th>Measurement</th><th>Current</th><th>Proposed</th><th>Change</th></tr></thead><tbody>
      {([['gain','Signed target gain'],['drift','Protected drift'],['cosine','Retained cosine'],['ndcg','Labeled nDCG@3']] as const).map(([key,label])=>{
        const before=current[key],after=rec.p[key]
        return <tr key={key}><th>{label}</th><td>{fmt(before)}</td><td>{fmt(after)}</td><td>{fmt(before==null||after==null?null:after-before)}</td></tr>
      })}</tbody></table></div>}
      <div className="foundry-actions"><button disabled={paused||mode==='Suggestion only'||mode==='Sequential form'||!rec||rejected||rec.i===selected} onClick={()=>{if(rec){choose(rec.i);log('Approved');record('SYMBIOSIS','approve')}}}>Approve recommendation</button>
        {mode!=='Sequential form'&&rec&&<button disabled={paused} onClick={()=>{setRejected(!rejected);log(rejected?'Restored':'Rejected');record('SYMBIOSIS','reject')}}>{rejected?'Restore recommendation':'Reject recommendation'}</button>}
        {rejected&&<span role="status">Recommendation rejected. Current setting retained.</span>}
        <button disabled={previous===null} onClick={()=>{if(previous!==null)select(previous);setPrevious(null);log('Rolled back');record('SYMBIOSIS','undo')}}>Undo selection</button></div>
      <details><summary>Inspect all candidates</summary><div className="preview-scroll"><table><thead><tr>{['Method','Requested','Applied','Gain','Drift','Cosine','nDCG','Status'].map(x=><th key={x}>{x}</th>)}</tr></thead>
      <tbody>{points.map((p,i)=><tr key={i}><th>{names[p.method]}</th>{[p.requested,p.applied,p.gain,p.drift,p.cosine,p.ndcg].map((v,j)=><td key={j}>{fmt(v)}</td>)}<td>{p.frontier?'Frontier':p.feasible?'Feasible':'Infeasible'}</td></tr>)}</tbody></table></div></details></>}
  </section>
}
