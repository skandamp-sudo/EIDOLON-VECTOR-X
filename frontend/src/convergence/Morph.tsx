import {useEffect,useState} from 'react'
import {clearHistory,configureLearning,domains,exportEvidence,record,useHistory,useLearning} from './session'
import type {Domain,Interaction} from './session'

type Layout={shortcut:Domain;compact:boolean}
type Trial={origin:Domain;condition:string;target:Domain;start:number;steps:number;errors:number;effort:number|null;end:number|null;success:boolean|null}
let layout:Layout|null=null, previous:Layout|null=null
let trial:Trial|null=null
let results:Trial[]=[]
let trialCount=0
const dismissed=new Set<string>()
let lastVisit:Domain|null=null
export function visit(domain:Domain){
  if(lastVisit===domain)return
  if(trial&&trial.end===null){trial.steps++;if(domain!==trial.target)trial.errors++}
  lastVisit=domain
  record(domain,'visit')
}
export function navigateBack(domain:Domain){record(domain,'back')}
function learn(events:Interaction[],context:Domain){
  const scores=new Map(domains.map(d=>[d,{positive:0,negative:0}]))
  let preceding:Domain|null=null,current:Domain|null=null
  for(const e of events){
    if(e.action==='visit'){preceding=current;current=e.domain}
    if(e.context?e.context!==context:preceding!==context&&current!==context)continue
    const s=scores.get(e.domain)!
    if(e.action==='complete'||e.action==='prefer')s.positive++
    if(e.action==='retry'||e.action==='back')s.negative++
  }
  return domains.map(domain=>({domain,...scores.get(domain)!})).map(s=>({...s,estimate:(1+s.positive)/(2+s.positive+s.negative)})).sort((a,b)=>b.estimate-a.estimate||b.positive-a.positive)
}
export default function Morph({context,onNavigate}:{context:Domain;onNavigate:(d:Domain)=>void}){
 const events=useHistory(),enabled=useLearning()
 const [,refresh]=useState(0),[pref,setPref]=useState<Domain>('CORTEX'),[effort,setEffort]=useState('')
 const update=()=>refresh(x=>x+1)
 const scores=learn(events,context),best=scores.find(s=>s.positive&&s.estimate>.5&&!dismissed.has(context+'/'+s.domain))
 const backs=events.filter(e=>e.action==='back').length
 const reset=()=>{configureLearning(false);clearHistory();layout=null;previous=null;trial=null;results=[];trialCount=0;dismissed.clear();lastVisit=null;window.dispatchEvent(new Event('vector-x-reset-preferences'));try{sessionStorage.removeItem('vector-x.inventory-saves.v1')}catch{};setEffort('');update()}
 const finish=(success:boolean)=>{if(!trial||trial.end!==null)return
  trial={...trial,end:Date.now(),success,effort:effort?Number(effort):null}
  results=[...results.slice(-31),trial];trialCount++;record(context,success?'complete':'retry');update()}
 const pair=trialCount%2===1?results.at(-1):undefined
 const target=pair?.target??layout?.shortcut??pref
 const canStart=enabled&&target!==context&&(!pair||context===pair.origin)&&(!trial||trial.end!==null)
 const useShortcut=enabled&&(!trial||trial.end!==null||trial.condition==='adaptive')?layout:null
 return <section className="panel foundry-panel"><h2>Adaptive navigation</h2>
 <label><input type="checkbox" checked={enabled} onChange={e=>{configureLearning(e.target.checked);if(!e.target.checked){trial=null;layout=null;previous=null}update()}}/> Learn from this tab</label>
 <p>Opt-in records up to 256 module names, actions and timestamps in memory. A smoothed reward estimate ranks shortcuts using explicit preference and completion as positive signals, retries and backtracks as negative signals. Query and document text are excluded.</p>
 {enabled&&<><label>Preferred destination<select value={pref} onChange={e=>setPref(e.target.value as Domain)}>{domains.map(d=><option key={d}>{d}</option>)}</select></label>
 <button onClick={()=>{record(pref,'prefer',context)}}>Record preference</button>
 <p>{events.length} recorded interactions · {backs} observed backtracks. Repeated navigation can indicate extra steps. Intent and frustration are unmeasured.</p>
 {best&&<><p>Suggested shortcut {best.domain} · {best.positive} positive and {best.negative} negative rewards · estimate {best.estimate.toFixed(2)}. Current layout {layout?.shortcut??'static'}.</p>
 <button disabled={layout?.shortcut===best.domain} onClick={()=>{previous=layout;layout={shortcut:best.domain,compact:true};record('MORPH','approve');update()}}>Accept shortcut</button>
 <button onClick={()=>{dismissed.add(context+'/'+best.domain);record('MORPH','reject')}}>Reject adaptation</button></>}
 {useShortcut&&<button onClick={()=>onNavigate(useShortcut.shortcut)}>Shortcut to {useShortcut.shortcut}</button>}
 <details open={!useShortcut||!useShortcut.compact}><summary>Reward estimates</summary>{scores.map(s=><p key={s.domain}>{s.domain} · {s.estimate.toFixed(2)} ({s.positive+s.negative} rewards)</p>)}</details>
 <button disabled={!layout} onClick={()=>{layout=previous;previous=null;record(context,'undo');update()}}>Undo adaptation</button><button onClick={()=>{previous=layout;layout=null;record(context,'undo');update()}}>Restore static layout</button>
 <h3>Navigation comparison</h3><p>Reach the displayed destination. Conditions alternate after a random first assignment. The shortcut is available in adaptive trials when a layout has been accepted. After arrival, report your outcome.</p>
 <p>{pair?'Return to '+pair.origin+' for the paired task to '+pair.target:'Choose a destination different from this workspace.'}</p>
 <button disabled={!canStart} onClick={()=>{const adaptive=pair?pair.condition==='static':crypto.getRandomValues(new Uint8Array(1))[0]%2===1
 trial={origin:context,condition:adaptive?'adaptive':'static',target,start:Date.now(),steps:0,errors:0,effort:null,end:null,success:null};setEffort('');update()}}>Start navigation task</button>
 {trial&&<><p role="status">{trial.condition} task · reach {trial.target} · {trial.steps} module changes · {trial.errors} intermediate destinations</p><label>Mental effort<select value={effort} onChange={e=>setEffort(e.target.value)}><option value="">Unrated</option>{[1,2,3,4,5,6,7].map(i=><option key={i}>{i}</option>)}</select></label>
 <button disabled={trial.end!==null||context!==trial.target} onClick={()=>finish(true)}>Mark destination reached</button><button disabled={trial.end!==null} onClick={()=>finish(false)}>End incomplete task</button></>}
 <button onClick={()=>exportEvidence('navigation-study',{events,context,scores,layout,trials:results,decisions:events.filter(e=>e.domain==='MORPH'&&['approve','reject'].includes(e.action)).length,acceptances:events.filter(e=>e.action==='approve'&&e.domain==='MORPH').length})}>Export local history</button></>}
 <button onClick={reset}>Delete history and reset learning</button></section>
}

export function AtlasPreferences(){
 useEffect(()=>visit('VECTOR-X'),[])
 return <details><summary>Navigation preferences and study</summary><Morph context="VECTOR-X" onNavigate={d=>{location.hash=d.toLowerCase()}}/></details>
}
