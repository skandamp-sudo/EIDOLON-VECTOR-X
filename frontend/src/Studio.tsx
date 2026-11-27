import {useEffect, useMemo, useRef, useState} from 'react'
import {downloadFile} from './foundryData'
import {fmt, labRequest} from './labTypes'
import type {Direction, Workspace} from './labTypes'
import {savedDirections} from './Intelligence'
import {localRequest} from './localRequest'
import {hosted} from './apiOrigin'

const methods = {bm25:'BM25',dense:'Dense cosine',fusion:'Hybrid rank fusion',unconstrained:'Unconstrained steering',locked:'Constrained steering',spherical:'Protected-sphere rotation'}
type Method = keyof typeof methods
const keys = Object.keys(methods) as Method[]
const encoders={focus:'FOCUS 8D · saved directions',legacy8:'Calibration LSA · 8D',legacy16:'Calibration LSA · 16D',expanded:'Expanded LSA · 128D',minilm:'Quantized MiniLM · 384D'}
type Encoder = keyof typeof encoders
type Basis = {model_id:string;dimensions:number;documents:string[];axes:string[]}
type Doc = {id:number; text:string}
export type StudioCorpus = {documents:Doc[]; fileHash:string; column:string}
type Task = {query:string; relevant:number[]}
type Settings = {baseline:Method; candidate:Method; k:number; strength:number; max_drift:number; min_cosine:number;
  min_recall:number; min_ndcg:number; block_regressions:boolean; block_abstentions:boolean; require_geometry:boolean}
type Result = {order:number[]; recall:number|null; ndcg:number|null; missed:number[]; abstained:boolean;
  geometry:{drift:number; cosine:number; applied:number; target_gain:number; signed_gain?:number; violated:boolean}|null}
type Outcome = {query:string; relevant:number[]; change:string; methods:Record<Method,Result>; delta:{recall:number|null; ndcg:number|null};
  gate_reasons:string[]; governor_reason:string|null; sphere_reason?:string|null}
type Report = {protocol:string; encoder?:string; dimensions?:number; gate:string; model_id:string; dataset_sha256:string; represented:number; documents:number;
  changes:Record<string,number>; tasks:Outcome[]; replay:{settings:Settings}; summary:Record<Method,{recall:number|null;ndcg:number|null;abstentions:number;violations:number|null;geometry_measured:number}>}
const defaults:Settings={baseline:'dense',candidate:'locked',k:3,strength:1,max_drift:.05,min_cosine:.8,min_recall:0,min_ndcg:0,
  block_regressions:true,block_abstentions:true,require_geometry:true}

function Outcomes({report,docs}:{report:Report;docs:Doc[]}) {
  const [index,select]=useState(0)
  const task=report.tasks[index],cfg=report.replay.settings
  const before=task.methods[cfg.baseline], after=task.methods[cfg.candidate]
  const ranked=(which:Result)=>new Map(which.order.map((id,i)=>[id,i+1]))
  const old=ranked(before),current=ranked(after), texts=new Map(docs.map(d=>[d.id,d.text]))
  const ids=[...new Set([...after.order.slice(0,cfg.k),...before.order.slice(0,cfg.k),...task.relevant])]
  const nonNull=(n:number|null)=>n==null?'Unlabeled':fmt(n)
  return <section className="panel foundry-panel"><p className="kicker">Engineering verification · operator judgments</p>
    <h2>Release gate · {report.gate}</h2>
    <p>{report.tasks.filter(t=>t.gate_reasons.length).length} of {report.tasks.length} tasks blocked · {report.represented} of {report.documents} documents have dense vectors.</p>
    <p>Task outcomes · {Object.entries(report.changes).map(([status,count])=>count+' '+status).join(' · ')}</p>
    <div className="preview-scroll"><table><caption>Mean scores across labeled tasks at K = {cfg.k}</caption><thead><tr>{['Method','Recall','nDCG','Abstentions','Geometry violations / measured'].map(t=><th key={t}>{t}</th>)}</tr></thead>
    <tbody>{keys.filter(key=>report.summary[key]).map(key=>{const s=report.summary[key];return <tr key={key}><th>{methods[key]}</th><td>{nonNull(s.recall)}</td><td>{nonNull(s.ndcg)}</td><td>{s.abstentions}</td><td>{s.violations===null?'Unmeasured':s.violations+' / '+s.geometry_measured}</td></tr>})}</tbody></table></div>
    <label>Inspect task<select value={index} onChange={e=>select(+e.target.value)}>{report.tasks.map((t,i)=><option key={i} value={i}>{i+1}. {t.query}</option>)}</select></label>
    <p><strong>{task.gate_reasons.length?'BLOCK · '+task.gate_reasons.join(' · '):'PASS'}</strong></p>
    <p>{methods[cfg.baseline]} → {methods[cfg.candidate]} · Recall change {nonNull(task.delta.recall)} · nDCG change {nonNull(task.delta.ndcg)}. Missed expected IDs at K: {task.relevant.length?(after.missed.join(', ')||'None'):'Awaiting labels'}.</p>
    <div className="preview-scroll"><table><caption>Top results and every expected document. Rank 1 is best.</caption><thead><tr>{['Source ID and text','Expected','Baseline rank','Candidate rank','Places gained'].map(t=><th key={t}>{t}</th>)}</tr></thead>
    <tbody>{ids.map(id=><tr key={id}><td>#{id} · {texts.get(id)}</td><td>{task.relevant.includes(id)?'Yes':'Unjudged'}</td><td>{old.get(id)??'Unranked'}</td><td>{current.get(id)??'Unranked'}</td><td>{old.has(id)&&current.has(id)?old.get(id)!-current.get(id)!:'—'}</td></tr>)}</tbody></table></div>
    {after.geometry&&<p>Target-axis change {fmt(after.geometry.target_gain)}{after.geometry.signed_gain!=null && <> · gain in requested direction {fmt(after.geometry.signed_gain)}</>} · protected drift {fmt(after.geometry.drift)} · retained cosine {fmt(after.geometry.cosine)} · {cfg.candidate==='spherical'?'rotation (radians)':'applied strength'} {fmt(after.geometry.applied)}.</p>}
    {task.sphere_reason&&<p>Protected sphere · {task.sphere_reason}</p>}
    {task.governor_reason&&<p>Constrained method · {task.governor_reason}</p>}
    <details><summary>How to read the measurements</summary><dl>
      <dt>Recall at K</dt><dd>Fraction of expected documents present in the first K results.</dd>
      <dt>nDCG at K</dt><dd>Discounts relevant documents at lower ranks and scales by the best ordering of those labels.</dd>
      <dt>Protected drift</dt><dd>Largest absolute change along a protected model direction. The release gate uses the configured limit.</dd>
      <dt>Retained cosine</dt><dd>Dot product of original and transformed unit vectors in the full model space.</dd>
      <dt>Signed gain</dt><dd>Change along the target direction, multiplied by the sign of requested strength. Positive values indicate movement in the requested direction.</dd>
      <dt>Abstention</dt><dd>The method returned no ranked documents. Unlabeled tasks have unavailable relevance scores.</dd>
    </dl></details>
    <details><summary>Report identity</summary><p className="studio-hash">Dataset SHA-256 · {report.dataset_sha256}<br/>Model · {report.encoder??'calibration LSA'} · {report.dimensions??8}D · {report.model_id}<br/>Protocol · {report.protocol}</p></details>
  </section>
}

export default function Studio({modelId, imported}:{modelId:string; imported?:StudioCorpus}) {
  const [encoder,chooseEncoder]=useState<Encoder>('focus')
  const [axisNames,setAxisNames]=useState<string[]>([])
  const [workspace,load]=useState<Pick<Workspace,'model_id'|'documents'>|null>(null),[attempt,retry]=useState(0)
  const [directions,options]=useState<Direction[]>([]),[target,aim]=useState('Ocean affinity'),[protect,guard]=useState('Botanical affinity')
  const [tasks,setTasks]=useState<Task[]>([imported?{query:'',relevant:[]}:{query:'telescope light',relevant:[6]}])
  const [which,select]=useState(0),[filter,search]=useState(''),[cfg,config]=useState(defaults)
  const [report,show]=useState<Report|null>(null),[error,notice]=useState(''),[busy,working]=useState(false)
  const wireReport=useRef<string | null>(null)
  const active=useRef<AbortController|null>(null)
  useEffect(()=>{
    const controller=new AbortController()
    load(null);show(null);notice('')
    const lookup=encoder==='focus' ? labRequest<Workspace>('workspace',{},controller.signal) :
      localRequest<Basis>('research-v2/debug-workspace',JSON.stringify({encoder}),controller.signal)
    lookup.then(w=>{
      if(controller.signal.aborted)return
      if('axes' in w){
        setAxisNames(w.axes);options([]);load(w);return
      }
      if(controller.signal.aborted)return
      if(w.model_id!==modelId)throw Error('The workspace model differs from the runtime.')
      const presets=w.presets.map(p=>p.direction)
      const custom=hosted?[]:savedDirections(modelId).filter(d=>!presets.some(p=>p.name===d.name))
      options([...presets,...custom]);setAxisNames([...presets,...custom].map(d=>d.name));load(w)
    }).catch(e=>{if(!controller.signal.aborted)notice(e.message)})
    return ()=>{controller.abort();active.current?.abort()}
  },[modelId,attempt,encoder])
  const docs=useMemo(()=>imported?.documents??workspace?.documents.map((text,i)=>({id:i+1,text}))??[],[imported,workspace])
  const task=tasks[which]
  function edit(next:Task){setTasks(tasks.map((t,i)=>i===which?next:t));show(null)}
  function setting<K extends keyof Settings>(key:K,value:Settings[K]){config({...cfg,[key]:value});show(null)}
  async function run(){
    if(!workspace||active.current)return
    const controller=new AbortController();active.current=controller;working(true);notice('');show(null)
    try{
      wireReport.current=null
      const result=encoder!=='focus' ? await localRequest<Report>('research-v2/debug',JSON.stringify({encoder,
        model_id:workspace.model_id,documents:imported?.documents??null,tasks,target,protection:protect,settings:cfg}),controller.signal,raw=>{wireReport.current=raw.trim()}) :
        await labRequest<Report>('debug',{model_id:modelId,documents:imported?.documents??null,tasks,
        target:directions.find(d=>d.name===target),protection:directions.find(d=>d.name===protect),settings:cfg},controller.signal)
      if(result.model_id!==workspace.model_id||result.protocol!==(encoder==='focus'?'focus-retrieval-v1':'ascension-retrieval-v1')||result.documents!==docs.length||result.tasks.length!==tasks.length)throw Error('Report identity or task count differs from the request.')
      if(!controller.signal.aborted)show(result)
    }catch(e){if(!controller.signal.aborted)notice(e instanceof Error?e.message:'Comparison failed.')}
    finally{if(active.current===controller){active.current=null;working(false)}}
  }
  function exportJson(result:Report){
    const source=imported?{file_sha256:imported.fileHash,text_column:imported.column}:{calibration:true}
    // Keep the service's numeric tokens, including signed zero, in research reports.
    if(wireReport.current) return '{"source":'+JSON.stringify(source)+','+wireReport.current.slice(1)
    return JSON.stringify({...result,source},null,2)
  }
  const methodChoice=(key:'baseline'|'candidate')=><label>{key==='baseline'?'Baseline method':'Candidate method'}<select value={cfg[key]} onChange={e=>setting(key,e.target.value as Method)}>{keys.filter(k=>encoder!=='focus'||k!=='spherical').map(k=><option key={k} value={k}>{methods[k]}</option>)}</select></label>
  const numeric=(key:'k'|'strength'|'max_drift'|'min_cosine'|'min_recall'|'min_ndcg',name:string,min:number,max:number,step:number)=><label>{name}<input type="number" required min={min} max={max} step={step} value={Number.isFinite(cfg[key])?cfg[key]:''} onChange={e=>setting(key,e.target.valueAsNumber)}/></label>
  const available=docs.length>0&&docs.length<=256
  return <section className="foundry intelligence studio"><header><p className="kicker">VECTOR-X · Semantic Search Engineering and Debugging Studio</p><h1>Retrieval Debugger</h1>
    <p>Inspect a baseline, mark the passages a search should retrieve, then test a candidate against the same judgments.</p></header>
    {!hosted&&<label className="encoder-select">Retrieval encoder<select value={encoder} disabled={busy} onChange={e=>{
      chooseEncoder(e.target.value as Encoder);load(null);show(null);aim('Ocean affinity');guard('Botanical affinity')
      config({...cfg,baseline:cfg.baseline==='spherical'?'dense':cfg.baseline,candidate:cfg.candidate==='spherical'?'locked':cfg.candidate})
    }}>{Object.entries(encoders).map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label>}
    {encoder!=='focus'&&<p>Local model-specific centroid directions. Spherical strength limits angular travel in radians. Comparisons use the same source IDs and judgments.</p>}
    {error&&<p role="alert">{error} {!workspace&&<button onClick={()=>retry(attempt+1)}>Retry workspace</button>}</p>}
    {!workspace&&!error&&<p role="status">Loading the encoder and documents…</p>}
    {workspace&&<form onSubmit={e=>{e.preventDefault();void run()}}><fieldset disabled={busy} className="studio-fields">
      <section className="panel foundry-panel"><h2>Dataset and search tasks</h2>
      <p>{imported?'Local import · '+imported.column:'Calibration collection'} · {docs.length} source documents. {imported?'Source IDs follow the original row numbers.':hosted?'Hosted comparisons use the calibration collection.':'To use a private file, import and map its text column in Data Foundry.'} {!imported&&!hosted&&<a href="#data-foundry">Open Data Foundry</a>}</p>
      {!available&&<p role="alert">Choose 1–256 eligible documents for the debugger. No rows were sampled.</p>}
      <label>Active search task<select value={which} onChange={e=>{select(+e.target.value);search('')}}>{tasks.map((t,i)=><option key={i} value={i}>{i+1}. {t.query||'New query'}</option>)}</select></label>
      <label>Search query<input maxLength={400} required value={task.query} onChange={e=>edit({...task,query:e.target.value})}/></label>
      <details><summary>Expected relevant documents · {task.relevant.length} selected</summary>
      <label>Find source documents<input value={filter} onChange={e=>search(e.target.value)} maxLength={200}/></label>
      <div className="studio-judgments">{docs.filter(d=>(d.id+' '+d.text).toLowerCase().includes(filter.toLowerCase())).map(d=><label key={d.id}><input type="checkbox" checked={task.relevant.includes(d.id)} onChange={e=>edit({...task,relevant:e.target.checked?[...task.relevant,d.id]:task.relevant.filter(id=>id!==d.id)})}/>#{d.id} · {d.text}</label>)}</div></details>
      <p>Run an unlabeled query to inspect its rankings. Add judgments and rerun to calculate metrics and evaluate the release gate.</p>
      <div className="foundry-actions"><button type="button" disabled={tasks.length>=16} onClick={()=>{setTasks([...tasks,{query:'',relevant:[]}]);select(tasks.length);show(null);search('')}}>Add search task</button>
      <button type="button" disabled={tasks.length<2} onClick={()=>{setTasks(tasks.filter((_,i)=>i!==which));select(0);show(null)}}>Remove active task</button></div></section>
      <section className="panel foundry-panel"><h2>Hybrid retrieval lab</h2><div className="studio-grid">{methodChoice('baseline')}{methodChoice('candidate')}{numeric('k','Ranking cutoff K',1,20,1)}
      <label>Target direction<select value={target} onChange={e=>{aim(e.target.value);show(null)}}>{axisNames.map(name=><option key={name}>{name}</option>)}</select></label>
      <label>Protected direction<select value={protect} onChange={e=>{guard(e.target.value);show(null)}}>{axisNames.map(name=><option key={name}>{name}</option>)}</select></label>
      {numeric('strength','Requested steering strength',-2,2,.01)}</div>
      <p>Hybrid combines BM25 and dense ranks by reciprocal rank fusion. Semantic Lock constrains a measured model direction. {hosted?'Concept training is local.':<a href="#intelligence">Learn and save a local direction in Intelligence</a>}</p></section>
      <section className="panel foundry-panel"><h2>Release criteria</h2><div className="studio-grid">
      {numeric('min_recall','Minimum candidate Recall@K',0,1,.001)}{numeric('min_ndcg','Minimum candidate nDCG@K',0,1,.001)}
      {numeric('max_drift','Maximum protected drift',0,2,.001)}{numeric('min_cosine','Minimum retained cosine',-1,1,.001)}</div>
      {([['block_regressions','Block any per-task Recall or nDCG regression'],['block_abstentions','Block candidate abstentions'],['require_geometry','Require measured candidate geometry within limits']] as const).map(([key,name])=><label key={key}><input type="checkbox" checked={cfg[key]} onChange={e=>setting(key,e.target.checked)}/>{name}</label>)}
      <p>BM25 and fusion return ranked lists without a steered endpoint. Requiring geometry blocks those candidates.</p>
      <button className="encode" disabled={!available||tasks.some(t=>!t.query.trim())}>Run comparison</button></section>
      </fieldset></form>}
    {busy&&<p role="status">Comparing retrieval methods… <button onClick={()=>active.current?.abort()}>Cancel comparison</button></p>}
    {report&&<><Outcomes report={report} docs={docs}/><div className="panel foundry-panel"><p>The JSON export includes query text, judgments, settings and directions. Local import reports also include the mapped source texts for replay.</p>
      <button onClick={()=>downloadFile('vector-x-retrieval-report.json','application/json',exportJson(report))}>Export reproducible report</button></div></>}
  </section>
}
