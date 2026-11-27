import {useState, useSyncExternalStore} from 'react'
import GraphCanvas,{type GraphNode,type GraphEdge} from './GraphCanvas'
import {startTour} from './tourState'
import flows from './workflows.json'
import {hosted} from './apiOrigin'
import './judge.css'

type Flow=typeof flows[number]
const primary=flows[4]
const root='https://github.com/skandamp-sudo/EIDOLON-VECTOR-X/blob/66b02ed446b20adb6eb9cebb152f730adee28c49/'
const route=(flow:Flow)=>'#'+flow.name.toLowerCase()
const flowLink=(flow:Flow,view='workflows')=>'#system-flow?view='+view+'&ps='+flow.id
const vault=(flow:Flow)=>'#evidence-vault?ps='+flow.id
const sub=(fn:()=>void)=>{window.addEventListener('hashchange',fn);return ()=>window.removeEventListener('hashchange',fn)}
function useParams(){return new URLSearchParams(useSyncExternalStore(sub,()=>location.hash).split('?')[1])}
function match(id:string|null){return flows.find(f=>f.id===id)??primary}
function FlowSelect({flow,onChange}:{flow:Flow;onChange:(f:Flow)=>void}){
 return <label>Problem statement<select value={flow.id} onChange={e=>onChange(match(e.target.value))}>{flows.map(f=><option key={f.id} value={f.id}>{f.id} · {f.name}</option>)}</select></label>
}
export function WorkspaceGuide({name}:{name:string}){
 const f=flows.find(x=>x.name===name)
 if(!f)return null
 return <details className={'judge-context '+f.id}><summary>{f.id} · Workflow and evidence</summary><p><strong>{f.official}.</strong> {f.user}</p><p>Input · {f.nodes[0].input}. Output · {f.nodes.at(-1)?.output}.</p><p>{f.metrics}</p><p>{f.limit}</p>
 <nav><a href={flowLink(f)}>View system flow</a><a href={flowLink(f,'technical')}>Technical details</a><a href={vault(f)}>Inspect evidence</a><a href="#guided-demo">Guided demo</a></nav></details>
}
export function FlagshipSteps(){
 return <nav className="stage-links" aria-label="Flagship workflow">{[['Dataset','data-foundry'],['Encoder','retrieval-debugger'],['Embed','vector-x'],['Explore','atlas'],['Steer','vector-x'],['Protect','intelligence'],['Evaluate','retrieval-debugger'],['Export','retrieval-debugger']].map(([label,path],i)=><a key={label} href={'#'+path}><small>{i+1}</small> {label}</a>)}</nav>
}
const positions:Record<string,number[][]>={
 PS01:[[0,0],[1,0],[2,0],[2,1],[1,1],[2,2],[1,2]],
 PS02:[[0,0],[1,0],[2,0],[2,1],[3,1],[1,1],[1,2],[0,2],[2,2]],
 PS03:[[0,0],[1,0],[2,0],[2,1],[1,1],[0,1],[1,2],[0,2]],
 PS04:[[0,0],[0,1],[1,0],[2,0],[2,1],[1,1],[1,2],[0,2]],
 PS05:[[0,0],[1,0],[2,0],[2,1],[3,1],[1,1],[0,1],[0,2],[1,2],[2,2],[2,3],[3,3],[2,4],[3,0]],
 PS06:[[0,0],[1,0],[2,0],[2,1],[1,1],[0,1]]
}
function Diagram({f}:{f:Flow}){
 const [selected,select]=useState(0),node=f.nodes[selected]
 const nodes:GraphNode[]=f.nodes.map((n,i)=>({title:n.title,x:92+positions[f.id][i][0]*220,y:64+positions[f.id][i][1]*112,kind:n.title.endsWith('?')?'decision':i===0?'start':i===f.nodes.length-1?'end':/annotate|approve|decide/i.test(n.title)?'human':undefined,detail:n.impl}))
 return <div className={'flow-inspect '+f.id}><label className="mobile-stage">Inspect workflow stage<select value={selected} onChange={e=>select(Number(e.target.value))}>{f.nodes.map((n,i)=><option value={i} key={n.title}>{i+1}. {n.title}</option>)}</select></label><GraphCanvas title={f.name+' workflow'} nodes={nodes} edges={f.edges} selected={selected} onSelect={select} download/>
 <section className="node-inspector" aria-live="polite"><small>Stage {selected+1} of {f.nodes.length}</small><h3>{node.title}</h3><p>{node.impl}</p><dl><dt>Input</dt><dd>{node.input}</dd><dt>Output</dt><dd>{node.output}</dd><dt>Evaluation</dt><dd>{f.metrics}</dd><dt>Fallback or limit</dt><dd>{f.edges.filter(e=>e.src===selected&&['invalid','no','block','refine','clarify'].includes(e.label)).map(e=>f.nodes[e.dst].impl).join(' ')||f.limit}</dd></dl><p><strong>Next</strong> · {f.edges.filter(e=>e.src===selected).map(e=><button key={e.dst} onClick={()=>select(e.dst)}>{e.label} → {f.nodes[e.dst].title}</button>)}{f.edges.every(e=>e.src!==selected)&&'Inspect the evidence or open the workspace.'}</p><nav><a href={root+f.source}>Source implementation</a><a href={f.evidence}>Observed evidence</a><a href={route(f)}>Open {f.name}</a></nav></section>
 <details className="linear-flow"><summary>Read the flow as text</summary><ol>{f.nodes.map((n,i)=><li key={n.title}><button aria-pressed={selected===i} onClick={()=>select(i)}>{n.title}</button> · {n.impl} {f.edges.filter(e=>e.src===i).map(e=>e.label+' → '+f.nodes[e.dst].title).join(' · ')}</li>)}</ol></details></div>
}
const engines=['Browser lexical passage index','Deterministic inventory ledger','FastAPI frontier search','Opt-in tab reward counts','Model-bound retrieval and steering','Rule spans and local retrieval']
function ReferenceMap({f,view}:{f:Flow;view:string}){
 const [selected,set]=useState(0),[layer,setLayer]=useState('Navigation')
 type Item=[string,string,string,string,string]
 let items:Item[],edges:GraphEdge[],coords:number[][]
 if(view==='platform'){
 items=[['Mission Control','Choose a workspace','User intent','An open workspace','#mission-control'],...flows.map((x,i):Item=>[x.name,engines[i],x.nodes[0].input,x.nodes.at(-1)!.output,route(x)]),['Local model API','Serves model-bound calculations for the semantic tools.','Validated inference request','Measured output','#research-lab']]
 // Separate link types so navigation never looks like an automatic transfer.
 items.pop()
 coords=[[1,1],[0,0],[0,1],[0,2],[2,2],[2,1],[2,0]]
 edges=flows.map((_,i)=>({src:0,dst:i+1,label:'open'}))
 if(layer==='Data transfers'){
   items=[items[1],items[6],items[5],['Retrieval Debugger','Checks a compatible report before transferring its review draft.','Operator-selected calibration task','Explicit review draft','#retrieval-debugger'],items[3]]
   coords=[[0,0],[0,1],[1,0.5],[0,2],[1,2]]
   edges=[{src:0,dst:2,label:'passage',accent:true},{src:1,dst:2,label:'reading',accent:true},{src:3,dst:4,label:'review task',accent:true}]
 }else if(layer==='Processing engines'){
   const x=flows.indexOf(f),local=x===0||x===1||x===3
   items=[[f.name,f.action,f.nodes[0].input,f.nodes[0].output,route(f)],[engines[x],f.nodes[Math.min(2,f.nodes.length-1)].impl,f.nodes[0].output,f.nodes.at(-1)!.output,route(f)],['Recorded evidence',f.metrics,f.sample,f.limit,f.evidence]]
   coords=[[0,0],[1,0],[2,0]];edges=[{src:0,dst:1,label:local?'in browser':'compute'},{src:1,dst:2,label:'verify'}]
 }
 }else if(view==='technical'){
 items=[['Workspace','Collects explicit operator inputs.','User action','Validated request',route(f)],['FastAPI','Checks the request and local or hosted permissions.','Request','Accepted input','#architecture'],['Model index','Pairs the encoder with its corpus and basis.','Accepted query','Vector or abstention','#research-lab'],['Full-space retrieval','Scores eligible records and applies configured steering.','Corpus and query','Ranks and measurements','#retrieval-debugger'],['PCA view','Projects coordinates for display.','Model vectors','Interactive point cloud','#vector-x'],['Evidence export','Records model identity, judgments and release decision.','Comparison','Replayable report','#retrieval-debugger'],['Browser engines','SUPPLY replays inventory locally. MORPH uses consented tab interactions.','Ledger or consented events','Simulation or recommendation','#supply']]
 coords=[[0,0],[1,0],[2,0],[2,1],[3,0],[1,1],[0,1]];edges=[{src:0,dst:1,label:'request'},{src:1,dst:2,label:'encode'},{src:2,dst:3,label:'score'},{src:2,dst:4,label:'project'},{src:3,dst:5,label:'export'},{src:0,dst:6,label:'local'}]
 }else{
 items=[['Requirement',f.official,f.user,f.action,flowLink(f)],['Live feature',f.action,f.nodes[0].input,f.nodes.at(-1)!.output,route(f)],['Measurement',f.metrics,f.sample,f.baseline,vault(f)],['Evidence record',f.sample,f.baseline,f.metrics,f.evidence],['Coverage limit',f.limit,f.metrics,'Scope of the observed outcome',vault(f)]]
 coords=[[0,0],[1,0],[2,0],[2,1],[1,1]];edges=[{src:0,dst:1,label:'implements'},{src:1,dst:2,label:'measured by'},{src:2,dst:3,label:'records'},{src:3,dst:4,label:'qualifies'}]
 }
 const i=Math.min(selected,items.length-1),item=items[i],context=view==='platform'?(flows.find(x=>x.name===item[0])??f):f
 return <>{view==='platform'&&<><div className="pill-row map-layers">{['Navigation','Data transfers','Processing engines'].map(name=><button key={name} aria-pressed={layer===name} onClick={()=>{setLayer(name);set(0)}}>{name}</button>)}</div>{layer==='Processing engines'&&<FlowSelect flow={f} onChange={w=>{location.hash=flowLink(w,'platform');set(0)}}/>}</>}<div className="reference-map"><GraphCanvas title={view==='platform'?'Platform ecosystem':view==='technical'?'System architecture':'Evidence traceability'} nodes={items.map((v,j)=>({title:v[0],x:92+coords[j][0]*222,y:62+coords[j][1]*125,kind:j===0?'start':/index|record/i.test(v[0])?'store':undefined}))} edges={edges} selected={i} onSelect={set} download/><aside className="node-inspector"><small>Selected node</small><h3>{item[0]}</h3><p>{item[1]}</p><dl><dt>Input</dt><dd>{item[2]}</dd><dt>Output</dt><dd>{item[3]}</dd></dl><a href={item[4]}>Open related feature</a> · <a href={context.evidence}>Inspect evidence</a><details><summary>Technical details</summary><p>{context.limit}</p><a href={root+context.source}>Source implementation</a></details></aside></div>{view==='platform'&&<p className="map-key">Open = navigation · Blue = explicit data transfer · Service = shared computation. SUPPLY and MORPH run independent local engines.</p>}</>
}
export function SystemFlow(){
 const q=useParams(),f=match(q.get('ps')),view=q.get('view')??'platform'
 return <div className="foundry judge-page"><header><p className="kicker">Engineering reference</p><h1>System Flow &amp; Architecture</h1><p>From user intent to verifiable outcomes.</p></header><nav data-tour="flow-view" className="view-nav" aria-label="Architecture views">{[['platform','Platform overview'],['workflows','Six workflows'],['technical','Technical architecture'],['trace','Evidence traceability']].map(([v,title])=><a key={v} aria-current={view===v?'page':undefined} href={flowLink(f,v)}>{title}</a>)}</nav>
 <section className="workbench flow-workspace">{(view==='trace'||view==='workflows')&&<FlowSelect flow={f} onChange={w=>location.hash=flowLink(w,view)}/>} {view==='workflows'?<Diagram key={f.id} f={f}/>:<ReferenceMap key={view==='platform'?view:view+f.id} f={f} view={view}/>}<p>{hosted?'Hosted controls are restricted.':'Local workspace'} · <a href={flowLink(f)}>Inspect this engine’s workflow →</a></p></section></div>
}
export function EvidenceCenter(){
 const q=useParams(),f=match(q.get('ps'))
 return <section className="panel foundry-panel judge-page"><h2>Verification center</h2><div className="evidence-summary"><section><small>What works · authored 16D fixture</small><h3>Document 6 moved up</h3><div className="rank-shift"><b>2</b><span>→</span><b>1</b></div><p>Rank before and after constrained steering.</p><a href="/evidence/judge/flagship.json">Open the measured report</a></section><section><small>What was measured</small><h3>Telescope light</h3><p>Recall@3　1 → 1</p><p>nDCG@3　0.631 → 1</p><p>Protected drift　0.033386 / 0.05 cap</p></section><section><small>What failed</small><h3>Scientific coverage</h3><p>SciFact represented 16 of 164 claims. BM25 led QASPER.</p></section><section><small>Unverified</small><h3>Independent benefit</h3><p>This authored task cannot establish broader search effectiveness or preservation of human meaning.</p></section></div><p>OBSIDIAN is the judged release. FOCUS introduced the retrieval debugger. ASCENSION is the local follow-up.</p><details open><summary>Scientific evaluation</summary><p>QASPER · 16 paper families, 15 questions with gold evidence. BM25 led the tested retrieval baselines.</p>{[['BM25',.22295],['Expanded LSA',.14355],['Governed LSA',.18813],['MiniLM',.02044],['Governed MiniLM',.05582]].map(([k,v])=><div className="evidence-bar" key={k}><span>{k}</span><meter min="0" max="1" value={v}/><b>{Number(v).toFixed(5)}</b></div>)}<small>Mean nDCG@3 · scale 0–1 · binary evidence labels</small><p>At matched gain, mean protected drift fell from 0.33340 to 0.02267 for expanded LSA and from 0.30323 to 0.01977 for MiniLM. All 32 governed endpoints met the specified limits. Independent results-section shift worsened for both models.</p><a href="#research-lab">Inspect families, baselines and projection fidelity</a></details>
 <details><summary>Functional verification and six PS requirements</summary><FlowSelect flow={f} onChange={w=>location.hash=vault(w)}/><h3>{f.name}</h3><dl>{[['Claim',f.action],['Baseline',f.baseline],['Sample / configuration',f.sample],['Measurement and outcome',f.metrics],['Limitation',f.limit],['Reproduce',f.nodes[0].impl+' '+f.action]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><nav><a href={f.evidence}>Recorded artifact</a><a href={root+f.source}>Source at 66b02ed</a><a href={flowLink(f,'trace')}>Trace requirement</a></nav></details>
 <details><summary>Numerical reproducibility</summary><p>16 original 16D negative-strength reports yielded 10 hashes. Fixed-order products and math.fsum produced a single hash over 100 runs in each of three fresh processes on the same Intel Mac. Cross-platform replay is unverified.</p><a href="/evidence/judge/gate.json">Per-configuration replay hashes</a> · <a href="/evidence/judge/checksums.json">13 verified archive hashes</a><p>Run <code>.venv/bin/python scripts/verify_numerical_replay.py</code> with local model assets and single-thread BLAS.</p></details>
 <details><summary>Known failures</summary><p>SciFact represented 16/164 claims. Original Recall@3 was 0.00610; steered Recall@3 was zero. Three third-place ID exchanges paused the historical review. The cause of the hosted 503 incident remains unconfirmed.</p><a href="/evidence/phase3.json">Frozen SciFact outcomes</a></details>
 <details><summary>Source and artifacts</summary><nav><a href="/evidence/judge/verification.json">Verified test checkpoint</a><a href="/evidence/judge/flagship.json">Fixed 16D report</a><a href="/evidence/judge/vocabulary-gap.json">Three-document vocabulary gap</a><a href="/evidence/judge/geometry-gate-control.json">Artificial geometry gate</a><a href="#guided-demo">Reproduction walkthrough</a></nav></details></section>
}
const steps=[
 ['System flow','Select VECTOR-X and inspect the representability decision.','A missing vector abstains from dense retrieval.','#system-flow?view=workflows&ps=PS05','/evidence/judge/vocabulary-gap.json'],
 ['Atlas','Embed a calibration query and inspect its original neighbors.','PCA displays coordinates. The full model space supplies the ranking.','#vector-x','/evidence/phase3.json'],
 ['Semantic Lock','Select target and protection; inspect gain, drift and cosine.','The governor reduces motion when a candidate exceeds the limits.','#intelligence','/evidence/judge/flagship.json'],
 ['Fixed comparison','Choose legacy 16D, telescope light, expected ID 6, dense → constrained, strength −1, Ocean target and Botanical protection. Run comparison.','The archived fixture passes and moves ID 6 from rank 2 to rank 1.','#retrieval-debugger','/evidence/judge/flagship.json'],
 ['Vocabulary gap','Locally import the three-row CSV, map body, use xylolith and expected ID 1. Compare dense with fusion and uncheck required geometry.','Dense abstains. Fusion finds ID 1. Requiring geometry instead blocks fusion.','#data-foundry','/evidence/judge/vocabulary-gap.csv'],
 ['Export and replay','Export the JSON, then run .venv/bin/python scripts/replay_focus.py REPORT.json against the same local service.','Review the exact result and the independent limits in the vault.','#evidence-vault','/evidence/judge/gate.json']
]
export function GuidedDemo(){
 const [mode,setMode]=useState('5-minute flagship'),[i,set]=useState(0)
 const tour=mode==='Six-workspace tour'?flows.map(f=>[f.name,f.action,f.metrics,route(f),f.evidence]):mode==='90-second overview'?[steps[0],steps[3],steps[5]]:steps
 const [title,action,expected,url,proof]=tour[i]
 return <div className="foundry judge-page"><header><p className="kicker">Presenter guide</p><h1>Guided demo</h1><button onClick={()=>startTour("Introduction")}>Start interactive walkthrough</button></header><section className="panel foundry-panel"><label>Presentation mode<select value={mode} onChange={e=>{setMode(e.target.value);set(0)}}>{['90-second overview','5-minute flagship','Six-workspace tour'].map(m=><option key={m}>{m}</option>)}</select></label><p>Step {i+1} of {tour.length}</p><h2>{title}</h2><p>{action}</p><h3>Expected behavior and explanation</h3><p>{expected}</p><p>If the local model or API is unavailable, open the recorded artifact. It contains the archived outcome.</p><nav><a href={url}>Open live workspace</a><a href={proof}>Inspect recorded artifact</a><a href={tour[(i+1)%tour.length][3]}>Next workspace</a></nav><div className="foundry-actions"><button disabled={!i} onClick={()=>set(i-1)}>Previous step</button><button disabled={i===tour.length-1} onClick={()=>set(i+1)}>Next step</button></div></section><nav className="view-nav">{[steps[0],steps[1],steps[2],steps[3],steps[5]].map(s=><a key={s[0]} href={s[3]}>{s[0]}</a>)}</nav></div>
}
