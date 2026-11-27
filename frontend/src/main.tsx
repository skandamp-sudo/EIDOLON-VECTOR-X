import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig, motion } from 'framer-motion'
import { Activity, Layers3, Cpu, ChevronDown, ChevronRight, Fingerprint, X, BookOpen, Workflow, LayoutGrid, Hexagon } from 'lucide-react'
import Viewport from './Viewport'
import { useRuntime } from './runtime'
import { modules, protocol } from './content'
import './style.css'

const pages = ['Overview', 'Architecture', 'Protocol'] as const
type Page = typeof pages[number]
const pageFromHash = (): Page => pages.find(p => '#' + p.toLowerCase() === location.hash) ?? 'Overview'
function App() {
  const { data, status } = useRuntime()
  const [page, setPage] = useState<Page>(pageFromHash)
  const [index, setIndex] = useState(0)
  const [detail, setDetail] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const sample = data?.samples[index] ?? data?.samples[0]
  useEffect(() => {
    const update = () => setPage(pageFromHash())
    window.addEventListener('hashchange',update)
    return () => window.removeEventListener('hashchange',update)
  }, [])
  useEffect(() => { if (detail !== null) dialog.current?.showModal() }, [detail])
  const moduleList = <div className="module-grid">{modules.map((m,i) => <button className="module" key={m.name} onClick={() => setDetail(i)}>
    <span className={'module-icon tint'+i}><m.icon size={19}/></span><span><strong>{m.name}</strong><small>{m.brief}</small></span><ChevronRight className="disclose" size={15}/>
  </button>)}</div>
  return <MotionConfig reducedMotion="user"><a className="skip" href="#workspace">Skip to workspace</a>
    <header><div className="topbar"><div className="brand"><img src="/mark.svg" alt=""/><b>EIDOLON</b><span className="brand-divider"/><span>VECTOR-X</span></div>
      <nav aria-label="Workspace">{pages.map((p,i) => { const Icon = [LayoutGrid, Workflow, BookOpen][i]; return <a key={p} href={'#'+p.toLowerCase()} aria-current={page === p ? 'page' : undefined}><Icon size={15}/>{p}</a> })}</nav>
      <div role="status" className={'connection '+status.toLowerCase()}><i/> API {status.toLowerCase()}</div></div></header>
    <main id="workspace"><div className="crumb"><Hexagon size={14}/> Workspace <ChevronRight size={13}/> <span>Mission 001</span></div>
    <div className="intro"><div><h1>{page === 'Overview' ? 'Research overview' : page === 'Protocol' ? 'Evaluation protocol' : 'System architecture'}</h1>
      <p>{page === 'Overview' ? 'Inspect the embedding backbone and explore its vector signatures.' : page === 'Protocol' ? 'The evaluation design for held-out steering experiments.' : 'The foundation runtime and the six planned research modules.'}</p></div>
      <span className="mission"><span/> Foundation</span></div>
    {page === 'Overview' ? <>
      <div className="workspace-grid"><Viewport sample={sample} status={status}/>
      <aside className="panel inspector"><div className="panel-head"><div className="panel-title"><Activity size={18}/><h2>Runtime inspector</h2></div></div>
        <div className="inspect-body"><div className="label"><Cpu size={14}/> Embedding backbone</div><div className="model-name">{data?.backbone ?? 'Unavailable'}</div>
          <div className="specs"><div><b>{data?.dimensions ?? '—'}</b><span>Dimensions</span></div><div><b>{data?.documents ?? '—'}</b><span>Fit documents</span></div><div><b>{data?.seed ?? '—'}</b><span>Fit seed</span></div></div>
          <label className="label" htmlFor="sample"><Fingerprint size={14}/> Calibration probe</label>
          <div className="select"><select id="sample" value={sample ? index : ''} disabled={!data} onChange={e => setIndex(Number(e.target.value))}>
            {data ? data.samples.map((s,i) => <option value={i} key={s.id}>{s.id[0].toUpperCase()+s.id.slice(1)} sample</option>) : <option value="">Awaiting samples</option>}</select><ChevronDown size={14}/></div>
          <p className="sentence">{sample ? '“'+sample.text+'”' : 'The runtime supplies the sample text.'}</p>
          <details className="coeff"><summary>Inspect coefficients</summary><ol>{sample?.vector.map((v,i) => <li key={i}><span>D{i+1}</span> {v.toFixed(4)}</li>)}</ol></details>
        </div></aside></div>
      <section className="directory"><div className="section-title"><div><Layers3 size={19}/><h2>Research modules</h2></div><span>Architecture preview</span></div>{moduleList}</section>
    </> : page === 'Architecture' ? <section className="read-page"><h2>Foundation runtime</h2><p>A same-origin Vite proxy connects the workspace to a loopback FastAPI service. At startup, the service fits a seeded latent semantic analysis model on the local calibration corpus and encodes three sample texts.</p>
      <h2>Signature geometry</h2><p>Eight angular sectors correspond to eight signed coefficients. Tube radius interpolates between adjacent coefficients. Color and twist are fixed styling. The surface describes one embedding at a time.</p><h2>Planned modules</h2>{moduleList}</section>
      : <section className="read-page"><p className="protocol-status">Held-out evaluation pending</p>{protocol.map(([title,body]) => <article key={title}><h2>{title}</h2><p>{body}</p></article>)}</section>}
    <footer><span><img src="/mark.svg" alt=""/> EIDOLON VECTOR-X</span><span>RESURRECT 2026 <i/> PS-05</span></footer></main>
    <dialog ref={dialog} onClose={() => setDetail(null)} aria-labelledby="detail-title" onClick={e => { if (e.target === dialog.current) dialog.current.close() }}>
      {detail !== null && <motion.div initial={{opacity: 0}} animate={{opacity: 1}}><button className="close" aria-label="Close module details" onClick={() => dialog.current?.close()}><X/></button><div className="label">Planned module</div><h2 id="detail-title">{modules[detail].name}</h2><p>{modules[detail].detail}</p></motion.div>}
    </dialog></MotionConfig>
}
createRoot(document.getElementById('root')!).render(<App/>)
