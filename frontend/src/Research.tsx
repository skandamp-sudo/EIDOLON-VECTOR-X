import { useEffect, useState } from 'react'
import { downloadFile } from './foundryData'
import { fmt } from './labTypes'
import Frontier from './Frontier'
import Recovery from './Recovery'

type Stat={n:number;mean:number|null;ci95:[number,number]|null}
type Outcome={gain:number|null;drift:number|null;cosine:number|null;violation:number|null;top:number[];recall:number;ndcg:number;applied:number|null;latency_ms:number|null;monotonicity:number|null;stability:number|null}
type Claim={id:number;gold:number[];represented:boolean;methods:Record<string,Outcome>}
type Model={dimensions:number;model_id:string;indexed:number;corpus_count:number;query_count:number;represented:number;encoding_ms:Stat;
  methods:Record<string,Record<string,Stat>>;queries:Claim[];fidelity:{trustworthiness:number;distance_rho:number;sample:number;overlap:number};matched:Record<string,{n:number;control:Record<string,Stat>;locked:Record<string,Stat>}>}
type Evidence={dataset:string;archive_sha256:string;source_commit:string;protocol_sha256:string;seed:number;peak_rss_mib:number;host:string;models:Model[];agreement:Record<string,Stat>}
const names:Record<string,string>={original:'Original',naive:'Naive centroid',ridge:'Learned ridge',locked:'Semantic Lock',ungoverned:'Lock without governor'}
function Vault({r}:{r:Evidence}){
  const [dimension,setDimension]=useState(0),[claim,setClaim]=useState(0)
  const m=r.models[dimension],q=m.queries[claim]
  function csv(){
    const rows=[['dimensions','claim_id','represented','method','gain','drift','cosine','violation','recall_at_3','ndcg_at_3','neighbor_overlap','monotonicity','latency_ms'].join(',')]
    for(const model of r.models)for(const c of model.queries)for(const [name,v] of Object.entries(c.methods)){
      rows.push([model.dimensions,c.id,c.represented,name,v.gain,v.drift,v.cosine,v.violation,v.recall,v.ndcg,v.stability,v.monotonicity,v.latency_ms].join(','))
    }
    downloadFile('vector-x-heldout.csv','text/csv;charset=utf-8',rows.join('\r\n'))
  }
  return <section className="panel foundry-panel"><div className="section-title"><h2>Evidence Vault</h2><div className="foundry-actions">
    <button onClick={csv}>Export outcomes CSV</button><button onClick={()=>downloadFile('vector-x-evidence.json','application/json',JSON.stringify(r))}>Export evidence JSON</button></div></div>
    <p role="status"><strong>Scientific review paused.</strong> The 16D reproduction changed three third-place IDs for claims 589 and 1107. These are provisional first-run outcomes.</p>
    <p>{r.dataset}. Retrieval includes abstentions. Gain, drift and violations use represented queries only.</p>
    <label>Encoder configuration<select value={dimension} onChange={e=>setDimension(Number(e.target.value))}>{r.models.map((m,i)=><option key={i} value={i}>{m.dimensions}D calibration TF–IDF / LSA</option>)}</select></label>
    <div className="foundry-stats"><span><b>{m.represented} / {m.query_count}</b> queries represented</span><span><b>{m.indexed} / {m.corpus_count}</b> documents indexed</span><span><b>{fmt(m.encoding_ms.mean)} ms</b> mean query encoding</span></div>
    <div className="preview-scroll"><table><caption>Equal requested strength +1.5</caption><thead><tr>{['Method','Gain','Drift','Violations','Cosine','Recall@3','nDCG@3','Monotonicity','Stability','Latency ms'].map(h=><th key={h}>{h}</th>)}</tr></thead>
      <tbody>{Object.entries(m.methods).map(([k,s])=><tr key={k}><th>{names[k]}</th><td>{fmt(s.gain.mean)}</td><td>{fmt(s.drift.mean)}</td>
        <td>{m.queries.filter(c=>c.methods[k].violation===1).length}/{s.violation.n}</td>{['cosine','recall','ndcg','monotonicity','stability','latency_ms'].map(v=><td key={v} title={'Bootstrap interval: '+(s[v].ci95?.map(fmt).join(' to ')??'Unavailable')}>{fmt(s[v].mean)}</td>)}</tr>)}</tbody></table></div>
    <details><summary>Matched target gain and projection reliability</summary>
      {Object.entries(m.matched).map(([k,v])=><p key={k}>{names[k]} · {v.n} matches · control / locked drift {fmt(v.control.drift.mean)} / {fmt(v.locked.drift.mean)} · nDCG {fmt(v.control.ndcg.mean)} / {fmt(v.locked.ndcg.mean)}.</p>)}
      <p>{m.fidelity.sample} projected points · trustworthiness {fmt(m.fidelity.trustworthiness)} · distance rank correlation {fmt(m.fidelity.distance_rho)} · overlap {fmt(m.fidelity.overlap)}.
      Between-configuration locked neighbor agreement {fmt(r.agreement.locked.mean)}.</p></details>
    <label>Inspect held-out claim<select value={claim} onChange={e=>setClaim(Number(e.target.value))}>{m.queries.map((q,i)=><option key={q.id} value={i}>{q.id} · {q.represented?'represented':'abstained'}</option>)}</select></label>
    <p>Independent evidence IDs · {q.gold.join(', ')}. {q.represented?'':'The frozen vocabulary produced no query vector.'}</p>
    {Object.entries(q.methods).map(([k,v])=><p key={k}><b>{names[k]}</b> · retrieved {v.top.join(', ')||'none'} · Recall@3 {fmt(v.recall)} · gain {fmt(v.gain)}.</p>)}
    <details><summary>Provenance and reproduction</summary><p>Source commit {r.source_commit} · seed {r.seed} · model {m.model_id}</p><p>Archive SHA-256 {r.archive_sha256} · protocol SHA-256 {r.protocol_sha256}</p>
      <p>{r.host} · evaluation process peak {fmt(r.peak_rss_mib)} MiB. Run <code>OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 .venv/bin/python -m scripts.phase3_evidence</code> after fetching the pinned archive.</p></details>
  </section>
}
export default function Research({online}:{online:boolean}){
  const [record,setRecord]=useState<Evidence|null>(null),[error,setError]=useState('')
  useEffect(()=>{const c=new AbortController()
    fetch('/evidence/phase3.json',{signal:c.signal}).then(async res=>{if(!res.ok)throw Error('Evidence unavailable.');const value=await res.json();if(!value.models?.length)throw Error('Evidence unavailable.');setRecord(value)})
      .catch(()=>{if(!c.signal.aborted)setError('The published evaluation record could not be loaded.')})
    return ()=>c.abort()
  },[])
  return <section className="foundry intelligence"><div className="atlas-intro"><h1>Research Lab</h1><p>Inspect independent retrieval judgments and test the cost of steering on the calibration index.</p></div>
    <Recovery online={online}/>
    {record?<Vault r={record}/>:<p role="status">{error||'Loading public evidence…'}</p>}
    {online?<Frontier/>:<p role="status">The live frontier needs an available model service.</p>}</section>
}
