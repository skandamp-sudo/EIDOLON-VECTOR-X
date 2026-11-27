import {useEffect,useRef,useState} from 'react'
import GraphCanvas,{type GraphNode,type GraphEdge} from '../GraphCanvas'
import {tourAction} from '../tourState'
import {openAtlasDraft} from './atlasDraft'
import {apiOrigin,hosted} from '../apiOrigin'
import {validRun} from '../explore'
import type {Run} from '../explore'
import {inspect,verdict} from './ambiguity'
import {exportEvidence} from './session'

// Exact-instruction scope prevents a resolved pronoun from binding an unrelated request.
const remembered=new Map<string,Record<string,string>>()
function remember(query:string,answers:Record<string,string>){
 remembered.delete(query)
 if(remembered.size===8){const oldest=remembered.keys().next().value;if(oldest!==undefined)remembered.delete(oldest)}
 remembered.set(query,answers)
}
let returningQuery:string|null=null
type Meaning={text:string;run:Run|null;error:string}
async function encode(text:string,signal:AbortSignal):Promise<Meaning>{
 if(text.length>400)return {text,run:null,error:'Interpretation exceeds the 400-character encoder limit. Shorten the instruction.'}
 try{
  const deadline=AbortSignal.any([signal,AbortSignal.timeout(6500)])
  const res=await fetch(apiOrigin+'/api/v1/explore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,strength:0,target:'Ocean'}),signal:deadline,cache:'no-store'})
  if(res.status===503||res.status===429)return {text,run:null,error:'Service busy (HTTP '+res.status+'). Retry comparison when ready.'}
  const run=await res.json()
  if(!res.ok||!validRun(run))return {text,run:null,error:typeof run.detail==='string'?run.detail:'Encoder unavailable'}
  return {text,run,error:''}
 }catch{return {text,run:null,error:'The encoder did not respond. Retry comparison.'}}
}
function similarity(a:number[],b:number[]){
 const norms=Math.hypot(...a)*Math.hypot(...b)
 return norms?a.reduce((s,n,i)=>s+n*b[i],0)/norms:null
}
export default function Clarity(){
 const [draft,edit]=useState(returningQuery??'Compare waves near the bank'),[query,setQuery]=useState(draft),[answers,answer]=useState<Record<string,string>>(()=>remembered.get(draft)??{}),[custom,setCustom]=useState('')
 const [comparison,compare]=useState<string[]>([]),[vectors,show]=useState<Meaning[]>([]),[busy,loading]=useState(false)
 const issues=inspect(query),pending=issues.filter(i=>!answers[i.key]),issue=pending[0],decision=verdict(query,pending.length)
 useEffect(()=>{returningQuery=null},[])
 const retained=useRef<Meaning[]>([])
 const retryReadings=(only?:string)=>{retained.current=vectors.filter(v=>v.run!==null||(only!==undefined&&v.text!==only));compare([...comparison])}
 const resolved=(extra='')=>[query,...Object.values(answers),extra].filter(Boolean).join(' · ')
 useEffect(()=>{
  const previous=retained.current;retained.current=[]
  show(previous);if(!comparison.length){loading(false);return}
  const c=new AbortController()
  let active=true;loading(true)
  ;(async()=>{const next:Meaning[]=[]
   for(const text of comparison){
     if(!active)break
     next.push(previous.find(v=>v.text===text)??await encode(text,c.signal))
     if(active)show(comparison.flatMap(s=>next.find(v=>v.text===s)??previous.find(v=>v.text===s)??[]))
   }
   if(active){show(next);loading(false);if(next.some(v=>v.run))tourAction("clarify-compare")}
  })()
  return ()=>{active=false;c.abort()}
 },[comparison])
 const [cue,setCue]=useState('')
 const choose=(meaning:string)=>{if(!issue||!meaning.trim())return;const next={...answers,[issue.key]:meaning.trim()};remember(query,next);answer(next);tourAction('clarify-answer');setCustom('');compare([])}
 const needsDetail=issue&&['referential','contextual'].includes(issue.kind)
 const activeCue=issues.find(i=>i.key===cue)??issue??issues[0]
 const graphNodes:GraphNode[]=[{title:'Your sentence',x:85,y:Math.max(105,issues.length*64),kind:'start'}],graphEdges:GraphEdge[]=[]
 const graphTasks:(()=>void)[]=[()=>setCue('')]
 const [selectedReading,selectReading]=useState('')
 const segments:{text:string;key?:string}[]=[];let at=0
 for(const i of [...issues].sort((a,b)=>a.start-b.start)){if(i.start<at)continue;segments.push({text:query.slice(at,i.start)},{text:query.slice(i.start,i.end),key:i.key});at=i.end}
 segments.push({text:query.slice(at)})
 issues.forEach((it,j)=>{const idx=graphNodes.length,y=80+j*128;graphNodes.push({title:it.span,x:280,y,kind:'decision'});graphTasks.push(()=>{setCue(it.key);selectReading('')});graphEdges.push({src:0,dst:idx})
 const readings=[...new Set([...it.meanings,...(answers[it.key]?[answers[it.key]]:[])])]
 readings.forEach((m,k)=>{const n=graphNodes.length;graphNodes.push({title:m,x:510,y:y+(k-(readings.length-1)/2)*48,kind:answers[it.key]===m?'end':undefined});graphTasks.push(()=>{setCue(it.key);selectReading(m)});graphEdges.push({src:idx,dst:n,accent:answers[it.key]===m,label:answers[it.key]===m?'confirmed':''})})})
 return <section className="workbench clarity-studio"><small>Language studio</small><h2>What would you like me to understand?</h2><div className="pill-row">{['Compare waves near the bank','Send it','Inspect the telescope'].map(t=><button key={t} onClick={()=>edit(t)}>{t}</button>)}</div>
 <details className="expert-settings"><summary>Example instruction selector</summary><label>Example instruction<select value="" onChange={e=>edit(e.target.value)}><option disabled value="">Choose an example</option>{['Compare waves near the bank','Send it','Inspect the telescope'].map(t=><option key={t}>{t}</option>)}</select></label></details>
 <form className="prompt-line" onSubmit={e=>{e.preventDefault();const value=draft.trim();if(query!==value)answer(remembered.get(value)??{});setQuery(value);setCue('');selectReading('');setCustom('');compare([]);tourAction('clarify-inspect')}}><label>Instruction to interpret<input value={draft} onChange={e=>edit(e.target.value)} required maxLength={240}/></label><button data-tour="clarify-inspect" disabled={!draft.trim()}>Inspect language</button></form>
 <p role="status" className="shield" data-state={decision}><strong>{decision}</strong> · {pending.length} unresolved cues · simulation only. Clarifications are recalled for up to eight identical instructions in this tab. The detector recognizes a bounded set of English constructions and can miss other readings.</p>
 <section className="clarify-grid"><figure className="reading-tree" data-tour="clarify-tree"><h3>Ambiguity X-Ray</h3><blockquote>{segments.map((seg,i)=>seg.key?<button aria-pressed={activeCue?.key===seg.key} key={i} onClick={()=>{setCue(seg.key!);selectReading('')}}>{seg.text}</button>:seg.text)}</blockquote>{issues.length?<GraphCanvas title="Interpretation tree" nodes={graphNodes} edges={graphEdges} selected={Math.max(0,graphNodes.findIndex(n=>n.title===(selectedReading||activeCue?.span)))} onSelect={i=>graphTasks[i]()} color="#75d9ae"/>:<p>No rule matched this instruction.</p>}{activeCue&&<p>{activeCue.span} · {answers[activeCue.key]??(selectedReading?selectedReading+" (possible reading)":"Awaiting your clarification")}</p>}</figure><section className="question-pane" data-tour="clarify-answer"><small>{pending.length?'Next clarification':'Clarification result'}</small>{!issue&&<><h3>{issues.length?'Meaning confirmed':'No clarification required'}</h3><p>{resolved()}</p></>}
 {issue&&<><h3>{issue.question}</h3><details className="expert-settings"><summary>How this question was chosen</summary><p>Heuristic question priority {issue.utility.toFixed(2)}. Word overlap weights the two readings. Only your answer confirms the intended meaning.</p></details>
 {issue.meanings.map((m,i)=>({m,w:issue.weights[i]})).sort((a,b)=>b.w-a.w).map(({m,w})=><button key={m} onClick={()=>choose(m)} disabled={!!needsDetail}>{m} <small className="expert-number">({w.toFixed(2)})</small></button>)}
 <label>{needsDetail?'Enter the entity or reference frame':'Specify another meaning'}<input maxLength={60} value={custom} onChange={e=>setCustom(e.target.value)}/></label><button disabled={!custom.trim()} onClick={()=>choose(custom)}>Use my interpretation</button></>}
 {!hosted&&issues.length>0&&!pending.length&&<button onClick={()=>{returningQuery=query;openAtlasDraft(resolved(),'CLARITY interpretation')}}>Open interpretation in Vector Warp</button>}
 {Object.keys(answers).length>0&&<section aria-label="Resolution history"><h3>Confirmed interpretations</h3><ol>{Object.entries(answers).map(([key,value])=><li key={key}>{issues.find(i=>i.key===key)?.span} → {value}</li>)}</ol>
 <button onClick={()=>{const prior=Object.fromEntries(Object.entries(answers).slice(0,-1));remember(query,prior);answer(prior);compare([]);setCustom('')}}>Undo last clarification</button></section>}
 </section></section><h3>Semantic comparison</h3><button data-tour="clarify-compare" onClick={()=>compare(Array.from(new Set([query,...(issue?issue.meanings.map(m=>resolved(m)):[resolved()])])))}>Compare interpretation retrieval</button>
 {busy&&<p role="status">Encoding the interpretations… <button onClick={()=>compare([])}>Cancel comparison</button></p>}
 {!busy&&vectors.some(v=>!v.run&&v.error!=='No representable signal')&&<button onClick={()=>retryReadings()}>Retry comparison</button>}
 {vectors.map((v,i)=><div key={v.text}><strong>{i===0?'Direct interpretation':v.text}</strong>{v.run?<><p>{v.run.model} · top passages {v.run.before.map(n=>n+1).join(', ')}</p>{v.run.omitted_terms?.length ? <p>Outside the fitted vocabulary: {v.run.omitted_terms.join(', ')}. These terms did not influence the ranking.</p> : null}{i>0&&vectors[0]?.run&&<p>{v.run.before.filter(id=>!vectors[0].run!.before.includes(id)).length} new documents among the top {v.run.before.length} compared with the direct reading.</p>}<ol>{v.run.before.map(n=><li key={n}>{v.run!.documents[n].text}</li>)}</ol></>:<p>{v.error} {!busy&&v.error!=='No representable signal'&&<button onClick={()=>retryReadings(v.text)}>Retry this reading</button>}</p>}</div>)}
 {vectors.map((a,i)=>vectors.slice(i+1).map((b,j)=>{const value=a.run&&b.run?similarity(a.run.original,b.run.original):null
 return <p key={i+'-'+j}>Readings {i+1} and {i+j+2} · cosine {value===null?'unavailable':value.toFixed(3)} {value!==null&&<meter aria-label="Interpretation cosine" min="-1" max="1" value={value}/>}</p>}))}
 <button onClick={()=>{remembered.clear();answer({});compare([])}}>Clear clarification context</button><button onClick={()=>exportEvidence('clarification',{query,issues,answers,decision,turns:Object.keys(answers).length,comparisons:vectors.map(v=>({reading:v.text,model:v.run?.model??null,ids:v.run?.before??null,error:v.error||null}))})}>Export clarification</button>
 </section>
}
