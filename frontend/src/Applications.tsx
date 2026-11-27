import {useEffect, useState} from 'react'
import {fmt, labRequest} from './labTypes'
import Clarity from './convergence/Clarity'
import Morph,{navigateBack,visit} from './convergence/Morph'
import type {Domain} from './convergence/session'
import Supply from './convergence/SupplyDesk'
import Cortex from './convergence/Cortex'
import Frontier from './Frontier'
import Recovery from './Recovery'
import type {Topic} from './explore'
import './lab.css'

const steps = ['CORTEX', 'CLARITY', 'SUPPLY', 'MORPH', 'SYMBIOSIS', 'Evidence'] as const
const instructions = [
  'Search the calibration collection, inspect a document, then follow its nearest neighbors.',
  'Choose a reading of the query. Compare the original top three with the directed ranking.',
  'Inspect material candidates and review catalog labels that disagree with nearby records.',
  'Save a candidate to teach the workspace a category preference. Compare rankings and roll back the last interaction.',
  'Review the measured gain and drift before approving or rejecting a feasible operating point.',
  'Compare retrieval coverage with ranking quality in the recorded QASPER experiment.'
]
type Item = {id:number;name:string;text:string;category:string;peers:number[];score:number;anomalous:boolean;majority:string;votes:number}
type Result = {model_id:string;interpretations:Topic[];items:Item[];before:number[];after:number[]}

function Explorer({step}:{step:number}) {
  const inventory = step>=2
  const [draft,setDraft]=useState('light and waves'), [query,setQuery]=useState('light and waves')
  const [reading,setReading]=useState<Topic|null>(null), [selected,setSelected]=useState<number|null>(null)
  const [result,setResult]=useState<Result|null>(null), [error,setError]=useState(''), [retry,setRetry]=useState(0)
  const [history,setHistory]=useState<string[]>(()=>{
    try {
      const saved=sessionStorage.getItem('vector-x.inventory-saves.v1')
      if(!saved||saved.length>512)return []
      const values:unknown=JSON.parse(saved)
      return Array.isArray(values)&&values.length<=20&&values.every(v=>['Marine','Optics','Acoustics'].includes(v))?values:[]
    } catch {return []}
  })
  useEffect(()=>{const reset=()=>setHistory([]);window.addEventListener('vector-x-reset-preferences',reset);return ()=>window.removeEventListener('vector-x-reset-preferences',reset)},[])
  function updateHistory(next:string[]){
    setHistory(next)
    try {sessionStorage.setItem('vector-x.inventory-saves.v1',JSON.stringify(next))} catch { /* In-memory use remains available. */ }
  }
  useEffect(()=>{
    const c=new AbortController()
    setResult(null);setError('');setSelected(null)
    labRequest<Result>('applications',{text:query,interpretation:reading,corpus:inventory?'inventory':'knowledge'},c.signal)
      .then(r=>{if(!c.signal.aborted)setResult(r)}).catch(e=>{if(!c.signal.aborted)setError(e.message)})
    return ()=>c.abort()
  },[query,reading,inventory,retry])
  const item=result?.items[selected??result.after[0]]
  const bonus=(category:string)=>history.length ? .25*history.filter(s=>s===category).length/history.length : 0
  const adaptive=result?[...result.after].sort((a,b)=>{
    const x=result.items[a],y=result.items[b]
    return (y.score+bonus(y.category))-(x.score+bonus(x.category))
  }):[]
  const list=(ids:number[])=><ol>{ids.slice(0,3).map(id=><li key={id}><button onClick={()=>setSelected(id)}>{result?.items[id].name}</button></li>)}</ol>
  return <section className="panel foundry-panel"><h2>{['Knowledge exploration','Clarify a query','Material discovery','Workspace preferences'][step]}</h2>
    <form onSubmit={e=>{e.preventDefault();setQuery(draft.trim());setReading(null);setRetry(n=>n+1)}}>
      <label>Semantic query<input required maxLength={400} value={draft} onChange={e=>setDraft(e.target.value)}/></label>
      <button disabled={!draft.trim()}>Search {inventory?'inventory':'documents'}</button></form>
    {error?<p role="alert">{error} <button onClick={()=>setRetry(n=>n+1)}>Retry search</button></p>:!result?<p role="status">Encoding query…</p>:<>
      <p>Results for “{query}” · {result.items.length} {inventory?'illustrative catalog items':'calibration documents'}</p>
      {step<=1&&<div className="foundry-actions"><span>Direct toward</span>{result.interpretations.map(t=><button key={t} aria-pressed={reading===t} onClick={()=>setReading(t)}>{t}</button>)}
        {reading&&<button onClick={()=>setReading(null)}>Clear clarification</button>}</div>}
      {step===1?<div className="rank-pair"><div><h3>Before clarification</h3>{list(result.before)}</div><div><h3>{reading??'Original reading'}</h3>{list(result.after)}</div></div>:
        step===3?<><p>Each saved interaction adds weight to its category. The adaptive score is cosine similarity plus up to 0.25 times the category’s share of saves. Only category labels are saved in this browser tab, up to 20 interactions.</p>
        <div className="rank-pair"><div><h3>Static baseline</h3>{list(result.after)}</div><div><h3>Adaptive candidates</h3>{list(adaptive)}</div></div>
        <p role="status">{history.length} saved interactions{history.length?' · most recent category '+history[history.length-1]:''}</p>
        <button disabled={!history.length} onClick={()=>updateHistory(history.slice(0,-1))}>Roll back last save</button></>:<><h3>Nearest candidates</h3>{list(result.after)}</>}
      {item&&<><label>Inspect {inventory?'catalog item':'document'}<select value={item.id} onChange={e=>setSelected(Number(e.target.value))}>{result.after.map(i=><option value={i} key={i}>{result.items[i].name}</option>)}</select></label>
        <p>{item.text} · {item.category} · cosine {fmt(item.score)}</p>
        {step===3&&<p>Static score {fmt(item.score)} · preference adjustment +{fmt(bonus(item.category))} · adaptive rank {adaptive.indexOf(item.id)+1} of {adaptive.length}</p>}
        {step===3&&<button disabled={history.length>=20} onClick={()=>updateHistory([...history,item.category])}>Save candidate preference</button>}
        <h3>Related {inventory?'items':'documents'}</h3>{list(item.peers)}</>}
      {step===2&&<><h3>Category review</h3><p>Flagged when at least two of three nearest descriptions share a category different from the catalog label. Semantic similarity alone cannot establish interchangeability.</p>
        {result.items.filter(i=>i.anomalous).map(i=><p key={i.id}><button onClick={()=>setSelected(i.id)}>{i.name}</button> · labeled {i.category} · {i.votes}/3 neighbors in {i.majority}</p>)}</>}
    </>}</section>
}

export default function Applications({online,initialStep=0,direct=false}:{online:boolean;initialStep?:number;direct?:boolean}){
  const [step,setLocalStep]=useState(initialStep)
  const setStep=(value:number)=>{if(direct)location.hash=value===5?'evidence-vault':steps[value].toLowerCase();else setLocalStep(value)}
  const domain:Domain=step===5?'VECTOR-X':steps[step] as Domain
  useEffect(()=>visit(domain),[domain])
  const navigate=(d:Domain)=>{if(d==='VECTOR-X'){location.hash='vector-x';return}setStep(steps.indexOf(d))}
  return <section className="foundry intelligence"><div className="atlas-intro"><h1>{direct?steps[step]:'Application demonstrations'}</h1><p>Judge walkthrough · five uses of the calibration model and a review of the independent evidence.</p></div>
    <section className="panel foundry-panel"><label>Walkthrough step<select value={step} onChange={e=>setStep(Number(e.target.value))}>{steps.map((s,i)=><option value={i} key={s}>{i+1}. {s}</option>)}</select></label>
    <p>{instructions[step]}</p><div className="foundry-actions"><button disabled={!step} onClick={()=>{navigateBack(domain);setStep(step-1)}}>Previous step</button><button disabled={step===5} onClick={()=>setStep(step+1)}>Next step</button></div></section>
    <details open={step===3}><summary>Navigation preferences and study</summary><Morph context={domain} onNavigate={navigate}/></details>
    {step===0&&<Cortex/>}{step===2&&<Supply/>}{step===1&&<Clarity/>}
    {step===5?<><Recovery online={online}/><p>BM25 led unsteered retrieval. Neither new encoder increased the fraction of methodology-labeled paragraphs in the governed top three. Only three evaluation paragraphs carried that label.</p><a href="#research-lab">Open full Evidence Vault</a></>:!online?<p role="status">Waiting for the model service.</p>:step===4?<Frontier/>:<Explorer key={step<2?'knowledge':'inventory'} step={step}/>}
  </section>
}
