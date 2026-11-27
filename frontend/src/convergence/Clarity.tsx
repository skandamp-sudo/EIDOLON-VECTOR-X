import {useEffect,useState} from 'react'
import {openAtlasDraft} from './atlasDraft'
import {apiOrigin,hosted} from '../apiOrigin'
import {validRun} from '../explore'
import type {Run} from '../explore'
import {inspect,verdict} from './ambiguity'
import {exportEvidence} from './session'

type Meaning={text:string;run:Run|null;error:string}
async function encode(text:string,signal:AbortSignal):Promise<Meaning>{
 try{
  const res=await fetch(apiOrigin+'/api/v1/explore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,strength:0,target:'Ocean'}),signal,cache:'no-store'})
  const run=await res.json()
  if(!res.ok||!validRun(run))return {text,run:null,error:typeof run.detail==='string'?run.detail:'Encoder unavailable'}
  return {text,run,error:''}
 }catch{return {text,run:null,error:'Encoder unavailable or request timed out'}}
}
function similarity(a:number[],b:number[]){
 const norms=Math.hypot(...a)*Math.hypot(...b)
 return norms?a.reduce((s,n,i)=>s+n*b[i],0)/norms:null
}
export default function Clarity(){
 const [draft,edit]=useState('Compare waves near the bank'),[query,setQuery]=useState(draft),[answers,answer]=useState<Record<string,string>>({}),[custom,setCustom]=useState('')
 const [comparison,compare]=useState<string[]>([]),[vectors,show]=useState<Meaning[]>([]),[busy,loading]=useState(false)
 const issues=inspect(query),pending=issues.filter(i=>!answers[i.key]),issue=pending[0],decision=verdict(query,pending.length)
 const resolved=(extra='')=>[query,...Object.values(answers),extra].filter(Boolean).join(' · ').slice(0,400)
 useEffect(()=>{
  show([]);if(!comparison.length){loading(false);return}
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),12000)
  let active=true;loading(true)
  ;(async()=>{const next:Meaning[]=[]
   for(const text of comparison)next.push(await encode(text,c.signal))
   if(active){show(next);loading(false)}
  })()
  return ()=>{active=false;clearTimeout(timer);c.abort()}
 },[comparison])
 const choose=(meaning:string)=>{if(!issue||!meaning.trim())return;answer({...answers,[issue.key]:meaning.trim()});setCustom('');compare([])}
 const needsDetail=issue&&['referential','contextual'].includes(issue.kind)
 return <section className="panel foundry-panel"><h2>Ambiguity X-Ray</h2>
 <form onSubmit={e=>{e.preventDefault();const value=draft.trim();if(query!==value)answer({});setQuery(value);setCustom('');compare([])}}><label>Instruction to interpret<input value={draft} onChange={e=>edit(e.target.value)} required maxLength={240}/></label><button disabled={!draft.trim()}>Inspect language</button></form>
 <p role="status"><strong>{decision}</strong> · {pending.length} unresolved cues · simulation only. The detector recognizes a bounded set of English constructions and can miss other readings.</p>
 {issues.map(i=><p key={i.key}><mark>{query.slice(i.start,i.end)}</mark> · {i.kind} · characters {i.start+1}–{i.end} · {answers[i.key]??'unresolved'}</p>)}
 {issue&&<><h3>{issue.question}</h3><p>Question priority {issue.utility.toFixed(2)} bits per effort unit. Entropy {issue.entropy.toFixed(2)} bits assumes a response distinguishes both meanings. Weights use surrounding word overlap and have no probability calibration.</p>
 {issue.meanings.map((m,i)=>({m,w:issue.weights[i]})).sort((a,b)=>b.w-a.w).map(({m,w})=><button key={m} onClick={()=>needsDetail?setCustom(''):choose(m)} disabled={!!needsDetail}>{m} ({w.toFixed(2)})</button>)}
 <label>{needsDetail?'Enter the entity or reference frame':'Specify another meaning'}<input maxLength={60} value={custom} onChange={e=>setCustom(e.target.value)}/></label><button disabled={!custom.trim()} onClick={()=>choose(custom)}>Use my interpretation</button></>}
 {!hosted&&issues.length>0&&!pending.length&&<button onClick={()=>openAtlasDraft(resolved(),'CLARITY interpretation')}>Open interpretation in Vector Warp</button>}
 <h3>Semantic comparison</h3><button onClick={()=>compare(Array.from(new Set([query,...(issue?issue.meanings.map(m=>resolved(m)):[resolved()])])))}>Compare interpretation retrieval</button>
 {busy&&<p role="status">Encoding the interpretations…</p>}
 {vectors.map((v,i)=><div key={v.text}><strong>{i===0?'Direct interpretation':v.text}</strong>{v.run?<><p>{v.run.model} · top passages {v.run.before.map(n=>n+1).join(', ')}</p><ol>{v.run.before.map(n=><li key={n}>{v.run!.documents[n].text}</li>)}</ol></>:<p>{v.error}</p>}</div>)}
 {vectors.map((a,i)=>vectors.slice(i+1).map((b,j)=>{const value=a.run&&b.run?similarity(a.run.original,b.run.original):null
 return <p key={i+'-'+j}>Readings {i+1} and {i+j+2} · cosine {value===null?'unavailable':value.toFixed(3)} {value!==null&&<meter aria-label="Interpretation cosine" min="-1" max="1" value={value}/>}</p>}))}
 <button onClick={()=>{answer({});compare([])}}>Clear clarification context</button><button onClick={()=>exportEvidence('clarification',{query,issues,answers,decision,turns:Object.keys(answers).length,comparisons:vectors.map(v=>({reading:v.text,model:v.run?.model??null,ids:v.run?.before??null,error:v.error||null}))})}>Export clarification</button>
 </section>
}
