import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig, motion } from 'framer-motion'
import { Activity, Layers3, Cpu, ChevronDown, ChevronRight, Fingerprint, X, BookOpen, Workflow, LayoutGrid, Hexagon, Database } from 'lucide-react'
import { hosted } from './apiOrigin'
import Viewport from './Viewport'
import Atlas from './Atlas'
import Foundry from './Foundry'
import Intelligence from './Intelligence'
import { useRuntime } from './runtime'
import { modules, protocol } from './content'
import {SystemFlow,GuidedDemo,WorkspaceGuide,FlagshipSteps} from './Judge'
import WorkspaceShell from './WorkspaceShell'
import './style.css'
import './obsidian.css'
import './intuitive.css'
import Walkthrough from './Walkthrough'

const AtlasPreferences = lazy(() => import('./convergence/Morph').then(mod=>({default:mod.AtlasPreferences})))
const Studio = lazy(() => import('./Studio'))
const Mission = lazy(() => import('./convergence/Mission'))
const Applications = lazy(() => import('./Applications'))
const Research = lazy(() => import('./Research'))
const pages = ['Atlas', 'Data Foundry', 'Intelligence', 'Research Lab', 'Applications', 'Overview', 'Architecture', 'Protocol', 'System Flow', 'Guided Demo', 'Retrieval Debugger', 'Mission Control'] as const
const domains = ['CORTEX','CLARITY','SUPPLY','MORPH','SYMBIOSIS'] as const
const routes = [...pages,...domains,'VECTOR-X','Evidence Vault'] as const
type Page = typeof routes[number]
const pageFromHash = (): Page => routes.find(p => '#' + p.toLowerCase().replace(' ', '-') === location.hash.split('?')[0]) ?? (location.hash ? 'Atlas' : 'Mission Control')
function App() {
  const { data, status, retry } = useRuntime()
  const [page, setPage] = useState<Page>(pageFromHash)
  const directStep=domains.findIndex(d=>d===page)
  const [index, setIndex] = useState(0)
  const [detail, setDetail] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const previousPage = useRef(page)
  const sample = status==='Connected' ? data?.samples[index] ?? data?.samples[0] : undefined
  useEffect(() => {
    const update = () => setPage(pageFromHash())
    window.addEventListener('hashchange',update)
    return () => window.removeEventListener('hashchange',update)
  }, [])
  useEffect(() => {
    document.title = page + ' · EIDOLON VECTOR-X'
    if (previousPage.current !== page) document.getElementById('workspace')?.focus()
    previousPage.current = page
  }, [page])
  useEffect(() => { if (detail !== null) dialog.current?.showModal() }, [detail])
  const moduleList = <div className="module-grid">{modules.map((m,i) => <button className="module" key={m.name} onClick={() => setDetail(i)}>
    <span className={'module-icon tint'+i}><m.icon size={19}/></span><span><strong>{m.name}</strong><small>{m.brief}</small></span><ChevronRight className="disclose" size={15}/>
  </button>)}</div>
  return <MotionConfig reducedMotion="user"><a className="skip" href="#workspace" onClick={e => { e.preventDefault(); document.getElementById('workspace')?.focus() }}>Skip to workspace</a>
    <WorkspaceShell page={page} data={data} status={status}/>
    <main id="workspace" tabIndex={-1}><Walkthrough page={page}/>{status==='Unavailable' && <aside className="connection-notice" role="status">{data?'Connection interrupted. Showing the last verified model snapshot.':'Model service unavailable.'} <button onClick={retry}>Retry connection</button></aside>}{hosted && <p className="hosted-notice">Public research demo · query text is processed on Railway. Use the local workspace for personal datasets.</p>}{(directStep>=0||page==='VECTOR-X')&&<WorkspaceGuide name={page}/>}
    {(page==='VECTOR-X'||page==='Retrieval Debugger')&&<FlagshipSteps/>}
    {page==='System Flow'?<SystemFlow/>:page==='Guided Demo'?<GuidedDemo/>:page==='Retrieval Debugger'?<Suspense fallback={<p>Loading retrieval debugger…</p>}>{data?<Studio key={data.model_id} modelId={data.model_id}/>:<p role="status">Waiting for the embedding runtime</p>}</Suspense>:page==='Mission Control'?<Suspense fallback={<p>Loading mission…</p>}><Mission data={data}/></Suspense>:page==='Applications'||directStep>=0?<Suspense fallback={<p>Loading applications…</p>}><Applications key={page} online={!!data} initialStep={Math.max(0,directStep)} direct={directStep>=0}/></Suspense>:page==='Research Lab'||page==='Evidence Vault'?<Suspense fallback={<p>Loading research lab…</p>}><Research online={!!data} vaultOnly={page==='Evidence Vault'}/></Suspense>:page==='Intelligence'?(data?<Intelligence/>:<p role="status">Waiting for embedding runtime</p>):page==='Data Foundry'?(hosted?<section><h1>Data Foundry</h1><p>Hosted file imports are disabled. Open the local workspace to process datasets on your computer.</p><p>From the project directory run <code>./scripts/start</code>, then open <code>http://localhost:5173/#data-foundry</code>.</p></section>:<Foundry digest={data?.model_id}/>):page==='Atlas'||page==='VECTOR-X'?<>{page==='VECTOR-X'&&<nav className="suite-nav" aria-label="Semantic tools"><a href="#intelligence">Concepts and Semantic Lock</a><a href="#data-foundry">Imported dataset steering</a><a href="#research-lab">Compare encoders</a><a href="#evidence-vault">Experimental evidence</a></nav>}<Atlas online={!!data}/>{page==='VECTOR-X'&&<Suspense fallback={null}><AtlasPreferences/></Suspense>}</>:<><div className="crumb"><Hexagon size={14}/> Workspace <ChevronRight size={13}/> <span>Phase 1</span></div>
    <div className="intro"><div><h1>{page === 'Overview' ? 'Mission Control' : page === 'Protocol' ? 'Evaluation protocol' : 'System architecture'}</h1>
      <p>{page === 'Overview' ? 'Inspect the embedding backbone and explore its vector signatures.' : page === 'Protocol' ? 'The evaluation design for held-out steering experiments.' : 'The local runtime, active baselines and planned research modules.'}</p></div>
      <span className="mission"><span/> Foundation</span></div>
    {page === 'Overview' ? <>
      <div className="workspace-grid"><Viewport sample={sample} status={status}/>
      <aside className="panel inspector"><div className="panel-head"><div className="panel-title"><Activity size={18}/><h2>Runtime inspector</h2></div></div>
        <div className="inspect-body"><div className="label"><Cpu size={14}/> Embedding backbone</div><div className="model-name">{data?.backbone ?? 'Unavailable'}</div>
          <div className="specs"><div><b>{data?.dimensions ?? '—'}</b><span>Dimensions</span></div><div><b>{data?.documents ?? '—'}</b><span>Fit documents</span></div><div><b>{data?.seed ?? '—'}</b><span>Fit seed</span></div></div>
          <label className="label" htmlFor="sample"><Fingerprint size={14}/> Calibration probe</label>
          <div className="select"><select id="sample" value={sample ? index : ''} disabled={status!=='Connected'} onChange={e => setIndex(Number(e.target.value))}>
            {data ? data.samples.map((s,i) => <option value={i} key={s.id}>{s.id[0].toUpperCase()+s.id.slice(1)} sample</option>) : <option value="">Awaiting samples</option>}</select><ChevronDown size={14}/></div>
          <p className="sentence">{sample ? '“'+sample.text+'”' : 'The runtime supplies the sample text.'}</p>
          <details className="coeff"><summary>Inspect coefficients</summary><ol>{sample?.vector.map((v,i) => <li key={i}><span>D{i+1}</span> {v.toFixed(4)}</li>)}</ol></details>
        </div></aside></div>
      <section className="directory"><div className="section-title"><div><Layers3 size={19}/><h2>Research modules</h2></div><span>Architecture preview</span></div>{moduleList}</section>
    </> : page === 'Architecture' ? <section className="read-page"><h2>Foundation runtime</h2><p>A same-origin Vite proxy connects the workspace to a loopback FastAPI service. At startup, the service fits a seeded latent semantic analysis model on the local calibration corpus and encodes three sample texts.</p>
      <h2>Signature geometry</h2><p>Eight angular sectors correspond to eight signed coefficients. Tube radius interpolates between adjacent coefficients. Color and twist are fixed styling. The surface describes one embedding at a time.</p><h2>Research modules</h2>{moduleList}</section>
      : <section className="read-page"><p className="protocol-status">External evaluation recorded in Research Lab</p>{protocol.map(([title,body]) => <article key={title}><h2>{title}</h2><p>{body}</p></article>)}</section>}
    </>}<footer><span><img src="/mark.svg" alt=""/> EIDOLON VECTOR-X</span><span>RESURRECT 2026 <i/> PS-05</span></footer></main>
    <dialog ref={dialog} onClose={() => setDetail(null)} aria-labelledby="detail-title" onClick={e => { if (e.target === dialog.current) dialog.current.close() }}>
      {detail !== null && <motion.div initial={{opacity: 0}} animate={{opacity: 1}}><button className="close" aria-label="Close module details" onClick={() => dialog.current?.close()}><X/></button><div className="label">{modules[detail].status}</div><h2 id="detail-title">{modules[detail].name}</h2><p>{modules[detail].detail}</p></motion.div>}
    </dialog></MotionConfig>
}
createRoot(document.getElementById('root')!).render(<App/>)
