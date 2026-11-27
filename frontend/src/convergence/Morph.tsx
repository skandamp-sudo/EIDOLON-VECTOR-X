import {BookOpen,Boxes,GitBranch,SlidersHorizontal,Orbit,ScanText,ArrowUpRight} from 'lucide-react'
import {tourAction} from "../tourState"
import {useEffect,useState} from 'react'
import {clearHistory,configureLearning,domains,exportEvidence,record,useHistory,useLearning} from './session'
import type {Domain,Interaction} from './session'

type Layout={shortcut:Domain;compact:boolean}
type Trial={origin:Domain;condition:string;target:Domain;start:number;steps:number;errors:number;effort:number|null;end:number|null;success:boolean|null}
let layout:Layout|null=null, previous:Layout|null=null
let undoAvailable=false
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
 const [preview,setPreview]=useState<Domain[]>(['CORTEX','CORTEX'])
 const previewIcons=[BookOpen,Boxes,GitBranch,SlidersHorizontal,Orbit,ScanText]
 const descriptions=['Read and compare field notes.','Follow a shipment to an order.','Compare measured recommendations.','Arrange workspace shortcuts.','Steer a search query.','Resolve a word with competing meanings.']
 const events=useHistory(),enabled=useLearning()
 const [,refresh]=useState(0),[pref,setPref]=useState<Domain>('CORTEX'),[effort,setEffort]=useState('')
 const update=()=>refresh(x=>x+1)
 const scores=learn(events,context),best=scores.find(s=>s.positive&&s.estimate>.5&&!dismissed.has(context+'/'+s.domain))
 const reviews=events.filter(e=>e.domain==='MORPH'&&['approve','reject'].includes(e.action))
 const accepted=reviews.filter(e=>e.action==='approve').length
 const backs=events.filter(e=>e.action==='back').length
 const reset=()=>{setPreview(['CORTEX','CORTEX']);configureLearning(false);clearHistory();layout=null;previous=null;undoAvailable=false;trial=null;results=[];trialCount=0;dismissed.clear();lastVisit=null;window.dispatchEvent(new Event('vector-x-reset-preferences'));try{sessionStorage.removeItem('vector-x.inventory-saves.v1')}catch{};setEffort('');update()}
 const finish=(success:boolean)=>{if(!trial||trial.end!==null)return
  trial={...trial,end:Date.now(),success,effort:effort?Number(effort):null}
  results=[...results.slice(-31),trial];trialCount++;record(context,success?'complete':'retry');update()}
 const pair=trialCount%2===1?results.at(-1):undefined
 const target=pair?.target??layout?.shortcut??pref
 const canStart=enabled&&target!==context&&(!pair||context===pair.origin)&&(!trial||trial.end!==null)
 const useShortcut=enabled&&(!trial||trial.end!==null||trial.condition==='adaptive')?layout:null
 return <section className="workbench morph-desk"><small>Navigation studio</small><h2>Personalize your interface</h2><p>Try a destination in each preview. Enable learning to propose a shortcut.</p>
 <label><input data-tour="morph-consent" type="checkbox" checked={enabled} onChange={e=>{configureLearning(e.target.checked);if(e.target.checked)tourAction("morph-consent");if(!e.target.checked){trial=null;layout=null;previous=null;undoAvailable=false}update()}}/> Learn from this tab</label>
 <div className="layout-study preview-pair">{['Static','Adaptive'].map((name,index)=><section key={name}><small>{index?'Personalized preview':'Reference preview'}</small><h3>{name} layout</h3><div className="mini-window"><div className="mini-rail">{domains.map((d,i)=>{const Icon=previewIcons[i];return <button key={d} aria-pressed={preview[index]===d} onClick={()=>setPreview(v=>v.map((old,j)=>index===j?d:old))}><Icon size={13}/> {d}</button>})}</div><article><small>Workspace preview</small><h4>{preview[index]}</h4><p>{descriptions[domains.indexOf(preview[index])]}</p><button onClick={()=>onNavigate(preview[index])}>Open workspace <ArrowUpRight size={13}/></button>{index===1&&useShortcut&&<button className="pinned" key={useShortcut.shortcut} onClick={()=>onNavigate(useShortcut.shortcut)}>Shortcut to {useShortcut.shortcut}</button>}</article></div></section>)}</div>
 <p>{enabled?events.length+' opted-in interactions · '+backs+' backtracks.':'Learning is off. You can explore both previews privately.'} {reviews.length?accepted+' of '+reviews.length+' retained shortcut decisions accepted.':''}</p>
 <p>Human evaluation pending.</p><details className="expert-settings"><summary>What learning records</summary><p>Opt-in records up to 256 module names, actions and timestamps in memory. A smoothed reward estimate ranks shortcuts using explicit preference and completion as positive signals, retries and backtracks as negative signals. Query and document text are excluded.</p></details>
 {enabled&&<><label>Preferred destination<select value={pref} onChange={e=>setPref(e.target.value as Domain)}>{domains.map(d=><option key={d}>{d}</option>)}</select></label>
 <button data-tour="morph-prefer" onClick={()=>{record(pref,'prefer',context);tourAction('morph-prefer')}}>Record preference</button>
 <p>{events.length} recorded interactions · {backs} observed backtracks. Repeated navigation can indicate extra steps. Intent and frustration are unmeasured.</p>
 {best&&<><p>Suggested shortcut {best.domain} · {best.positive} positive and {best.negative} negative rewards · estimate {best.estimate.toFixed(2)}. Current layout {layout?.shortcut??'static'}.</p>
 <button data-tour="morph-accept" disabled={layout?.shortcut===best.domain} onClick={()=>{previous=layout;undoAvailable=true;layout={shortcut:best.domain,compact:true};record('MORPH','approve');tourAction('morph-accept');update()}}>Accept shortcut</button>
 <button onClick={()=>{dismissed.add(context+'/'+best.domain);record('MORPH','reject')}}>Reject adaptation</button></>}

 <details className="expert-settings"><summary>Reward estimates</summary>{scores.map(s=><p key={s.domain}>{s.domain} · {s.estimate.toFixed(2)} ({s.positive+s.negative} rewards)</p>)}</details>
 <button disabled={!undoAvailable} onClick={()=>{layout=previous;previous=null;undoAvailable=false;record(context,'undo');update()}}>Undo adaptation</button><button disabled={!layout} onClick={()=>{previous=layout;undoAvailable=true;layout=null;record(context,'undo');update()}}>Restore static layout</button>
 <h3>Navigation comparison</h3><p>Reach the displayed destination. Conditions alternate after a random first assignment. The shortcut is available in adaptive trials when a layout has been accepted. After arrival, report your outcome.</p>
 <p>{pair?'Return to '+pair.origin+' for the paired task to '+pair.target:'Choose a destination different from this workspace.'}</p>
 <button disabled={!canStart} onClick={()=>{const adaptive=pair?pair.condition==='static':crypto.getRandomValues(new Uint8Array(1))[0]%2===1
 trial={origin:context,condition:adaptive?'adaptive':'static',target,start:Date.now(),steps:0,errors:0,effort:null,end:null,success:null};setEffort('');update()}}>Start navigation task</button>
 {trial&&<><p role="status">{trial.condition} task · reach {trial.target} · {trial.steps} module changes · {trial.errors} intermediate destinations</p><label>Mental effort<select value={effort} onChange={e=>setEffort(e.target.value)}><option value="">Unrated</option>{[1,2,3,4,5,6,7].map(i=><option key={i}>{i}</option>)}</select></label>
 <button disabled={trial.end!==null||context!==trial.target} onClick={()=>finish(true)}>Mark destination reached</button><button disabled={trial.end!==null} onClick={()=>finish(false)}>End incomplete task</button></>}
 {results.length>0&&<div className="preview-scroll"><table><caption>Finished attempts retained in this tab</caption><thead><tr><th>Condition</th><th>Destination</th><th>Elapsed seconds</th><th>Route changes</th><th>Outcome</th></tr></thead><tbody>{results.map((r,i)=><tr key={i}><th>{r.condition}</th><td>{r.target}</td><td>{r.end===null?'Unavailable':((r.end-r.start)/1000).toFixed(1)}</td><td>{r.steps}</td><td>{r.success?'Reached':'Incomplete'}</td></tr>)}</tbody></table></div>}
 <button onClick={()=>exportEvidence('navigation-study',{events,context,scores,layout,trials:results,decisions:events.filter(e=>e.domain==='MORPH'&&['approve','reject'].includes(e.action)).length,acceptances:events.filter(e=>e.action==='approve'&&e.domain==='MORPH').length})}>Export local history</button></>}
 <button data-tour="morph-reset" onClick={reset}>Delete history and reset learning</button></section>
}

export function AtlasPreferences(){
 useEffect(()=>visit('VECTOR-X'),[])
 return <details><summary>Navigation preferences and study</summary><Morph context="VECTOR-X" onNavigate={d=>{location.hash=d.toLowerCase()}}/></details>
}
