import {useEffect,useRef,useState} from 'react'
import {startTour} from './tourState'
type Step=[target:string,title:string,help:string,action?:string,route?:string]
const tours:Record<string,Step[]>={
 Introduction:[['mission-start','Start here','Each tool opens on a working example. The tour waits for your own actions.'],['mission-tools','Find a workspace','The six destinations describe the job each tool helps you do.'],['mission-flow','Understand the system','Open System Flow to inspect a real workflow.','open-flow'],['flow-view','Explore the diagram','Select a node to see its inputs, outputs and evidence.',undefined,'system-flow']],
 CORTEX:[['passage','Open a field note','Choose a passage from the library.','passage'],['connections','Trace a connection','Select a word or another passage in the network.','connection'],['assessment','Assess the passage','Choose Supports, Conflicts or Open question. This is your assessment.','assessment'],['connections','Read the weights','The edge labels show how strongly each word is represented in its passage.']],
 SUPPLY:[['supply-delay','Delay the sample shipment','Choose Delay supplier. This adds a simulated delivery event.','supply-delay'],['supply-order','Inspect an order','Choose an order to follow its allocated lots.','supply-order'],['supply-impact','Read the consequence','Compare its starting and projected ship dates. Unknown means the ledger cannot fill it.'],['supply-reset','Restore the scenario','Reset the simulated ledger to its initial events.','supply-reset']],
 SYMBIOSIS:[['agent-goal','Choose an objective','Choose stronger movement or less drift.','agent-goal'],['agent-options','Read the proposal','Inspect the gain and protected drift calculated for your goal.'],['agent-approve','Approve a local preview','Approve the recommendation if it meets your objective. If unavailable, inspect the constraints or skip.','agent-approve'],['agent-undo','Undo the preview','Restore the previous operating point.','agent-undo']],
 MORPH:[['morph-consent','Choose whether to learn','Enable learning only if you want tab-local interaction counts. You can skip this tour.','morph-consent'],['morph-prefer','Record a preference','Choose a preferred destination and record it.','morph-prefer'],['morph-accept','Review the shortcut','Accept the proposed shortcut to change the adaptive preview.','morph-accept'],['morph-reset','Control your history','Compare the previews. You can undo the change or delete the history.']],
 CLARITY:[['clarify-inspect','Inspect a sentence','Try “Compare waves near the bank” and inspect the language.','clarify-inspect'],['clarify-tree','Explore possible meanings','Select a highlighted word or tree node to inspect a cue.'],['clarify-answer','Clarify one meaning','Choose a reading or enter your interpretation.','clarify-answer'],['clarify-compare','Compare retrieved passages','Run the comparison. Continue when at least one reading returns evidence.','clarify-compare']],
 'VECTOR-X':[['atlas-query','Try a search','Read or edit the prefilled telescope query.'],['atlas-embed','Generate the embedding','Press Embed query and wait for the model response.','atlas-embed'],['atlas-map','Explore the map','Points are calibration documents. Their displayed coordinates use three PCA dimensions.'],['atlas-target','Change direction','Choose a different concept and wait for the model to recalculate.','atlas-target'],['atlas-result','Inspect the transformation','Read the retained cosine and displacement. Inspect protected directions in Intelligence.']]
}
type Progress={name:string;index:number;done:boolean;active:boolean;skipped:number[]}
const key='eidolon.walkthrough.017'
function read():Progress|null{try{const v=JSON.parse(sessionStorage.getItem(key)??'null');if(v&&Object.hasOwn(tours,v.name)&&Number.isInteger(v.index)&&tours[v.name][v.index]&&typeof v.done==='boolean'&&typeof v.active==='boolean'&&Array.isArray(v.skipped))return v}catch{}return null}
const pageRoute=(p:Progress)=>tours[p.name][p.index][4]??(p.name==='Introduction'?'mission-control':p.name.toLowerCase())
function go(p:Progress){const dest='#'+pageRoute(p);if(location.hash.split('?')[0]!==dest)location.hash=dest}
export default function Walkthrough({page}:{page:string}){
 const [progress,set]=useState<Progress|null>(read),[advanced,mode]=useState(()=>{try{return localStorage.getItem('eidolon.mode')==='advanced'}catch{return false}})
 const [bounds,rect]=useState<DOMRect|null>(null),[available,found]=useState(false),[message,say]=useState('')
 const [retry,scan]=useState(0),trigger=useRef<HTMLElement|null>(null)
 useEffect(()=>say(''),[page])
 const p=progress,step=p?tours[p.name][p.index]:null
 useEffect(()=>{document.documentElement.dataset.experience=advanced?'advanced':'beginner';try{localStorage.setItem('eidolon.mode',advanced?'advanced':'beginner')}catch{}
 const expand=()=>document.querySelectorAll<HTMLDetailsElement>('details.expert-settings').forEach(el=>{if(el.dataset.experience!==String(advanced)){el.open=advanced;el.dataset.experience=String(advanced)}})
 expand();const observer=new MutationObserver(expand);observer.observe(document.body,{childList:true,subtree:true});return ()=>observer.disconnect()
 },[advanced])
 useEffect(()=>{try{if(p)sessionStorage.setItem(key,JSON.stringify(p));else sessionStorage.removeItem(key)}catch{}},[p])
 useEffect(()=>{const start=(event:Event)=>{const name=(event as CustomEvent).detail;if(!Object.hasOwn(tours,name))return;trigger.current=document.activeElement as HTMLElement;const next={name,index:0,active:true,done:false,skipped:[]};say('');set(next);go(next)}
 window.addEventListener('eidolon-tour-start',start);return ()=>window.removeEventListener('eidolon-tour-start',start)},[])
 useEffect(()=>{if(!p?.active||!step)return
 const act=(event:Event)=>{if((event as CustomEvent).detail===step[3])set(v=>v?.active?{...v,done:true}:v)}
 window.addEventListener('eidolon-tour-action',act);return ()=>window.removeEventListener('eidolon-tour-action',act)
 },[p?.active,p?.name,p?.index])
 useEffect(()=>{if(!p?.active||!step)return
 let previous:Element|null=null,timer=0;const update=()=>{const t=document.querySelector<HTMLElement>('[data-tour="'+step[0]+'"]');if(t&&t!==previous){previous=t;t.scrollIntoView({block:'center',behavior:'instant'})}
 const b=t?.getBoundingClientRect();found(!!b&&b.width>0&&b.height>0);rect(b??null)}
 const schedule=()=>{cancelAnimationFrame(timer);timer=requestAnimationFrame(update)}
 update();const observer=new MutationObserver(schedule);observer.observe(document.querySelector('main')??document.body,{childList:true,subtree:true});window.addEventListener('resize',schedule);window.addEventListener('scroll',schedule,true)
 return ()=>{observer.disconnect();cancelAnimationFrame(timer);window.removeEventListener('resize',schedule);window.removeEventListener('scroll',schedule,true)}
 },[p?.active,p?.name,p?.index,page,retry])
 function leave(){set(v=>v?{...v,active:false}:null);trigger.current?.focus({preventScroll:true})}
 useEffect(()=>{if(!p?.active)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')leave()};window.addEventListener('keydown',escape);return ()=>window.removeEventListener('keydown',escape)},[p?.active])
 function move(delta:number,skip=false){if(!p)return;const skipped=skip?[...new Set([...p.skipped,p.index])]:p.skipped.filter(i=>i!==p.index)
 if(p.index+delta>=tours[p.name].length){say(skipped.length?'Tour ended · '+skipped.length+' steps skipped.':'Walkthrough finished.');set(null);trigger.current?.focus({preventScroll:true});return}
 const next={...p,index:p.index+delta,done:false,skipped};set(next);go(next)}
 const currentTour=Object.hasOwn(tours,page)?page:'Introduction'
 return <><div className="experience-tools"><div aria-label="Experience mode" role="group">{['Beginner','Advanced'].map((s,i)=><button key={s} aria-pressed={advanced===!!i} onClick={()=>mode(!!i)}>{s}</button>)}</div><button onClick={()=>startTour(currentTour)}>Walk me through</button>{p&&!p.active&&<button onClick={()=>{set({...p,active:true});go(p)}}>Resume walkthrough</button>}{message&&<span role="status">{message}</span>}</div>
 {p?.active&&step&&<>{available&&bounds&&<div className="tour-outline" aria-hidden="true" style={{left:bounds.left-3,top:bounds.top-3,width:bounds.width+6,height:bounds.height+6}}/>}<aside className={'tour-pop '+(bounds&&bounds.top>innerHeight*.54?'tour-top':'')} aria-label="Interactive walkthrough"><small>{p.name} · Step {p.index+1} of {tours[p.name].length}</small><h3>{step[1]}</h3><p>{available?step[2]:'This control is unavailable here. Return to the step, retry, or skip it.'}</p>{p.done&&<span role="status">Action verified</span>}<div>{!available&&<button onClick={()=>{go(p);scan(n=>n+1)}}>Find control</button>}<button disabled={p.index===0} onClick={()=>move(-1)}>Back</button><button disabled={(!available||!!step[3])&&!p.done} onClick={()=>move(1)}>{p.index+1===tours[p.name].length?'Finish':'Next'}</button><button onClick={()=>move(1,true)}>Skip</button><button onClick={()=>startTour(p.name)}>Restart</button><button onClick={leave}>Exit</button></div></aside></>}</>
}
