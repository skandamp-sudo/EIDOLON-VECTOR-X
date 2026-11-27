import { useEffect, useRef, useState } from 'react'
import { hosted } from './apiOrigin'
import { localRequest } from './localRequest'
import { fmt } from './labTypes'

const names={legacy8:'Calibration LSA · 8D',legacy16:'Calibration LSA · 16D',expanded:'Scientific LSA · 128D',minilm:'Quantized MiniLM · 384D'}
type Encoder=keyof typeof names
type Metric=Record<string,number|undefined>
type Row={family:string;represented:boolean;gold:string[];documents:number;indexed:number;methods:Record<string,Metric>;fidelity:{trustworthiness:number|null;overlap:number|null}|null}
type RecordV2={model:string;name:Encoder;dimensions:number;ranking:string;rows:Row[];development:{ms:number}[];peak_rss_mib:number}
type Probe={model:string;dimensions:number;variants:Record<string,{neighbors:{id:string;family:string;excerpt:string}[];applied:number;drift?:number}>}
const methods={bm25:'BM25',original:'Unsteered',unconstrained:'Unconstrained',locked:'Semantic Lock',matched:'Matched unconstrained',paired:'Locked on matched families'}
const average=(xs:(number|null|undefined)[])=>{
  const values=xs.filter((x):x is number=>typeof x==='number'&&Number.isFinite(x))
  return values.length?values.reduce((a,b)=>a+b,0)/values.length:null
}

function ModelPanel({name,online}:{name:Encoder;online:boolean}){
  const [record,setRecord]=useState<RecordV2|null>(null),[error,setError]=useState('')
  const [text,setText]=useState(''),[strength,setStrength]=useState(1.5),[busy,setBusy]=useState(false)
  const [result,setResult]=useState<Probe|null>(null),[problem,setProblem]=useState('')
  const pending=useRef<AbortController|null>(null)
  useEffect(()=>{
    const c=new AbortController()
    fetch('/evidence/recovery-v2/'+name+'.json',{signal:c.signal}).then(async r=>{
      if(!r.ok)throw Error()
      const data:RecordV2=await r.json()
      if(data.name!==name||!Array.isArray(data.rows))throw Error()
      setRecord(data)
    }).catch(()=>{if(!c.signal.aborted)setError('Evidence unavailable for this encoder.')})
    return ()=>{c.abort();pending.current?.abort()}
  },[name])
  async function run(){
    pending.current?.abort()
    const c=new AbortController();pending.current=c
    setBusy(true);setProblem('');setResult(null)
    try{setResult(await localRequest<Probe>('research-v2/probe',JSON.stringify({encoder:name,expected_model:record?.model,text,strength}),c.signal))}
    catch(e){if(!c.signal.aborted)setProblem(e instanceof Error?e.message:'Local encoder unavailable.')}
    finally{if(!c.signal.aborted)setBusy(false)}
  }
  if(!record)return <p role="status">{error||'Loading measured outcomes…'}</p>
  const rows=record.rows
  return <>
    <p>QASPER · within-paper retrieval · {rows.length} paper families · {rows.filter(r=>r.gold.length).length} with annotated evidence. Section headings supply the methodology and results labels.</p>
    <div className="foundry-stats"><span><b>{rows.filter(r=>r.represented).length}/{rows.length}</b> queries represented</span>
      <span><b>{rows.reduce((n,r)=>n+r.indexed,0)}/{rows.reduce((n,r)=>n+r.documents,0)}</b> paragraphs indexed</span>
      <span><b>{fmt(average(record.development.map(r=>r.ms)))} ms</b> mean development encoding</span></div>
    <div className="preview-scroll"><table><caption>Within-encoder comparison at requested strength +1.5</caption><thead><tr>
      {['Method','Recall@3','nDCG@3','Axis gain','Protected drift','Violations / measured','Target section Δ','Results section |Δ|','Families'].map(s=><th key={s}>{s}</th>)}</tr></thead><tbody>
      {Object.entries(methods).map(([key,label])=>{
        const entries=rows.filter(r=>key!=='paired'||r.methods.matched).map(r=>r.methods[key==='paired'?'locked':key]).filter(Boolean)
        const violations=entries.map(x=>x.violation).filter((x):x is number=>typeof x==='number')
        return <tr key={key}><th>{label}</th>{['recall','ndcg','gain','drift'].map(k=><td key={k}>{fmt(average(entries.map(v=>v[k])))}</td>)}
          <td>{violations.length?violations.reduce((a,b)=>a+b,0)+' / '+violations.length:'Unavailable'}</td>
          <td>{fmt(average(entries.map(v=>v.target_change)))}</td><td>{fmt(average(entries.map(v=>v.protected_change)))}</td><td>{entries.length}</td></tr>
      })}</tbody></table></div>
    <p>Mean PCA trustworthiness {fmt(average(rows.map(r=>r.fidelity?.trustworthiness)))} · neighbor overlap {fmt(average(rows.map(r=>r.fidelity?.overlap)))} · process peak {fmt(record.peak_rss_mib)} MiB.</p>
    <details><summary>Encoder identity and per-family measurements</summary><p style={{overflowWrap:'anywhere'}}>{record.model} · {record.ranking}</p>
      <a href={'/evidence/recovery-v2/'+name+'.json'} download>Download measured outcomes</a></details>
    {!hosted&&online&&<form onSubmit={e=>{e.preventDefault();void run()}}><h3>Probe the local encoder</h3>
      <p>Rank the separate training reference paragraphs before and after methodology steering.</p>
      <label>Research query<textarea required maxLength={1600} value={text} disabled={busy} onChange={e=>{setText(e.target.value);setResult(null)}}/></label>
      <label>Requested strength<input type="number" min="-2" max="2" step=".01" required disabled={busy} value={strength} onChange={e=>{setStrength(Number(e.target.value));setResult(null)}}/></label>
      <button disabled={busy||!text.trim()}>{busy?'Encoding…':'Run local probe'}</button>
      <p role="status">{problem}</p>
      {result&&<><p style={{overflowWrap:'anywhere'}}>Live {result.dimensions}D model · {result.model}</p>{Object.entries(result.variants).map(([k,v])=><details key={k}><summary>{methods[k as keyof typeof methods]} · applied {fmt(v.applied)}</summary>
        <ol>{v.neighbors.map(n=><li key={n.id}>Paper {n.family} · {n.excerpt}</li>)}</ol></details>)}</>}
    </form>}
  </>
}
export default function Recovery({online}:{online:boolean}){
  const [name,setName]=useState<Encoder>('expanded')
  return <section className="panel foundry-panel"><h2>Recovery experiment</h2>
    <label>Research encoder<select value={name} onChange={e=>setName(e.target.value as Encoder)}>{Object.entries(names).map(([k,n])=><option key={k} value={k}>{n}</option>)}</select></label>
    <ModelPanel key={name} name={name} online={online}/></section>
}
