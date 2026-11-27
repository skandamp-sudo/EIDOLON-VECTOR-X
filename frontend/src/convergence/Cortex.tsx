import {useMemo,useState} from 'react'
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
 const [q,query]=useState('water levels'),[mode,setMode]=useState('Weighted concepts'),[sel,select]=useState(0),[focus,setFocus]=useState(false)
 const [marks,mark]=useState<Record<number,string>>({}),[start,setStart]=useState<number|null>(null),[answer,setAnswer]=useState(''),[decision,setDecision]=useState(''),[effort,setEffort]=useState(4)
 const [study,setStudy]=useState<Record<string,unknown>|null>(null)
 const ranked=passages.map((p,id)=>({id,score:terms(q).reduce((s,t)=>s+(mode==='Keyword' ? Number(p.words.includes(t)):p.weights.get(t)??0),0)}))
 if(mode!=='Source order')ranked.sort((a,b)=>b.score-a.score||a.id-b.id)
 const current=passages[sel]
 const peers=current?passages.map((p,id)=>({id,score:[...current.weights].reduce((s,[t,n])=>s+n*(p.weights.get(t)??0),0)})).filter(r=>r.id!==sel&&r.score>0).sort((a,b)=>b.score-a.score).slice(0,3):[]
 const ref=(id:number)=>'Row '+passages[id].row+' · offset '+passages[id].offset
 return <section className="panel foundry-panel"><h2>CORTEX research reader</h2><p>{source} · {passages.length} passages · first 128 nonblank chunks of up to 600 UTF-16 units. Local Data Foundry opens this reader on the mapped text column.</p>
 <label>Research priority<input value={q} maxLength={300} onChange={e=>query(e.target.value)}/></label>
 <label>Reading workflow<select disabled={start!==null} value={mode} onChange={e=>setMode(e.target.value)}>{['Weighted concepts','Keyword','Source order'].map(s=><option key={s}>{s}</option>)}</select></label>
 <label><input type="checkbox" checked={focus} onChange={e=>setFocus(e.target.checked)}/> Focus on selected passage</label>
 {!focus&&<ol>{ranked.slice(0,8).map(r=><li key={r.id}><button onClick={()=>select(r.id)}>{ref(r.id)}</button> · {passages[r.id].concepts.slice(0,3).join(', ')} · {r.score.toFixed(2)}</li>)}</ol>}
 {!ranked.some(r=>r.score>0)&&<p>No query vocabulary overlaps the indexed passages.</p>}
 {current&&<><h3>{source} · {ref(sel)}</h3><blockquote>{current.text}</blockquote>{!hosted&&<button onClick={()=>openAtlasDraft(current.text,ref(sel))}>Open passage in Vector Warp</button>}
 <div className="foundry-actions">{current.concepts.map(t=><button key={t} onClick={()=>query(t)}>{t}</button>)}</div>
 <details><summary>Related passages by TF–IDF cosine</summary>{peers.map(r=><p key={r.id}><button onClick={()=>select(r.id)}>{ref(r.id)}</button> · {r.score.toFixed(3)} · {passages[r.id].text}</p>)}</details>
 <label>Evidence assessment<select value={marks[sel]??''} onChange={e=>mark({...marks,[sel]:e.target.value})}><option value="">Unassessed</option><option>Supports</option><option>Conflicts</option><option>Open question</option></select></label>
 <button onClick={()=>select(ranked[(ranked.findIndex(r=>r.id===sel)+1)%ranked.length].id)}>Next in reading sequence</button>
 <details><summary>Evidence comparison</summary>{Object.entries(marks).filter(([,v])=>v).map(([id,v])=><p key={id}>{v} (reader assessment) · {ref(+id)} · {passages[+id].text}</p>)}</details></>}
 {rows===sample&&<details><summary>Timed comprehension and decision task</summary><p>Identify the row reporting increased pressure. Decide whether the two water records establish a contradiction.</p>
 <button disabled={start!==null} onClick={()=>{setStudy(null);setStart(performance.now());setAnswer('');setDecision('')}}>Start reading task</button>
 {start!==null&&<><label>Evidence row<input value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={3}/></label><label>Decision<select value={decision} onChange={e=>setDecision(e.target.value)}><option value="">Choose</option><option>Contradiction established</option><option>Sites and times need alignment</option></select></label>
 <label>Mental effort (1–7)<input type="range" min="1" max="7" value={effort} onChange={e=>setEffort(+e.target.value)}/>{effort}</label>
 <button disabled={!answer||!decision} onClick={()=>{setStudy({mode,comprehension:Number(answer==='1'),decision:Number(decision==='Sites and times need alignment'),elapsed_ms:Math.round(performance.now()-start),effort,reciprocal_rank:1/(ranked.findIndex(r=>r.id===0)+1)});setStart(null);record('CORTEX','complete')}}>Score my response</button></>}
 {study&&<><p>Evidence row 1. Row 4 calls for aligned locations and times. This attempt: {JSON.stringify(study)}</p><button onClick={()=>exportEvidence('reader-attempt',study)}>Export attempt</button></>}</details>}</section>
}
