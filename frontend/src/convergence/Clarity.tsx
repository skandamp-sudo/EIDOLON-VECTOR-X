import {useEffect,useState} from 'react'
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
 const [draft,edit]=useState('Compare waves near the bank'),[query,setQuery]=useState(draft),[answers,answer]=useState<Record<string,string>>(()=>remembered.get(draft)??{}),[custom,setCustom]=useState('')
 const [comparison,compare]=useState<string[]>([]),[vectors,show]=useState<Meaning[]>([]),[busy,loading]=useState(false)
 const issues=inspect(query),pending=issues.filter(i=>!answers[i.key]),issue=pending[0],decision=verdict(query,pending.length)
 const resolved=(extra='')=>[query,...Object.values(answers),extra].filter(Boolean).join(' · ')
 useEffect(()=>{
  show([]);if(!comparison.length){loading(false);return}
  const c=new AbortController()
  let active=true;loading(true)
  ;(async()=>{const next:Meaning[]=[]
   for(const text of comparison){
     if(!active)break
     next.push(await encode(text,c.signal))
     if(active)show([...next])
   }
   if(active){show(next);loading(false)}
  })()
  return ()=>{active=false;c.abort()}
 },[comparison])
 const choose=(meaning:string)=>{if(!issue||!meaning.trim())return;const next={...answers,[issue.key]:meaning.trim()};remember(query,next);answer(next);setCustom('');compare([])}
 const needsDetail=issue&&['referential','contextual'].includes(issue.kind)
 return <section className="panel foundry-panel"><h2>Ambiguity X-Ray</h2>
 <label>Example instruction<select value="" onChange={e=>edit(e.target.value)}><option disabled value="">Choose an example</option>{['Compare waves near the bank','Send it','Inspect the telescope'].map(t=><option key={t}>{t}</option>)}</select></label>
 <form onSubmit={e=>{e.preventDefault();const value=draft.trim();if(query!==value)answer(remembered.get(value)??{});setQuery(value);setCustom('');compare([])}}><label>Instruction to interpret<input value={draft} onChange={e=>edit(e.target.value)} required maxLength={240}/></label><button disabled={!draft.trim()}>Inspect language</button></form>
 <p role="status" className="shield" data-state={decision}><strong>{decision}</strong> · {pending.length} unresolved cues · simulation only. Clarifications are recalled for up to eight identical instructions in this tab. The detector recognizes a bounded set of English constructions and can miss other readings.</p>
 <figure className="reading-tree"><figcaption>Interpretation tree</figcaption><blockquote>{query.split('').map((c,n)=>issues.some(i=>n>=i.start&&n<i.end)?<mark key={n}>{c}</mark>:c)}</blockquote>
 {issues.map(i=><div key={i.key}><strong>{i.span}</strong><span>{answers[i.key]??i.meanings.join(' / ')}</span></div>)}{!issues.length&&<p>No rule matched this instruction.</p>}</figure>
 {issues.map(i=><p key={i.key}><mark>{query.slice(i.start,i.end)}</mark> · {i.kind} · characters {i.start+1}–{i.end} · {answers[i.key]??'unresolved'}</p>)}
 {issue&&<><h3>{issue.question}</h3><p>Heuristic question priority {issue.utility.toFixed(2)}. Word overlap weights the two readings. Only your answer confirms the intended meaning.</p>
 {issue.meanings.map((m,i)=>({m,w:issue.weights[i]})).sort((a,b)=>b.w-a.w).map(({m,w})=><button key={m} onClick={()=>choose(m)} disabled={!!needsDetail}>{m} ({w.toFixed(2)})</button>)}
 <label>{needsDetail?'Enter the entity or reference frame':'Specify another meaning'}<input maxLength={60} value={custom} onChange={e=>setCustom(e.target.value)}/></label><button disabled={!custom.trim()} onClick={()=>choose(custom)}>Use my interpretation</button></>}
 {!hosted&&issues.length>0&&!pending.length&&<button onClick={()=>openAtlasDraft(resolved(),'CLARITY interpretation')}>Open interpretation in Vector Warp</button>}
 <h3>Semantic comparison</h3><button onClick={()=>compare(Array.from(new Set([query,...(issue?issue.meanings.map(m=>resolved(m)):[resolved()])])))}>Compare interpretation retrieval</button>
 {busy&&<p role="status">Encoding the interpretations… <button onClick={()=>compare([])}>Cancel comparison</button></p>}
 {!busy&&vectors.some(v=>!v.run&&v.error!=='No representable signal')&&<button onClick={()=>compare([...comparison])}>Retry comparison</button>}
 {vectors.map((v,i)=><div key={v.text}><strong>{i===0?'Direct interpretation':v.text}</strong>{v.run?<><p>{v.run.model} · top passages {v.run.before.map(n=>n+1).join(', ')}</p>{v.run.omitted_terms?.length ? <p>Outside the fitted vocabulary: {v.run.omitted_terms.join(', ')}. These terms did not influence the ranking.</p> : null}<ol>{v.run.before.map(n=><li key={n}>{v.run!.documents[n].text}</li>)}</ol></>:<p>{v.error}</p>}</div>)}
 {vectors.map((a,i)=>vectors.slice(i+1).map((b,j)=>{const value=a.run&&b.run?similarity(a.run.original,b.run.original):null
 return <p key={i+'-'+j}>Readings {i+1} and {i+j+2} · cosine {value===null?'unavailable':value.toFixed(3)} {value!==null&&<meter aria-label="Interpretation cosine" min="-1" max="1" value={value}/>}</p>}))}
 <button onClick={()=>{remembered.clear();answer({});compare([])}}>Clear clarification context</button><button onClick={()=>exportEvidence('clarification',{query,issues,answers,decision,turns:Object.keys(answers).length,comparisons:vectors.map(v=>({reading:v.text,model:v.run?.model??null,ids:v.run?.before??null,error:v.error||null}))})}>Export clarification</button>
 </section>
}
