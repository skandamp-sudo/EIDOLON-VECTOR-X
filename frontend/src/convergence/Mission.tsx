import {useRef,useState} from 'react'
import {ArrowUpRight, Boxes, GitBranch, Hexagon, Network, ScanText, SlidersHorizontal} from 'lucide-react'
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
const purposes=['Trace claims to source passages','Plan stock against delivery dates','Review a steering recommendation','Compare navigation preferences','Change an embedding direction','Resolve competing interpretations']
export default function Mission({data}:{data:Foundation|null}){
 const guide=useRef<HTMLSelectElement>(null)
 const [selected,select]=useState(lastStage)
 const setSelected=(value:number)=>{lastStage=value;select(value)}
 const [title,ps,task,evidence]=missions[selected]
 return <section className="foundry intelligence mission-page"><div className="mission-hero"><div><p className="kicker">EIDOLON / VECTOR-X</p><h1>Mission Control</h1><p>Semantic Search Engineering and Debugging Studio. Trace missed documents, compare retrieval methods and gate changes against your judgments.</p><div className="hero-actions"><a className="studio-primary" href="#retrieval-debugger">Open Retrieval Debugger <ArrowUpRight size={15}/></a><button onClick={()=>{setSelected(0);guide.current?.focus()}}>Start Guided Demo</button><a href="#vector-x">Explore Semantic Universe <ArrowUpRight size={15}/></a></div></div>
 <figure className="probe-chart"><figcaption>Live calibration signatures <small>{data?data.dimensions+' coefficients':'Runtime unavailable'}</small></figcaption>{data&&<><svg viewBox="0 0 400 132" role="img" aria-label="Signed embedding coefficients by dimension for the live calibration probes">{[-1,-.5,0,.5,1].map(v=><line key={v} x1="8" x2="392" y1={66-55*v} y2={66-55*v} stroke="#293548"/>)}{data.samples.map((s,i)=><polyline key={s.id} points={s.vector.map((v,j)=>(10+j*380/(s.vector.length-1))+','+(66-v*55)).join(' ')} stroke={['#2DD4BF','#A78BFA','#60A5FA'][i%3]} strokeWidth="2.5" fill="none"><title>{s.id}: {s.vector.map(v=>v.toFixed(3)).join(', ')}</title></polyline>)}</svg><div className="chart-key">{data.samples.map((s,i)=><span key={s.id} style={{borderColor:['#2DD4BF','#A78BFA','#60A5FA'][i%3]}}>{s.id}</span>)}</div></>}</figure></div> <nav className="suite-nav" aria-label="Mission destinations">{['Mission Control','CORTEX','SUPPLY','SYMBIOSIS','MORPH','VECTOR-X','CLARITY','Data Foundry','Research Lab','Evidence Vault'].map(s=><a href={href(s)} key={s}>{s}</a>)}</nav>
 <section className="panel foundry-panel"><p className="kicker">Step {selected+1} / 6</p><h2>Guided application demonstrations</h2><label>Scenario stage<select ref={guide} value={selected} onChange={e=>setSelected(+e.target.value)}>{missions.map(([m,p],i)=><option key={m} value={i}>{p} · {m}</option>)}</select></label>
 <h3>{ps} · {title}</h3><p>{task}</p><p>{evidence}</p><a className="suite-link" href={href(title)}>Open {title} workspace →</a>
 <div className="foundry-actions"><button disabled={!selected} onClick={()=>setSelected(selected-1)}>Previous stage</button><button disabled={selected===5} onClick={()=>setSelected(selected+1)}>Next stage</button></div></section>
 <section className="panel foundry-panel"><h2>Verification and limits</h2><div className="mission-directory">{missions.map(([m,p,,e],i)=>{const Icon=icons[i];return <a href={href(m)} key={m}><Icon size={20}/><div><small>{p}{i===4?' · Primary experiment':''}</small><h3>{m}</h3><p>{purposes[i]}</p><small>{e}</small></div><ArrowUpRight size={16}/></a>})}</div>
 <p>Semantic retrieval and steering share the calibration runtime. Inventory allocation uses the event ledger. Model-specific evidence is available in the Evidence Vault. Public inference uses the 8D encoder. The four local encoders can be probed in Research Lab when their verified artifacts are installed.</p></section></section>
}
