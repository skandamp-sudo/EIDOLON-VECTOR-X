import { useEffect, useMemo, useRef, useState } from 'react'
import { nearest, requestData } from './foundryData'
import type { Dataset, Neighbor } from './foundryData'
import type { FoundryPoint } from './FoundryMap'
import type { Topic } from './explore'

// Deterministic farthest-first representatives, followed by nearest-anchor assignment.
function landmarks(points:FoundryPoint[]) {
  const distances=points.map(()=>Infinity), assignments=points.map(()=>0), anchors:number[]=[]
  let next=0
  for(let g=0;g<Math.min(4,points.length);g++){
    anchors.push(next)
    const center=points[next].vector
    let farthest=0
    for(const [i,p] of points.entries()){
      const distance=1-p.vector.reduce((sum,x,j)=>sum+x*center[j],0)
      if(distance<distances[i]){distances[i]=distance;assignments[i]=g}
      if(distances[i]>distances[farthest])farthest=i
    }
    if(distances[farthest]<1e-9)break
    next=farthest
  }
  return anchors.map((i,g)=>({row:points[i].row,count:assignments.filter(a=>a===g).length}))
}
export default function CorpusExplorer({data,column,points,row,select,target,strength,model}:{data:Dataset;column:number;points:FoundryPoint[];row:number;select:(r:number)=>void;target:Topic;strength:number;model:string}){
  const groups=useMemo(()=>landmarks(points),[points])
  const related=useMemo(()=>nearest(points.filter(p=>p.row!==row),points.find(p=>p.row===row)!.vector),[row,points])
  const [a,setA]=useState(''),[b,setB]=useState(''),[chosen,setChosen]=useState<string|null>(null)
  const [results,setResults]=useState<{text:string;neighbors:Neighbor[]}[]>([]),[status,setStatus]=useState(''),[pending,setPending]=useState(false)
  const active=useRef<AbortController|null>(null)
  useEffect(()=>{setResults([]);setChosen(null);setStatus('');setPending(false);return()=>active.current?.abort()},[a,b,target,strength,points])
  async function search(){
    active.current?.abort()
    const controller=new AbortController();active.current=controller;setChosen(null);setResults([]);setPending(true);setStatus('')
    try{
      const items=[]
      for(const text of [a.trim(),b.trim()].filter(Boolean)){
        const r=await requestData<{model_id:string;steered:number[]}>('steer',JSON.stringify({text,target,strength}),controller.signal)
        if(r.model_id!==model || r.steered.length!==8 || !r.steered.every(Number.isFinite))throw Error('Unexpected model response.')
        items.push({text,neighbors:nearest(points,r.steered)})
      }
      if(!controller.signal.aborted)setResults(items)
    }catch(e){if(!controller.signal.aborted)setStatus(e instanceof Error?e.message:'Search failed.')}
    finally{if(!controller.signal.aborted)setPending(false)}
  }
  return <section className="panel foundry-panel"><h2>CORTEX · document exploration</h2>
    <p>Up to four farthest-first representatives summarize this index by cosine distance. Each group is named by its representative record.</p>
    <ul>{groups.map(g=><li key={g.row}><button onClick={()=>select(g.row)}>Inspect row {g.row+1}</button> · {g.count} records · {data.rows[g.row][column]}</li>)}</ul>
    <h3>Closest records to row {row+1}</h3><ol>{related.map(n=><li key={n.row}>Row {n.row+1} · {data.rows[n.row][column]} · {n.score.toFixed(3)}</li>)}</ol>
    <h3>CLARITY · compare interpretations</h3><p>Supply your intended reading and optionally a second interpretation. Search uses the selected {target} direction at {strength.toFixed(2)}.</p>
    <label>Directed search text<input value={a} maxLength={4096} onChange={e=>setA(e.target.value)}/></label>
    <label>Alternative interpretation<input value={b} maxLength={4096} onChange={e=>setB(e.target.value)}/></label>
    <button disabled={pending||!a.trim()} onClick={()=>void search()}>Search interpretations</button><p role="status">{status|| (pending?'Searching…':'')}</p>
    {results.filter(r=>chosen===null||chosen===r.text).map((r,i)=><article key={i}><h4>{r.text}</h4>
      <ol>{r.neighbors.map(n=><li key={n.row}>Row {n.row+1} · {data.rows[n.row][column]} · {n.score.toFixed(3)}</li>)}</ol>
      {results.length>1 && chosen===null && <button onClick={()=>setChosen(r.text)}>Use interpretation {i+1}</button>}</article>)}
    {chosen!==null && <button onClick={()=>setChosen(null)}>Show both interpretations</button>}</section>
}
