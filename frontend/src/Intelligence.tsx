import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { Camera } from './FoundryMap'
import FoundryMap from './FoundryMap'
import ConceptEditor from './ConceptEditor'
import { fmt, labRequest, title } from './labTypes'
import type { Analysis, Concept, Direction, ImportIndex, Mode, Workspace } from './labTypes'
import './lab.css'

type Entry = {direction: Direction; validation?: Concept['validation']}
const modes: Mode[] = ['original','naive','learned','locked']
const views: Mode[] = ['original','naive','locked']
const storageKey = 'vector-x.learned-directions.v1'
function savedDirections(id: string): Direction[] {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return []
  if (raw.length > 32768) throw new Error('Saved direction data exceeds the limit.')
  const list = JSON.parse(raw) as Direction[]
  if (!Array.isArray(list) || list.length > 8) throw new Error('Saved directions have an invalid format.')
  return list.filter(d => d && d.model_id === id && typeof d.name === 'string' && d.name.length <= 64 &&
    [d.centroid,d.linear].every(v => Array.isArray(v) && v.length === 8 && v.every(Number.isFinite) && Math.abs(Math.hypot(...v)-1) < 1e-8))
}

function DamagePlot({ attributes }: { attributes: Analysis['variants']['locked']['attributes'] }) {
  function position(i: number, score: number) {
    const angle = i * 2 * Math.PI / attributes.length - Math.PI / 2
    const radius = 65 * (1 + score)
    return [180 + radius * Math.cos(angle), 155 + radius * Math.sin(angle)]
  }
  return <figure className="damage-plot"><svg role="img" aria-label="Attribute scores before and after locking. The center is minus one, the middle ring zero, the outer ring plus one." viewBox="0 0 360 310">
    {[65,130].map(radius => <circle key={radius} cx="180" cy="155" r={radius} fill="none" stroke="#40515d" strokeDasharray="3 4"/>)}
    {attributes.map((a,i) => { const [x,y]=position(i,1); const [tx,ty]=position(i,1.15)
      return <g key={i}><line x1="180" y1="155" x2={x} y2={y} stroke="#35424d"/><text x={tx} y={ty} fill="#c6d2d9" textAnchor="middle">{i+1}</text><title>{a.name}</title></g> })}
    {(['before','after'] as const).map((side,i) => <polygon key={side} points={attributes.map((a,j)=>position(j,a[side]).join(',')).join(' ')}
       fill="none" stroke={i?'#f0c988':'#83dcda'} strokeDasharray={i?undefined:'5 3'} strokeWidth="2"/>)}
  </svg><figcaption>Dashed · original　 Solid · locked　 Axes follow table order.</figcaption></figure>
}

function Results({ run, documents, camera, setCamera, selected, setSelected }: {
  run: Analysis; documents: string[]; camera: Camera; setCamera: Dispatch<SetStateAction<Camera>>; selected: number; setSelected: (n:number)=>void
}) {
  const points = useMemo(() => run.points.map((xyz,row) => ({row,xyz,vector:[]})), [run.points])
  const lock = run.variants.locked, f = run.fidelity
  return <div className="lab-results"><section className="panel foundry-panel"><h2>Adaptive steering governor</h2>
    <p>{lock.reason} Requested {fmt(run.requested)} · applied {fmt(lock.applied)}. Endpoint constraints {lock.satisfied ? 'satisfied' : 'violated'}.</p>
    <div className="preview-scroll"><table><caption>Same query, model, index and limits</caption><thead><tr>
      {['Method','Strength','Target score Δ','Max protected drift','Query cosine','Limits','nDCG@3'].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{modes.map(mode => { const v = run.variants[mode]; return <tr key={mode}><th>{title[mode]}</th>
        <td>{fmt(v.applied)}</td><td>{fmt(v.target_delta)}</td><td>{fmt(v.drift)}</td><td>{fmt(v.cosine)}</td><td>{v.satisfied ? 'Met' : 'Exceeded'}</td><td>{fmt(v.ndcg)}</td></tr> })}</tbody></table></div>
    {run.conflicts.map((c,i) => <small key={i}>{c.a} / {c.b} · direction cosine {fmt(c.cosine)}. </small>)}
  </section>
  <section><h2>Parallel Universes</h2><p>Orbit a view to move all three cameras. Corpus positions and scales are shared. Amber traces the query.</p>
    <label>Inspect index point<select value={selected} onChange={e => setSelected(Number(e.target.value))}>
      {documents.map((s,i) => <option key={i} value={i}>{i+1} · {s.slice(0,70)}</option>)}</select></label>
    <div className="universes">{views.map(mode => <div key={mode}>
      <FoundryMap title={title[mode]} camera={camera} changeCamera={setCamera} points={points} selected={selected} select={setSelected} path={run.variants[mode].trajectory}/>
      <ol>{run.variants[mode].neighbors.map(n => <li key={n.id}>{documents[n.id]} <b>{fmt(n.score)}</b></li>)}</ol>
    </div>)}</div>
  </section>
  <section className="panel foundry-panel"><h2>Projection Truth Layer</h2>
    <p>{f.sample} of {f.population} points · k = {f.k} · calibration PCA variance {fmt(f.calibration_variance)}.</p>
    <div className="foundry-stats"><span>Trustworthiness <b>{fmt(f.trustworthiness)}</b></span><span>Neighbor overlap <b>{fmt(f.overlap)}</b></span><span>Distance rank ρ <b>{fmt(f.distance_rho)}</b></span></div>
    <p>Selected point {selected+1} · fraction of high-dimensional neighbors lost in 3D: {fmt(f.distortion[selected])}.
      {f.overlap == null ? ' Insufficient distinct geometry for fidelity estimates.' : f.overlap < 1 ? ' Some nearest neighbors change in projection. Use the eight-dimensional ranking to inspect them.' : ''}</p>
  </section>
  <section className="panel foundry-panel"><h2>Semantic Damage Radar</h2><p>Signed changes in concept readouts under Semantic Lock. These scores are proxies for semantic attributes.</p>
    <DamagePlot attributes={lock.attributes}/><div className="preview-scroll"><table><thead><tr>{['Attribute','Role','Before','After','Change'].map(h => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{lock.attributes.map((a,i) => <tr key={i}><th>{a.name}</th><td>{a.role}</td><td>{fmt(a.before)}</td><td>{fmt(a.after)}</td><td>{fmt(a.after-a.before)}</td></tr>)}</tbody></table></div>
    <p>Top-three gained · {lock.gained.map(i => i+1).join(', ') || 'none'}　 Lost · {lock.lost.map(i => i+1).join(', ') || 'none'}</p>
    <details><summary>Ranking changes and semantic debugger</summary>
      {lock.changes.map(c => <p key={c.id}>Point {c.id+1} · rank {c.before} → {c.after} · {documents[c.id]}</p>)}
      <h3>Suspected anomalies</h3>
      {lock.suspicions.length ? <ul>{lock.suspicions.map((s,i) => <li key={i}>Point {s.id+1} · {s.reason}</li>)}</ul> : <p>No active rule flagged the locked neighbors.</p>}
    </details>
  </section></div>
}

function Lab({workspace, imported}: {workspace: Workspace; imported?: ImportIndex}) {
  const [camera,setCamera] = useState({yaw:.45,pitch:-.22,zoom:1})
  const [point,setPoint] = useState(0)
  const [entries,setEntries] = useState<Entry[]>(workspace.presets)
  const [target,setTarget] = useState(workspace.presets[0].direction.name)
  const [protectedNames,setProtected] = useState([workspace.presets[1].direction.name])
  const documents = imported?.texts ?? workspace.documents
  const [text,setText] = useState(imported?.texts[0] ?? 'forest canopy gathers distant light')
  const [strength,setStrength] = useState(1.5), [drift,setDrift] = useState(.035), [cosine,setCosine] = useState(.65)
  const [labels,setLabels] = useState(''), [category,setCategory] = useState('')
  const [run,setRun] = useState<Analysis|null>(null), [status,setStatus] = useState(''), [notice,setNotice] = useState('')
  const [attempt,setAttempt] = useState(0)
  const selected = entries.find(e => e.direction.name === target)!
  useEffect(() => {
    try {
      const stored = savedDirections(workspace.model_id)
      setEntries([...workspace.presets, ...stored.filter(d => !workspace.presets.some(p => p.direction.name === d.name)).map(direction => ({direction}))])
    } catch { setNotice('Local saved directions could not be loaded.') }
  }, [workspace])
  const index = useMemo(() => imported ? {model_id:imported.modelId, vectors:imported.points.map(p=>p.vector),
    categories:category.trim() && imported.categories ? imported.categories.map(c=>c===category.trim()?c:'') : null} : null,[imported,workspace,category])
  useEffect(() => {
    const controller = new AbortController()
    setRun(null); setStatus('Computing comparison…')
    const timer = setTimeout(async () => {
      try {
        const relevant = labels.trim() ? labels.split(',').map(s => {
          if (!/^\d+$/.test(s.trim())) throw new Error('Use comma-separated one-based relevant point IDs.')
          return Number(s.trim())-1
        }) : null
        const comparison = await labRequest<Analysis>('compare', {text,target:selected.direction,
          protected:entries.filter(e => protectedNames.includes(e.direction.name)).map(e => e.direction),
          strength,max_drift:drift,min_cosine:cosine,index,relevant,expected_category:category.trim() || null}, controller.signal)
        if (comparison.model_id !== workspace.model_id) throw new Error('Model identity changed. Reopen the lab.')
        if (!controller.signal.aborted) { setRun(comparison); setStatus('') }
      } catch (e) { if (!controller.signal.aborted) setStatus(e instanceof Error ? e.message : 'Comparison failed.') }
    }, 180)
    return () => { clearTimeout(timer); controller.abort() }
  },[text,selected,entries,protectedNames,strength,drift,cosine,index,labels,category,attempt,workspace])
  function add(c: Concept) {
    if (entries.some(e=>e.direction.name===c.direction.name)) throw new Error('Choose a new direction name.')
    if (entries.length>=10) throw new Error('This workspace holds eight custom directions.')
    setEntries([...entries,c]); setTarget(c.direction.name)
  }
  function save() {
    try {
      const stored = savedDirections(workspace.model_id).filter(d => d.name !== target)
      if (stored.length>=8) throw new Error('Saved direction limit reached.')
      localStorage.setItem(storageKey,JSON.stringify([...stored,selected.direction])); setNotice('Direction saved on this browser. Example text was excluded.')
    } catch(e) { setNotice(e instanceof Error ? e.message : 'Save failed.') }
  }
  function forget() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(savedDirections(workspace.model_id).filter(d=>d.name!==target)))
      setEntries(entries.filter(e=>e.direction.name!==target)); setProtected(protectedNames.filter(n=>n!==target))
      setTarget(workspace.presets[0].direction.name); setNotice('Custom direction removed.')
    } catch { setNotice('Local removal failed.') }
  }
  const custom = !workspace.presets.some(p=>p.direction.name===target)
  return <><ConceptEditor workspace={workspace} imported={imported?.texts} add={add}/>
    <section className="panel foundry-panel lab-controls"><h2>Semantic Lock</h2>
    <div className="rank-pair"><div><label>Query text for comparison<textarea maxLength={4096} rows={2} value={text} onChange={e=>setText(e.target.value)}/></label>
    {imported && <label>Use an imported query<select defaultValue="" onChange={e=>setText(documents[Number(e.target.value)])}>
      <option value="" disabled>Choose record</option>{documents.map((s,i)=><option key={i} value={i}>{i+1} · {s.slice(0,50)}</option>)}</select></label>}
    <label>Target direction<select value={target} onChange={e=>setTarget(e.target.value)}>{entries.map(e=><option key={e.direction.name}>{e.direction.name}</option>)}</select></label>
    <fieldset><legend>Protected attributes</legend>{entries.map(e=><label key={e.direction.name}><input type="checkbox" value={e.direction.name} checked={protectedNames.includes(e.direction.name)}
      disabled={!protectedNames.includes(e.direction.name)&&protectedNames.length>=4} onChange={event=>setProtected(event.target.checked?[...protectedNames,e.direction.name]:protectedNames.filter(n=>n!==e.direction.name))}/>{e.direction.name}</label>)}</fieldset></div>
    <div><label>Requested strength · {strength.toFixed(2)}<input type="range" min="-2" max="2" step=".05" value={strength} onChange={e=>setStrength(Number(e.target.value))}/></label>
    <label>Maximum protected drift<input type="number" min="0" max="2" step=".005" value={drift} onChange={e=>setDrift(Number(e.target.value))}/></label>
    <label>Minimum query cosine<input type="number" min="-1" max="1" step=".01" value={cosine} onChange={e=>setCosine(Number(e.target.value))}/></label>
    <details><summary>Relevance and category labels</summary><label>Relevant point IDs<input value={labels} maxLength={10000} onChange={e=>setLabels(e.target.value)} placeholder="7, 10"/></label>
    <label>Expected category<input value={category} maxLength={64} onChange={e=>setCategory(e.target.value)}/></label></details></div></div>
    {selected.validation && <p>Concept validation · {selected.validation.fit} fit, {selected.validation.held_out} held out · balanced accuracy {fmt(selected.validation.balanced_accuracy)} ·
      TP {selected.validation.confusion.tp}, TN {selected.validation.confusion.tn}, FP {selected.validation.confusion.fp}, FN {selected.validation.confusion.fn}.</p>}
    {custom && <div className="foundry-actions"><button onClick={save}>Save direction locally</button><button onClick={forget}>Remove custom direction</button></div>}
    <p role="status">{notice}</p></section>
    {status && <p role="status">{status} {status !== 'Computing comparison…' && <button onClick={()=>setAttempt(v=>v+1)}>Retry comparison</button>}</p>}
    {run && <Results run={run} documents={documents} camera={camera} setCamera={setCamera} selected={point} setSelected={setPoint}/>}</>
}

export default function Intelligence({ imported }: { imported?: ImportIndex }) {
  const [workspace,setWorkspace] = useState<Workspace|null>(null), [error,setError] = useState(''), [retry,setRetry] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    setError('')
    labRequest<Workspace>('workspace',{},c.signal).then(w=>{if(!c.signal.aborted)setWorkspace(w)})
      .catch(e=>{if(!c.signal.aborted)setError(e.message)})
    return ()=>c.abort()
  },[retry])
  return <section className="foundry intelligence"><div className="atlas-intro"><div className="crumb">Research workspace / Phase 2</div>
    <h1>Semantic intelligence</h1><p>Choose what to change, protect a second attribute and measure the tradeoff in the same embedding space.</p></div>
    {workspace ? <Lab workspace={workspace} imported={imported}/> : <p role="status">{error || 'Loading model and development concepts…'} {error && <button onClick={()=>setRetry(n=>n+1)}>Retry</button>}</p>}</section>
}
