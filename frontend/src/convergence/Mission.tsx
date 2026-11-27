import {useRef,useState} from 'react'
import {ArrowUpRight, Boxes, GitBranch, Hexagon, Network, ScanText, SlidersHorizontal} from 'lucide-react'
import {startTour,tourAction} from '../tourState'
import type {Foundation} from '../runtime'
const missions=[
 ['CORTEX','PS-01','Read the coastal field notes. Compare the gauge and pressure-sensor reports, then mark the supporting passages.','Four authored study documents. Participant comprehension and decision effects are unmeasured.'],
 ['SUPPLY','PS-02','Delay the membrane shipment. Trace the first late order to the incoming lot and review a shortage proposal.','Six simulated order snapshots. CRD precision and recall 1.0, reactive recall 0. Three early warnings.'],
 ['SYMBIOSIS','PS-03','Protect a second concept while steering a query. Inspect the measured drift, approve a feasible preview and undo it.','Control paths checked in Chrome. Perceived control and trust await participants.'],
 ['MORPH','PS-04','Opt into tab-local learning. Accept a shortcut to a workspace used in the investigation, then compare the static layout.','Actual rewards drive the ranking. Human navigation efficiency is unmeasured.'],
 ['VECTOR-X','PS-05','Steer the field observation toward Ocean. Inspect the change in nearest documents, retained cosine and projection fidelity.','Recorded QASPER nDCG@3 on 15 labeled questions: BM25 0.223, expanded LSA 0.144, MiniLM 0.020.'],
 ['CLARITY','PS-06','Inspect “Compare waves near the bank”. Resolve the meaning of each cue and compare the retrieved passages.','Six authored positive constructions and two unambiguous controls. Independent generalization is unmeasured.']
] as const
const href=(s:string)=>'#'+s.toLowerCase().replaceAll(' ','-')
let lastStage=0
const icons=[Network,Boxes,GitBranch,SlidersHorizontal,Hexagon,ScanText]
const purposes=['Explore research and documents','Understand inventory and delivery risks','Review AI-generated recommendations','Personalize your interface','Explore and control AI search results','Resolve confusing language']
export default function Mission({data}:{data:Foundation|null}){
 const guide=useRef<HTMLSelectElement>(null)
 const [selected,select]=useState(lastStage)
 const setSelected=(value:number)=>{lastStage=value;select(value)}
 const [title,ps,task,evidence]=missions[selected]
 return <section className="foundry intelligence mission-page"><div className="mission-hero"><div><h2 className="kicker">Mission Control</h2><h1>Six intelligent tools.<br/>One verifiable intelligence platform.</h1><p>Try a real task, see what changes, and inspect the evidence behind the result.</p><div className="hero-actions"><button className="studio-primary" data-tour="mission-start" onClick={()=>startTour("Introduction")}>Start interactive walkthrough</button><a href="#vector-x">Try VECTOR-X</a><button onClick={()=>document.getElementById("tool-directory")?.focus()}>Explore all tools</button></div><div className="hero-actions secondary-actions"><a className="studio-primary" href="#retrieval-debugger">Open Retrieval Debugger <ArrowUpRight size={15}/></a><button onClick={()=>{setSelected(0);guide.current?.focus()}}>Start Guided Demo</button><a href="#vector-x">Explore Semantic Universe <ArrowUpRight size={15}/></a></div></div>
 <figure className="probe-chart"><figcaption>Live calibration signatures <small>{data?data.dimensions+' coefficients':'Runtime unavailable'}</small></figcaption>{data&&<><svg viewBox="0 0 400 132" role="img" aria-label="Signed embedding coefficients by dimension for the live calibration probes">{[-1,-.5,0,.5,1].map(v=><line key={v} x1="8" x2="392" y1={66-55*v} y2={66-55*v} stroke="#293548"/>)}{data.samples.map((s,i)=><polyline key={s.id} points={s.vector.map((v,j)=>(10+j*380/(s.vector.length-1))+','+(66-v*55)).join(' ')} stroke={['#2DD4BF','#A78BFA','#60A5FA'][i%3]} strokeWidth="2.5" fill="none"><title>{s.id}: {s.vector.map(v=>v.toFixed(3)).join(', ')}</title></polyline>)}</svg><div className="chart-key">{data.samples.map((s,i)=><span key={s.id} style={{borderColor:['#2DD4BF','#A78BFA','#60A5FA'][i%3]}}>{s.id}</span>)}</div></>}</figure></div> <section id="tool-directory" data-tour="mission-tools" tabIndex={-1}><h2>Choose a tool</h2><div className="mission-directory">{missions.map(([m,p],i)=>{const Icon=icons[i];return <a className={"tool-"+m.toLowerCase()} href={href(m)} key={m}><Icon size={20}/><div><small>{p}{i===4?' · Primary experiment':''}</small><h3>{purposes[i]}</h3><p>{m}</p></div><ArrowUpRight size={16}/></a>})}</div>
 </section> <nav className="suite-nav" aria-label="Mission destinations">{['Mission Control','CORTEX','SUPPLY','SYMBIOSIS','MORPH','VECTOR-X','CLARITY','Data Foundry','Research Lab','Evidence Vault'].map(s=><a href={href(s)} key={s}>{s}</a>)}</nav>
 <nav aria-label="Judge resources" className="view-nav"><a data-tour="mission-flow" onClick={()=>tourAction("open-flow")} href="#system-flow">System Flow &amp; Architecture</a><a href="#guided-demo">Guided judge demo</a><a href="#architecture">Foundation architecture</a><a href="#evidence-vault">Evidence Vault</a></nav>
 <details className="panel foundry-panel"><summary>First retrieval investigation</summary><ol><li>Open the Retrieval Debugger and select a known relevant document.</li><li>Compare the original ranking with the candidate and inspect missed IDs.</li><li>Check the release decision, export the report and replay it against the same local model.</li></ol><a href="#retrieval-debugger">Start a labeled comparison →</a></details>
 <section className="panel foundry-panel"><p className="kicker">Step {selected+1} / 6</p><h2>Guided application demonstrations</h2><label>Scenario stage<select ref={guide} value={selected} onChange={e=>setSelected(+e.target.value)}>{missions.map(([m,p],i)=><option key={m} value={i}>{p} · {m}</option>)}</select></label>
 <h3>{ps} · {title}</h3><p>{task}</p><p>{evidence}</p><a className="suite-link" href={href(title)}>Open {title} workspace →</a>
 <div className="foundry-actions"><button disabled={!selected} onClick={()=>setSelected(selected-1)}>Previous stage</button><button disabled={selected===5} onClick={()=>setSelected(selected+1)}>Next stage</button></div></section>
 </section>
}
