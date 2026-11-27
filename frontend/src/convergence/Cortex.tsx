import {useMemo,useState} from 'react'
import GraphCanvas,{type GraphNode,type GraphEdge} from '../GraphCanvas'
import {tourAction} from '../tourState'
import {hosted} from '../apiOrigin'
import {openAtlasDraft} from './atlasDraft'
import {exportEvidence,record} from './session'

const sample=[
 'Field note A. The coastal pressure sensor recorded rising water levels. Water pressure rose during the morning tide.',
 'Field note B. The shore gauge did not record rising water levels at the sheltered inlet. The observer measured a different site.',
 'Lab note C. The resonant string vibrated at a higher frequency after tension increased.',
 'Review D. Comparing the coastal sensor and shore gauge requires aligned sampling times and locations.'
]
const stop=new Set('a an and are as at by did during for from had in is it not of on or that the to was with'.split(' '))
const terms=(s:string)=>(s.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)??[]).filter(t=>!stop.has(t))
function index(rows:string[]){
  const parts:{row:number;offset:number;text:string;words:string[]}[]=[]
  for(let i=0;i<rows.length&&parts.length<128;i++){
    for(let start=0;start<rows[i].length&&parts.length<128;){
      let end=Math.min(rows[i].length,start+600)
      const space=rows[i].lastIndexOf(' ',end)
      if(end<rows[i].length&&space>start)end=space+1
      const text=rows[i].slice(start,end)
      if(text.trim())parts.push({row:i+1,offset:start,text,words:terms(text)})
      start=end
    }
  }
  const df=new Map<string,number>()
  for(const p of parts)for(const t of new Set(p.words))df.set(t,(df.get(t)??0)+1)
  return parts.map(p=>{
    const weights=new Map<string,number>()
    for(const t of p.words)weights.set(t,(weights.get(t)??0)+1)
    for(const [t,n] of weights)weights.set(t,(1+Math.log(n))*(1+Math.log((parts.length+1)/(1+df.get(t)!))))
    const norm=Math.hypot(...weights.values())||1
    for(const [t,n] of weights)weights.set(t,n/norm)
    return {...p,weights,concepts:[...weights.keys()].sort((a,b)=>weights.get(b)!-weights.get(a)!).slice(0,5)}
  })
}
export default function Cortex({rows=sample,source='Illustrative field notebook'}:{rows?:string[];source?:string}){
 const passages=useMemo(()=>index(rows),[rows])
 const hierarchy=useMemo(()=>{
   const groups=new Map<string,number[]>()
   passages.forEach((p,i)=>{for(const term of p.concepts){const ids=groups.get(term)??[];ids.push(i);groups.set(term,ids)}})
   return [...groups].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).slice(0,12)
 },[passages])
 const [topic,setTopic]=useState('')
 const branch=hierarchy.find(([term])=>term===topic)??hierarchy[0]
 const [q,query]=useState('water levels'),[mode,setMode]=useState('Weighted concepts'),[sel,select]=useState(0),[focus,setFocus]=useState(false)
 const [marks,mark]=useState<Record<number,string>>({}),[start,setStart]=useState<number|null>(null),[answer,setAnswer]=useState(''),[decision,setDecision]=useState(''),[effort,setEffort]=useState<number|null>(null)
 const [study,setStudy]=useState<Record<string,unknown>|null>(null)
 const ranked=passages.map((p,id)=>({id,score:terms(q).reduce((s,t)=>s+(mode==='Keyword' ? Number(p.words.includes(t)):p.weights.get(t)??0),0)}))
 if(mode!=='Source order')ranked.sort((a,b)=>b.score-a.score||a.id-b.id)
 const queryWords=new Set(terms(q))
 const current=passages[sel]
 const peers=current?passages.map((p,id)=>({id,score:[...current.weights].reduce((s,[t,n])=>s+n*(p.weights.get(t)??0),0)})).filter(r=>r.id!==sel&&r.score>0).sort((a,b)=>b.score-a.score).slice(0,3):[]
 const ref=(id:number)=>'Row '+passages[id].row+' · offset '+passages[id].offset
 const [task,setTask]=useState('connections')
 const [filter,setFilter]=useState('')
 const [activeTerm,setActiveTerm]=useState('')
 const visible=ranked.filter(r=>passages[r.id].text.toLowerCase().includes(filter.toLowerCase()))
 const linked=peers.slice(0,3)
 const shared=current?[...current.weights.keys()].map(t=>({t,weight:linked.reduce((sum,r)=>sum+current.weights.get(t)!*(passages[r.id].weights.get(t)??0),0)})).filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight).slice(0,4).map(x=>x.t):[]
 const graphTerms=shared.length?shared:current?.concepts.slice(0,3)??[]
 const targets=[sel,...linked.map(r=>r.id)]
 const nodes:GraphNode[]=current?[{title:'Passage '+(sel+1),x:85,y:190},...graphTerms.map((t,i)=>({title:t,x:280,y:65+i*88,kind:'term' as const})),...linked.map((r,i)=>({title:'Passage '+(r.id+1),x:490,y:82+i*120,detail:'Passage similarity '+r.score.toFixed(3)}))]:[]
 const edges:GraphEdge[]=[]
 if(current)graphTerms.forEach((t,i)=>targets.forEach((id,j)=>{const w=passages[id].weights.get(t);if(w)edges.push({src:j?i+1:0,dst:j?graphTerms.length+j:i+1,label:w.toFixed(2),accent:t===activeTerm})}))
 function pick(id:number){select(id);setActiveTerm('');tourAction('passage')}
 return <section className="workbench cortex-desk"><header className="desk-head"><div><small>CORTEX / Research library</small><h2>Explore research and documents</h2><p>Follow a shared word to a second source, then assess what the passages support.</p></div></header>
 <nav className="desk-tabs" aria-label="Research tasks">{[['Library','library'],['Explore connections','connections'],['Assess evidence','assessment']].map(([label,id])=><button key={id} aria-pressed={task===id} onClick={e=>{setTask(id);const panel=e.currentTarget.closest('.workbench')?.querySelector<HTMLElement>('[data-anchor="'+id+'"]');(panel?.querySelector<HTMLElement>(id==='library'?'input':id==='assessment'?'select':'svg[tabindex]')??panel)?.focus()}}>{label}</button>)}</nav>
 <div className={focus?"notebook-grid read-focus":"notebook-grid"}><section data-anchor="library" tabIndex={-1} aria-label="Collection" className="library-pane"><small>Collection</small><h3>Research library</h3><p>{source} · {passages.length} passages</p><label>Find a passage<input type="search" value={filter} maxLength={100} onChange={e=>setFilter(e.target.value)} placeholder="Search text in this collection"/></label>
 <label>Research priority<input value={q} maxLength={300} onChange={e=>query(e.target.value)}/></label><div className="source-list" data-tour="passage">{visible.slice(0,128).map(r=><button key={r.id} aria-pressed={sel===r.id} aria-label={ref(r.id)} onClick={()=>pick(r.id)}><small>Passage {r.id+1}</small><span>{passages[r.id].text.slice(0,94)}</span></button>)}{!visible.length&&<p>No passages match. Clear the search to see the collection.</p>}</div>
 {!ranked.some(r=>r.score>0)&&<p>No query vocabulary overlaps the indexed passages.</p>}</section>
 <section tabIndex={-1} data-anchor="connections" className="relation-graph" data-tour="connections"><GraphCanvas title="Passage network" nodes={nodes} edges={edges} selected={activeTerm&&graphTerms.includes(activeTerm)?graphTerms.indexOf(activeTerm)+1:0} onSelect={i=>{if(i>0&&i<=graphTerms.length){setActiveTerm(graphTerms[i-1]);query(graphTerms[i-1]);tourAction('connection')}else{pick(i?linked[i-graphTerms.length-1].id:sel);tourAction('connection')}}}/><p className="map-key">▭ Passage　 ○ Weighted word　 ·　 Edge labels show word weight in each passage.</p>{!linked.length&&<p>No shared vocabulary with another indexed passage.</p>}</section>
 <section tabIndex={-1} data-anchor="assessment" aria-label="Source inspector" className="source-pane">{current&&<><small>Selected source</small><h3>Passage {sel+1}</h3><blockquote>{current.text.split(/([\p{L}\p{N}]+)/u).map((part,i)=>queryWords.has(part.toLowerCase())?<mark key={i}>{part}</mark>:part)}</blockquote>
 <label data-tour="assessment">Evidence assessment<select value={marks[sel]??''} onChange={e=>{mark({...marks,[sel]:e.target.value});if(e.target.value)tourAction('assessment')}}><option value="">Unassessed</option><option>Supports</option><option>Conflicts</option><option>Open question</option></select></label>
 {!hosted&&<button onClick={()=>openAtlasDraft(current.text,ref(sel))}>Open passage in Vector Warp</button>}
 <details><summary>Evidence comparison</summary>{Object.entries(marks).filter(([,v])=>v).map(([id,v])=><p key={id}>{v} (reader assessment) · {ref(+id)} · {passages[+id].text}</p>)}</details>
 <details open={focus}><summary>Source details and similarity</summary><p>{source} · {ref(sel)}</p>{peers.map(r=><button key={r.id} onClick={()=>pick(r.id)}>{ref(r.id)} · {r.score.toFixed(3)}</button>)}</details></>}</section></div>
 <details className="expert-settings"><summary>Reading settings</summary><label>Reading workflow<select disabled={start!==null} value={mode} onChange={e=>setMode(e.target.value)}>{['Weighted concepts','Keyword','Source order'].map(s=><option key={s}>{s}</option>)}</select></label><label><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)}/> Focus on selected passage</label>{branch&&<><label>Research scope<select value={branch[0]} onChange={e=>setTopic(e.target.value)}>{hierarchy.map(([t,ids])=><option key={t} value={t}>{t} · {ids.length} passages</option>)}</select></label>{branch[1].slice(0,12).map(id=><button key={id} onClick={()=>{pick(id);query(branch[0])}}>{branch[0]} → {ref(id)}</button>)}</>}<button disabled={!ranked.length} onClick={()=>pick(ranked[(ranked.findIndex(r=>r.id===sel)+1)%ranked.length].id)}>Next in reading sequence</button></details>
 {rows===sample&&<details><summary>Timed comprehension and decision task</summary><p>Identify the row reporting increased pressure. Decide whether the two water records establish a contradiction.</p>
 <button disabled={start!==null} onClick={()=>{setStudy(null);setStart(performance.now());setEffort(null);setAnswer('');setDecision('')}}>Start reading task</button>
 {start!==null&&<><label>Evidence row<input value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={3}/></label><label><span id="reader-decision-label">Decision</span><select aria-labelledby="reader-decision-label" value={decision} onChange={e=>setDecision(e.target.value)}><option value="">Choose</option><option>Contradiction established</option><option>Sites and times need alignment</option></select></label>
 <label>Mental effort (1–7)<select value={effort??''} onChange={e=>setEffort(e.target.value?Number(e.target.value):null)}><option value="">Unrated</option>{[1,2,3,4,5,6,7].map(n=><option key={n}>{n}</option>)}</select></label>
 <button disabled={!answer||!decision} onClick={()=>{setStudy({mode,comprehension:Number(answer==='1'),decision:Number(decision==='Sites and times need alignment'),elapsed_ms:Math.round(performance.now()-start),effort,reciprocal_rank:1/(ranked.findIndex(r=>r.id===0)+1)});setStart(null);record('CORTEX','complete')}}>Score my response</button></>}
 {study&&<><p>Evidence row 1. Row 4 calls for aligned locations and times. This attempt: {JSON.stringify(study)}</p><button onClick={()=>exportEvidence('reader-attempt',study)}>Export attempt</button></>}</details>}</section>
}
