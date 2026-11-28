import {tourAction} from './tourState'
import {readAtlasDraft,forgetAtlasDraft} from './convergence/atlasDraft'
import { apiOrigin } from './apiOrigin'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, AudioLines, ChevronDown, Crosshair, Layers3, SlidersHorizontal } from 'lucide-react'
import Galaxy from './Galaxy'
import { colors, topics, validRun } from './explore'
import type { Doc, Run, Topic } from './explore'
import './atlas.css'

const initialText = 'A telescope records light from a distant star.'
const signed = (n:number) => (n>0?'+':'')+n.toFixed(2)
type Ranking = 'before' | 'after' | 'gain' | 'loss'

function similarityOrder(documents: Doc[], side: 'before' | 'after') {
  // The runtime sorts full-precision scores stably in corpus (point ID) order.
  return [...documents].sort((a, b) => b[side] - a[side] || a.id - b.id)
}

function MatchRow({ document: d, beforeRank, afterRank, active, select }: {
  document: Doc; beforeRank: number; afterRank: number; active: boolean; select: (id: number) => void
}) {
  const change = d.after - d.before
  return <div className="atlas-match">
    <button type="button" className="match-pick" aria-pressed={active} onClick={() => select(d.id)}>
      <span className="match-source">
        <span className="match-id"><i style={{ background: colors[d.topic] }}/>Point {d.id + 1} · {d.topic}{active && <strong>Selected</strong>}</span>
        <span>{d.text}</span>
      </span>
      <span className="match-measures">
        <span title={String(d.before)}>Original cosine<b>{d.before.toFixed(4)}</b></span>
        <span title={String(d.after)}>Steered cosine<b>{d.after.toFixed(4)}</b></span>
        <span title={String(change)}>Change<b>{change > 0 ? '+' : ''}{change.toFixed(4)}</b></span>
        <span>Original rank<b>#{beforeRank}</b></span>
        <span>Steered rank<b>#{afterRank}</b></span>
      </span>
    </button>
    <details><summary>PCA coordinates</summary><p>{d.xyz.map((value, i) => 'PC' + (i + 1) + ' ' + value.toFixed(4)).join(' · ')}</p></details>
  </div>
}

export default function Atlas({ online }: { online: boolean }) {
  const [handoff]=useState(readAtlasDraft)
  const [draft,setDraft]=useState(handoff?.text??initialText)
  useEffect(()=>forgetAtlasDraft(),[])
  const tourRequest=useRef('')
  const [query,setQuery]=useState(initialText)
  const [target,setTarget]=useState<Topic>('Ocean')
  const [strength,setStrength]=useState(1.2)
  const [result,setResult]=useState<Run|null>(null)
  const [selected,setSelected]=useState<number|null>(null)
  const [ranking, setRanking] = useState<Ranking>('after')
  const [topic, setTopic] = useState<Topic | 'all'>('all')
  const [limit, setLimit] = useState('5')
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
        if(active){setResult(run);if(tourRequest.current){tourAction(tourRequest.current);tourRequest.current=''}}
      } catch(e) {
        if(active){setResult(null);setError(e instanceof Error && e.name!=='AbortError'?e.message:'Request timed out. Run the query again.')}
      } finally {clearTimeout(timeout);if(active)setPending(false)}
    },90)
    return ()=>{active=false;clearTimeout(timer);controller.abort()}
  },[online,query,target,strength,attempt])
  const run=online?result:null
  const documents = run?.documents ?? []
  const originalOrder = similarityOrder(documents, 'before')
  const steeredOrder = similarityOrder(documents, 'after')
  const ranks = (order: Doc[]) => new Map(order.map((d, i) => [d.id, i + 1]))
  const originalRanks = ranks(originalOrder)
  const steeredRanks = ranks(steeredOrder)
  let ordered = ranking === 'before' ? originalOrder : steeredOrder
  if (ranking === 'gain' || ranking === 'loss') {
    const direction = ranking === 'gain' ? 1 : -1
    const change = (d: Doc) => direction * (d.after - d.before)
    ordered = documents.filter(d => change(d) > 0).sort((a, b) => change(b) - change(a) || a.id - b.id)
  }
  const eligible = ordered.filter(d => topic === 'all' || d.topic === topic)
  const visible = limit === 'all' ? eligible : eligible.slice(0, Number(limit))
  const doc = selected === null ? visible[0] : documents.find(d => d.id === selected)
  const outside = doc && !visible.some(d => d.id === doc.id)
  const row = (d: Doc) => <MatchRow document={d} beforeRank={originalRanks.get(d.id)!} afterRank={steeredRanks.get(d.id)!}
    active={d.id === doc?.id} select={setSelected}/>

  const term = search.trim().toLowerCase()
  const matches = run?.documents.filter(d => (d.topic + ' ' + d.text).toLowerCase().includes(term)) ?? []
  function submit(e:React.FormEvent){
    e.preventDefault()
    const value=draft.trim()
    if(!value)return
    tourRequest.current="atlas-embed";setQuery(value);setAttempt(a=>a+1);setSelected(null)
  }
  return <>
    <div className="atlas-intro"><div className="crumb"><Layers3 size={14}/> Research workspace <span>/</span> Phase 1</div>
      <h1>Semantic atlas</h1><p>Steer a query toward a topic and see which documents change rank.</p><nav className="hero-actions" aria-label="Retrieval workflow"><a href="#data-foundry">Inspect a dataset</a><a href="#retrieval-debugger">Compare encoders and export a report →</a></nav></div>
    <div className="atlas-layout"><div className="galaxy-column" data-tour="atlas-map"><Galaxy run={run} selected={doc?.id??null} select={setSelected}/>
      <div className="science-strip" data-tour="atlas-result" aria-label="Measured quantities">
        <div><span>Embedding backbone</span><b>{run?.model??'—'} <small>{run?run.dimensions+'D':''}</small></b></div>
        <div title="Fraction of calibration embedding variance retained by three PCA components"><span>PCA variance retained</span><b>{run?(run.explained_variance*100).toFixed(1)+'%':'—'}</b></div>
        <div title="Cosine similarity between the original and steered query"><span>Query cosine</span><b>{run?run.retained_cosine.toFixed(3):'—'}</b></div>
        <div title="Euclidean distance between the two full-dimensional unit vectors"><span>L2 displacement</span><b>{run?.displacement.toFixed(3) ?? '—'}</b></div>
      </div></div>
      <aside className="panel steering"><div className="panel-head"><div className="panel-title"><SlidersHorizontal size={18}/><h2>Vector Warp</h2></div></div>
        <div className="steer-body"><form onSubmit={submit}><label htmlFor="query">Query text</label>
          {handoff&&<p>Draft from {handoff.source}. Select Embed query to encode the edited passage. Up to 400 characters are carried over.</p>}
          <textarea data-tour="atlas-query" id="query" value={draft} onChange={e=>setDraft(e.target.value)} maxLength={400} rows={2}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();e.currentTarget.form?.requestSubmit()}}}/>
          <button data-tour="atlas-embed" className="encode" disabled={!online||!draft.trim()} type="submit"><AudioLines size={15}/> Embed query</button></form>
          <label htmlFor="target">Concept direction</label><div className="select"><select data-tour="atlas-target" id="target" value={target} disabled={!online} onChange={e=>{tourRequest.current="atlas-target";setTarget(e.target.value as Topic)}}>
          {topics.map(t=><option key={t}>{t}</option>)}</select><ChevronDown size={14}/></div>
          <div className="strength-head"><label htmlFor="strength">Steering strength</label><output htmlFor="strength">{signed(strength)}</output></div>
          <input id="strength" type="range" min="-2" max="2" step=".05" value={strength} disabled={!online} onChange={e=>setStrength(Number(e.target.value))}/>
          <label htmlFor="exact-strength">Signed numeric value</label><input id="exact-strength" type="number" step=".05" min="-2" max="2" value={strength} onChange={e=>{const v=e.currentTarget.valueAsNumber;if(Number.isFinite(v)&&Math.abs(v)<=2)setStrength(v)}}/>
          <div className="scale"><span>−2 · Away</span><button onClick={()=>setStrength(0)}>Zero</button><span>+2 · Toward</span></div>
          <div className={'run-status '+(error?'error':'')} role="status">{!online?'Waiting for runtime':error|| (pending?'Computing embeddings…':draft.trim()!==query?'Edit ready to embed':run?'Applied '+signed(run.strength)+' toward '+run.target:'Waiting for query')}</div>
        </div></aside>
    </div>
    <section className="panel doc-inspect" aria-label="Semantic similarity inspector">
      <div className="panel-title"><Crosshair size={18}/><h2>Similarity inspector</h2></div>
      <div className="match-controls">
        <div><label htmlFor="atlas-match-order">Rank by</label><select id="atlas-match-order" value={ranking} onChange={e => setRanking(e.target.value as Ranking)}>
          <option value="before">Original cosine similarity</option><option value="after">Steered cosine similarity</option>
          <option value="gain">Largest positive similarity change</option><option value="loss">Largest negative similarity change</option>
        </select></div>
        <div><label htmlFor="atlas-match-topic">Topic</label><select id="atlas-match-topic" value={topic} onChange={e => setTopic(e.target.value as Topic | 'all')}>
          <option value="all">All topics</option>{topics.map(t => <option key={t}>{t}</option>)}
        </select></div>
        <div><label htmlFor="atlas-match-count">Match count</label><select id="atlas-match-count" value={limit} onChange={e => setLimit(e.target.value)}>
          {[3, 5, 10].map(n => <option key={n} value={n}>Top {n}</option>)}<option value="all">All available documents</option>
        </select></div>
      </div>
      <p className="match-summary" role="status">{pending ? 'Updating matches…' : !run ? 'Awaiting a valid embedding.' :
        eligible.length ? visible.length + ' of ' + eligible.length + ' matches · Ranks are across all ' + documents.length + ' documents.' :
        'No documents match these filters.'}</p>
      {!pending && run && <>
        {visible.length > 0 && <ol className="match-list" aria-label="Ranked semantic matches">{visible.map(d => <li key={d.id}>{row(d)}</li>)}</ol>}
        {outside && <div className="match-outside"><h3>Selected point outside these results</h3>{row(doc)}</div>}
      </>}
    </section>

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
      <details className="method"><summary>Concept DNA · how steering works</summary><p>Each point is one calibration document. Lines connect nearest same-topic neighbors in PCA space. For each direction, the model subtracts the mean of the other 18 embeddings from the mean of six topic examples, then normalizes the difference. The slider adds a signed multiple of that direction and normalizes the query again. Retrieval scores use all eight dimensions. Open Intelligence for the separately learned ridge direction and its validation results.</p></details>
    </section>
  </>
}
