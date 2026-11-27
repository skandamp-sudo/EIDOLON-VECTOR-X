import {lazy, Suspense} from 'react'
import Cortex from './convergence/Cortex'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Database, Upload } from 'lucide-react'
import CorpusExplorer from './CorpusExplorer'
import Intelligence from './Intelligence'
import FoundryMap from './FoundryMap'
import type { FoundryPoint } from './FoundryMap'
import { topics } from './explore'
import type { Topic, XYZ } from './explore'
import { downloadFile, exportNeighbors, nearest, quality, requestData } from './foundryData'
import type { Dataset } from './foundryData'
import './foundry.css'

const Studio = lazy(() => import('./Studio'))

type Batch = { model: string; model_id: string; points: (Omit<FoundryPoint, 'row'> | null)[] }
type Steering = { original: number[]; steered: number[]; trajectory: XYZ[]; model_id: string }
const finite = (values: unknown, count: number) => Array.isArray(values) && values.length === count && values.every(Number.isFinite)
const message = (e: unknown) => e instanceof Error ? e.message : 'The local operation failed.'

function Retrieval({ data, points, column, metadata, digest, fingerprint }: {
  data: Dataset; points: FoundryPoint[]; column: number; metadata: number[]; digest: string; fingerprint: string
}) {
  const [row, setRow] = useState(points[0].row)
  const [target, setTarget] = useState<Topic>('Ocean')
  const [strength, setStrength] = useState(1)
  const [run, setRun] = useState<Steering | null>(null)
  const [status, setStatus] = useState('')
  const exporting = useRef<AbortController | null>(null)
  const [exportStatus, setExportStatus] = useState('')
  useEffect(() => () => exporting.current?.abort(), [])
  async function exportVectors() {
    if (exporting.current) return
    const controller = new AbortController()
    exporting.current = controller; setExportStatus('Preparing vector export…')
    try {
      const records = []
      for (let i = 0; i < points.length; i += 64) {
        const batch = points.slice(i, i+64)
        const result = await requestData<{model_id:string; steered:number[][]}>('export', JSON.stringify({
          model_id:digest, target, strength, vectors:batch.map(p => p.vector)
        }), controller.signal)
        if (controller.signal.aborted) return
        if (result.model_id !== digest || result.steered.length !== batch.length || !result.steered.every(v => finite(v,8))) {
          throw new Error('Unexpected vector export response.')
        }
        records.push(...batch.map((p,j) => ({row:p.row+1, original:p.vector, steered:result.steered[j]})))
        setExportStatus(records.length + ' / ' + points.length + ' exported')
      }
      downloadFile('vector-x-embeddings.json', 'application/json', JSON.stringify({dataset_sha256:fingerprint,
        model_id:digest, text_column:data.columns[column], method:'normalized topic centroid steering', target, strength, records}))
      setExportStatus('Vector export ready.')
    } catch(e) { if (!controller.signal.aborted) setExportStatus(message(e)) }
    finally { if (exporting.current === controller) exporting.current = null }
  }
  const [exploring,setExploring] = useState(false)
  const [lab, setLab] = useState(false)
  const imported = useMemo(() => ({modelId:digest, datasetHash:fingerprint, texts:points.map(p => data.rows[p.row][column]), points,
    categories: metadata.length ? points.map(p => data.rows[p.row][metadata[0]]) : undefined}), [fingerprint,digest,data,points,column,metadata])
  useEffect(() => {
    const controller = new AbortController()
    setRun(null); setStatus('Computing retrieval…')
    const timer = setTimeout(async () => {
      try {
        const result = await requestData<Steering>('steer', JSON.stringify({ text: data.rows[row][column], target, strength }), controller.signal)
        if (result.model_id !== digest || !finite(result.original, 8) || !finite(result.steered, 8) ||
            result.trajectory.length !== 25 || !result.trajectory.every(p => finite(p, 3))) throw new Error('Unexpected model response.')
        if (!controller.signal.aborted) { setRun(result); setStatus('') }
      } catch (e) { if (!controller.signal.aborted) setStatus(message(e)) }
    }, 100)
    return () => { controller.abort(); clearTimeout(timer) }
  }, [column, data, digest, row, strength, target])
  const ranks = useMemo(() => run ? [nearest(points, run.original), nearest(points, run.steered)] : [], [points, run])
  return <><div className="foundry-grid">
    <FoundryMap points={points} selected={row} select={setRow} path={run?.trajectory ?? []}/>
    <section className="panel foundry-panel"><h2>Steer an imported record</h2>
      <label htmlFor="source-row">Query record</label><select id="source-row" value={row} onChange={e => setRow(Number(e.target.value))}>
        {points.map(p => <option key={p.row} value={p.row}>Row {p.row + 1} · {data.rows[p.row][column].slice(0, 64)}</option>)}</select>
      <p className="record-text">{data.rows[row][column]}</p>
      {metadata.map(i => <p key={i}>{data.columns[i]} · {data.rows[row][i] || '—'}</p>)}
      <label htmlFor="foundry-target">Steering direction</label><select id="foundry-target" value={target} onChange={e => setTarget(e.target.value as Topic)}>
        {topics.map(t => <option key={t}>{t}</option>)}</select>
      <label htmlFor="foundry-strength">Strength · {strength.toFixed(2)}</label>
      <input id="foundry-strength" type="range" min="-2" max="2" step=".05" value={strength} onChange={e => setStrength(Number(e.target.value))}/>
      <button onClick={() => setStrength(0)}>Reset steering</button><p role="status">{status}</p>
    </section></div>
    <section className="panel foundry-panel"><div className="section-title"><h2>Imported retrieval</h2>
      <button disabled={!run} onClick={() => exportNeighbors(data, column, metadata, ranks)}>Export retrieval CSV</button></div>
      <p>Top three by eight-dimensional cosine. The selected record is included in the index.</p>
      <div className="rank-pair">{ranks.map((list, side) => <div key={side}><h3>{side ? 'Steered' : 'Original'}</h3>
        <ol>{list.map(r => <li key={r.row}>Row {r.row + 1} · {data.rows[r.row][column]} <b>{r.score.toFixed(3)}</b></li>)}</ol></div>)}</div>
      <div className="foundry-actions"><button disabled={!!exporting.current || !run} onClick={() => void exportVectors()}>Export all embedding pairs</button>
        {exporting.current && <button onClick={() => { exporting.current?.abort(); exporting.current=null; setExportStatus('Export cancelled.') }}>Cancel vector export</button>}
        <span role="status">{exportStatus}</span></div>
    </section><button onClick={() => setLab(!lab)}>{lab ? 'Close dataset intelligence' : 'Open dataset intelligence'}</button>
    <button onClick={()=>setExploring(!exploring)}>{exploring?'Close document exploration':'Explore document groups'}</button>
    {exploring && <CorpusExplorer data={data} column={column} points={points} row={row} select={setRow} target={target} strength={strength} model={digest}/>}
    {lab && <Intelligence imported={imported}/>}</>
}

type CachedIndex = {model:string; column:number; points:FoundryPoint[]; processed:number; skipped:number}
type LocalDataset = {name:string; fingerprint:string; data:Dataset; column:number; metadata:number[]; cache?:CachedIndex}

export default function Foundry({ digest }: { digest?: string }) {
  const library = useRef(new Map<string,LocalDataset>())
  const [datasetKey,setDatasetKey] = useState('')
  const [data, setData] = useState<Dataset | null>(null)
  const [name, setName] = useState('')
  const [column, setColumn] = useState(0)
  const [metadata, setMetadata] = useState<number[]>([])
  const [points, setPoints] = useState<FoundryPoint[]>([])
  const [busy, setBusy] = useState<'parse' | 'embed' | null>(null)
  const [progress, setProgress] = useState(0)
  const [unrepresented, setUnrepresented] = useState(0)
  const [completedDigest, setCompletedDigest] = useState('')
  const [note, setNote] = useState('')
  const [over, setOver] = useState(false)
  const active = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const stats = useMemo(() => data && quality(data, column), [data, column])
  useEffect(() => () => active.current?.abort(), [])
  function resetIndex() {
    setPoints([]); setProgress(0); setUnrepresented(0); setCompletedDigest(''); setNote('')
  }
  function cancel() {
    active.current?.abort(); active.current = null; setBusy(null); resetIndex(); setNote('Operation cancelled.')
  }
  function rememberMapping() {
    const current = library.current.get(datasetKey)
    if (current) { current.column = column; current.metadata = metadata }
  }
  function activate(key: string) {
    rememberMapping(); resetIndex(); setDatasetKey(key)
    const stored = library.current.get(key)
    setData(stored?.data ?? null); setName(stored?.name ?? ''); setColumn(stored?.column ?? 0); setMetadata(stored?.metadata ?? [])
    if (stored?.cache && stored.cache.model === digest && stored.cache.column === stored.column) restore(stored.cache)
  }
  function restore(cache: CachedIndex) {
    setPoints(cache.points); setCompletedDigest(cache.model); setProgress(cache.processed); setUnrepresented(cache.skipped)
    setNote('Reused completed local index.')
  }
  function remove() {
    cancel(); library.current.delete(datasetKey); activate(''); setNote('Dataset deleted from this view.')
  }
  async function load(file?: File) {
    if (!file || data || active.current) return
    const kind = file.name.split('.').pop()?.toLowerCase()
    if (!kind || !['csv', 'json', 'jsonl', 'txt'].includes(kind)) { setNote('Choose CSV, JSON, JSONL or TXT.'); return }
    if (file.size > 10_000_000 || !file.size) { setNote('Choose a nonempty file of at most 10 MB.'); return }
    const controller = new AbortController()
    active.current = controller; setNote('Reading and validating locally…'); setBusy('parse')
    try {
      const bytes = await file.arrayBuffer()
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
      if (controller.signal.aborted) return
      const fingerprint = Array.from(hash, b => b.toString(16).padStart(2,'0')).join('')
      const key = kind + ':' + fingerprint
      if (library.current.has(key)) { activate(key); return }
      if (library.current.size >= 2) throw new Error('Delete a dataset before adding another.')
      const parsed = await requestData<Dataset>(kind, file, controller.signal)
      if (!Array.isArray(parsed.columns) || !parsed.columns.length || parsed.columns.length > 32 ||
          !parsed.columns.every(c => typeof c === 'string') || !Array.isArray(parsed.rows) || !parsed.rows.length ||
          parsed.rows.length > 5000 || !parsed.rows.every(r => Array.isArray(r) && r.length === parsed.columns.length && r.every(v => typeof v === 'string'))) {
        throw new Error('Unexpected dataset response.')
      }
      if (controller.signal.aborted) return
      library.current.set(key, {name:file.name, fingerprint, data:parsed, metadata:[],
        column:Math.max(0, parsed.columns.findIndex(c => c.toLowerCase() === 'text'))})
      activate(key)
      setNote('Preview ready. Choose the fields to use.')
    } catch (e) { if (!controller.signal.aborted) setNote(message(e)) }
    finally { if (active.current === controller) { active.current = null; setBusy(null) } }
  }
  async function generate() {
    const stored = library.current.get(datasetKey)
    if (!stored || !data || !stats || !digest || active.current) return
    if (stored.cache?.model === digest && stored.cache.column === column) { restore(stored.cache); return }
    const controller = new AbortController()
    active.current = controller; resetIndex(); setBusy('embed')
    const collected: FoundryPoint[] = []
    let skipped = 0
    try {
      for (let i = 0; i < stats.indices.length; i += 64) {
        const batch = stats.indices.slice(i, i + 64)
        const result = await requestData<Batch>('embed', JSON.stringify(batch.map(r => data.rows[r][column])), controller.signal)
        if (controller.signal.aborted) return
        if (result.model_id !== digest || result.model !== 'TF–IDF / LSA' || result.points.length !== batch.length) {
          throw new Error('Model or batch identity changed. Retry the import.')
        }
        result.points.forEach((point, j) => {
          if (point === null) { skipped++; return }
          if (!finite(point.vector, 8) || !finite(point.xyz, 3)) throw new Error('Invalid embedding response.')
          collected.push({ ...point, row: batch[j] })
        })
        setProgress(i + batch.length); setUnrepresented(skipped)
      }
      stored.cache = {model:digest, column, points:collected, processed:stats.indices.length, skipped}
      setPoints(collected); setCompletedDigest(digest)
      setNote(collected.length ? 'Index ready.' : 'No mapped records contain known model vocabulary.')
    } catch (e) { if (!controller.signal.aborted) { resetIndex(); setNote(message(e)) } }
    finally { if (active.current === controller) { active.current = null; setBusy(null) } }
  }
  const [debug,showDebug]=useState(false)
  const [reader,showReader]=useState(false)
  const fingerprint = library.current.get(datasetKey)?.fingerprint ?? ''
  function exportQuality() {
    if (!stats || !data) return
    const measured = !!completedDigest && completedDigest === digest
    downloadFile('vector-x-quality.json','application/json',JSON.stringify({dataset_sha256:fingerprint, model_id:digest,
      text_column:data.columns[column], metadata:metadata.map(i=>data.columns[i]), records:data.rows.length,
      columns:data.columns.map((name,i)=>({name, missing:data.rows.filter(row=>!row[i].trim()).length})),
      missing_text:stats.missing, duplicate_nonempty_rows:stats.duplicates, eligible:stats.indices.length,
      represented:measured?points.length:null, unrepresented:measured?unrepresented:null},null,2))
  }
  return <section className="foundry"><div className="atlas-intro"><div className="crumb"><Database size={15}/> Research workspace <span>/</span> Local datasets</div>
    <h1>Data Foundry</h1><p>Map a local dataset, inspect its embeddings and steer retrieval across your records.</p></div>
    {library.current.size > 0 && <div className="dataset-switch"><label>Session dataset<select value={datasetKey} disabled={!!busy} onChange={e=>activate(e.target.value)}>
      <option value="" disabled>Choose dataset</option>{[...library.current].map(([key,d])=><option key={key} value={key}>{d.name} · {d.fingerprint.slice(0,8)}</option>)}</select></label>
      {data && library.current.size<2 && <button disabled={!!busy} onClick={()=>activate('')}>Import another dataset</button>}</div>}
    {!data && <div className={'drop-zone' + (over ? ' over' : '')}
      onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length === 1) void load(e.dataTransfer.files[0]); else setNote('Choose one dataset at a time.') }}>
      <p className="kicker">Local import</p><Upload size={32}/><h2>Drop a dataset here</h2><p>UTF-8 CSV, JSON, JSONL or TXT · 10 MB · 5,000 records</p>
      <button className="encode" disabled={!!busy || !digest} onClick={() => fileInput.current?.click()}>Choose file</button>
      <input ref={fileInput} aria-label="Dataset file" hidden type="file" accept=".csv,.json,.jsonl,.txt" onChange={e => { void load(e.target.files?.[0]); e.target.value = '' }}/>
      <small>Encoder · {digest?'8D calibration LSA':'Unavailable'}</small><small>Processed on this computer. Leaving Data Foundry clears the imported dataset.</small>
    </div>}
    {data && stats && <><section className="panel foundry-panel"><div className="section-title"><div><Database size={18}/><h2>{name}</h2></div>
      <button onClick={remove}>Delete dataset</button></div>
      <details><summary>Dataset identity and quality</summary><p>SHA-256 · {fingerprint}</p><p>Model basis · {digest ?? 'Unavailable'}</p>
        <button onClick={exportQuality}>Export quality report</button></details>
      <div className="foundry-stats"><span><b>{data.rows.length}</b> records</span><span><b>{data.columns.length}</b> columns</span>
        <span><b>{stats.missing}</b> missing text</span><span><b>{stats.duplicates}</b> duplicate records</span></div>
      <div className="foundry-grid"><div><label htmlFor="text-field">Text column</label>
        <select id="text-field" value={column} disabled={!!busy} onChange={e => { const i = Number(e.target.value); setColumn(i); setMetadata(m => m.filter(c => c !== i)); resetIndex() }}>
          {data.columns.map((c, i) => <option key={i} value={i}>{c}</option>)}</select></div>
        <fieldset><legend>Metadata columns</legend>{data.columns.map((c, i) => i !== column && <label key={i}><input type="checkbox" checked={metadata.includes(i)}
          onChange={e => setMetadata(m => e.target.checked ? [...m, i] : m.filter(v => v !== i))}/>{c}</label>)}</fieldset></div>
      <div className="preview-scroll" tabIndex={0} aria-label="Dataset preview"><table><caption>First {Math.min(5, data.rows.length)} records</caption>
        <thead><tr>{data.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{data.rows.slice(0, 5).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v || '—'}</td>)}</tr>)}</tbody></table></div>
      <p>TF–IDF / LSA · 8 dimensions · frozen calibration model. Empty text and exact duplicate rows are skipped. Unknown vocabulary can leave a record without a vector.</p>
      <div className="foundry-actions"><button className="encode" disabled={!!busy || !digest || !stats.indices.length} onClick={() => void generate()}>Generate embeddings</button>
        {(busy === 'embed' || completedDigest) && <><progress aria-label="Processed records" value={progress} max={stats.indices.length}/>
          <span>{progress} / {stats.indices.length} processed · {unrepresented} unrepresented</span></>}</div>
    </section></>}
    <div className="foundry-feedback" role="status">{!digest ? 'Embedding runtime unavailable.' : note}
      {busy && <button onClick={cancel}>Cancel operation</button>}</div>
    {data && digest && stats && <section className="panel foundry-panel"><h2>Retrieval debugging</h2>
      <p>Use the mapped text and original row IDs. Lexical retrieval can include records the dense encoder cannot represent.</p>
      {stats.indices.length>256?<p>The debugger accepts up to 256 eligible documents. Import a smaller collection to use this workflow.</p>:<button disabled={!stats.indices.length} onClick={()=>showDebug(!debug)}>{debug?'Close retrieval debugger':'Debug this dataset'}</button>}
      {debug && stats.indices.length>0 && stats.indices.length<=256 && <Suspense fallback={<p>Loading debugger…</p>}><Studio key={fingerprint+':'+column} modelId={digest} imported={{fileHash:fingerprint,column:data.columns[column],documents:stats.indices.map(i=>({id:i+1,text:data.rows[i][column]}))}}/></Suspense>}</section>}
    {data&&<><button onClick={()=>showReader(v=>!v)}>{reader?'Close research reader':'Open research reader'}</button>{reader&&<Cortex key={fingerprint+column} source={name} rows={data.rows.map(r=>r[column])}/>}</>}
    {data && points.length > 0 && digest === completedDigest && <Retrieval key={datasetKey + column + completedDigest} fingerprint={fingerprint} data={data} points={points} column={column} metadata={metadata} digest={completedDigest}/>}
  </section>
}
