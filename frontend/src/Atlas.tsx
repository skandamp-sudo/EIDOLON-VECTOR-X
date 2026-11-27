import {readAtlasDraft,forgetAtlasDraft} from './convergence/atlasDraft'
import { apiOrigin } from './apiOrigin'
import { useEffect, useState } from 'react'
import { ArrowUpRight, AudioLines, ChevronDown, Crosshair, Layers3, SlidersHorizontal } from 'lucide-react'
import Galaxy from './Galaxy'
import { colors, topics, validRun } from './explore'
import type { Run, Topic } from './explore'
import './atlas.css'

const initialText = 'A telescope records light from a distant star.'
const signed = (n:number) => (n>0?'+':'')+n.toFixed(2)
export default function Atlas({ online }: { online: boolean }) {
  const [handoff]=useState(readAtlasDraft)
  const [draft,setDraft]=useState(handoff?.text??initialText)
  useEffect(()=>forgetAtlasDraft(),[])
  const [query,setQuery]=useState(initialText)
  const [target,setTarget]=useState<Topic>('Ocean')
  const [strength,setStrength]=useState(1.2)
  const [result,setResult]=useState<Run|null>(null)
  const [selected,setSelected]=useState<number|null>(null)
  const [search, setSearch] = useState('')
  const [error,setError]=useState('')
  const [pending,setPending]=useState(true)
  const [attempt,setAttempt]=useState(0)
  useEffect(()=>{
    setError('')
    if(!online){setResult(null);setPending(false);return}
    setPending(true)
    const controller=new AbortController()
    let active=true
    const timer=setTimeout(async()=>{
      const timeout=setTimeout(()=>controller.abort(),6000)
      try {
        const response=await fetch(apiOrigin+'/api/v1/explore',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({text:query,target,strength}),signal:controller.signal,cache:'no-store'})
        if(!response.ok){
          const problem=await response.json().catch(()=>null)
          throw new Error(problem?.detail==='No representable signal'?'No known vocabulary. Try words such as telescope, ocean, string or forest.':'The runtime could not encode this query.')
        }
        const run:Run=await response.json()
        if(!validRun(run)||run.target!==target||run.strength!==strength)throw new Error('Unexpected response from the embedding runtime.')
        if(active)setResult(run)
      } catch(e) {
        if(active){setResult(null);setError(e instanceof Error && e.name!=='AbortError'?e.message:'Request timed out. Run the query again.')}
      } finally {clearTimeout(timeout);if(active)setPending(false)}
    },90)
    return ()=>{active=false;clearTimeout(timer);controller.abort()}
  },[online,query,target,strength,attempt])
  const run=online?result:null
  const doc=run?.documents[selected??run.after[0]]
  const term = search.trim().toLowerCase()
  const matches = run?.documents.filter(d => (d.topic + ' ' + d.text).toLowerCase().includes(term)) ?? []
  function submit(e:React.FormEvent){
    e.preventDefault()
    const value=draft.trim()
    if(!value)return
    setQuery(value);setAttempt(a=>a+1);setSelected(null)
  }
  return <>
    <div className="atlas-intro"><div className="crumb"><Layers3 size={14}/> Research workspace <span>/</span> Phase 1</div>
      <h1>Semantic atlas</h1><p>Steer a query toward a topic and see which documents change rank.</p></div>
    <div className="atlas-layout"><div className="galaxy-column"><Galaxy run={run} selected={doc?.id??null} select={setSelected}/>
      <div className="science-strip" aria-label="Measured quantities">
        <div><span>Embedding backbone</span><b>{run?.model??'—'} <small>{run?run.dimensions+'D':''}</small></b></div>
        <div title="Fraction of calibration embedding variance retained by three PCA components"><span>PCA variance retained</span><b>{run?(run.explained_variance*100).toFixed(1)+'%':'—'}</b></div>
        <div title="Cosine similarity between the original and steered query"><span>Query cosine</span><b>{run?run.retained_cosine.toFixed(3):'—'}</b></div>
        <div title="Euclidean distance between the two full-dimensional unit vectors"><span>L2 displacement</span><b>{run?.displacement.toFixed(3) ?? '—'}</b></div>
      </div></div>
      <aside className="panel steering"><div className="panel-head"><div className="panel-title"><SlidersHorizontal size={18}/><h2>Vector Warp</h2></div></div>
        <div className="steer-body"><form onSubmit={submit}><label htmlFor="query">Query text</label>
          {handoff&&<p>Draft from {handoff.source}. Select Embed query to encode the edited passage. Up to 400 characters are carried over.</p>}
          <textarea id="query" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={400} rows={2}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/>
          <button className="encode" disabled={!online||!draft.trim()} type="submit"><AudioLines size={15}/> Embed query</button></form>
          <label htmlFor="target">Concept direction</label><div className="select"><select id="target" value={target} disabled={!online} onChange={e=>setTarget(e.target.value as Topic)}>
          {topics.map(t=><option key={t}>{t}</option>)}</select><ChevronDown size={14}/></div>
          <div className="strength-head"><label htmlFor="strength">Steering strength</label><output htmlFor="strength">{signed(strength)}</output></div>
          <input id="strength" type="range" min="-2" max="2" step=".05" value={strength} disabled={!online} onChange={e=>setStrength(Number(e.target.value))}/>
          <div className="scale"><span>−2 · Away</span><button onClick={()=>setStrength(0)}>Zero</button><span>+2 · Toward</span></div>
          <div className={'run-status '+(error?'error':'')} role="status">{!online?'Waiting for runtime':error|| (pending?'Computing embeddings…':draft.trim()!==query?'Edit ready to embed':run?'Applied '+signed(run.strength)+' toward '+run.target:'Waiting for query')}</div>
        </div></aside>
    </div>
    <section className="panel doc-inspect" aria-label="Semantic similarity inspector"><Crosshair size={18}/><div><span className="eyelabel">Similarity inspector {doc?' / '+doc.topic:''}</span>
      <p>{doc?.text??'Select a document in the map or retrieval results.'}</p>
      {doc && <small className="coordinates">Point {doc.id + 1} · PCA ({doc.xyz.map(value => value.toFixed(3)).join(', ')})</small>}</div>
      <div className="compare-scores"><span>Original <b>{doc?.before.toFixed(3)??'—'}</b></span><span>Steered <b>{doc?.after.toFixed(3)??'—'}</b></span></div></section>
    <div className="inspection-tools">
      <details className="inspection">
        <summary>Search corpus points</summary>
        <label htmlFor="point-search">Document text or topic</label>
        <input id="point-search" type="search" value={search} disabled={!run} onChange={e => setSearch(e.target.value)} />
        <p role="status">{run ? matches.length + ' matching points' : 'Awaiting a valid embedding'}</p>
        <ul>{matches.map(d => <li key={d.id}><button aria-pressed={d.id === doc?.id} onClick={() => setSelected(d.id)}>
          <small>{d.topic} · {d.id + 1}</small>{d.text}
        </button></li>)}</ul>
      </details>
      <details className="inspection">
        <summary>Semantic X-Ray · query vectors</summary>
        {run ? <table><caption>{run.model} · {run.dimensions} dimensions</caption>
          <thead><tr><th scope="col">Dimension</th><th scope="col">Original</th><th scope="col">Steered</th></tr></thead>
          <tbody>{run.original.map((value, i) => <tr key={i}><th scope="row">D{i + 1}</th>
            <td>{value.toFixed(6)}</td><td>{run.steered[i].toFixed(6)}</td></tr>)}</tbody></table>
          : <p>Awaiting a valid embedding</p>}
      </details>
    </div>
    <section className="results"><div className="section-title"><div><Layers3 size={18}/><h2>Nearest neighbors</h2></div><span>{run?run.documents.length+' documents · cosine similarity':'Awaiting results'}</span></div>
      <div className="rank-pair">{(['before','after'] as const).map(side=><div key={side} className={'rank-panel '+side}><div className="rank-head"><span className={side==='before'?'query-dot':'steered-dot'}/><h3>{side==='before'?'Original query':'Steered query'}</h3>{side==='after'&&run&&<small>{Math.round(run.neighbor_overlap*3)}/3 neighbors retained</small>}</div>
      <ol>{run?.[side].map((id,i)=>{const d=run.documents[id];return <li key={id}><button onClick={()=>setSelected(id)} aria-pressed={doc?.id===id} title={'Inspect '+d.text}>
        <span className="rank-num">{i+1}</span><i style={{background:colors[d.topic]}}/><span>{d.text}</span><b>{d[side].toFixed(3)}</b><ArrowUpRight size={12}/></button></li>})}</ol></div>)}</div>
      <details className="method"><summary>Concept DNA · how steering works</summary><p>Each point is one calibration document. Lines connect nearest same-topic neighbors in PCA space. For each direction, the model subtracts the mean of the other 18 embeddings from the mean of six topic examples, then normalizes the difference. The slider adds a signed multiple of that direction and normalizes the query again. Retrieval scores use all eight dimensions. Phase 2 will evaluate a trainable adapter.</p></details>
    </section>
  </>
}
