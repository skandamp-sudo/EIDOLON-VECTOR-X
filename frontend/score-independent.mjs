// Offline scoring for independently authored cases. The caller controls their provenance.
import {open} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {inspect} from './src/convergence/ambiguity.ts'
import {replay} from './src/convergence/inventoryLedger.ts'

const [mode,path]=process.argv.slice(2)
if(!['clarity','supply'].includes(mode)||!path)throw Error('Expected clarity or supply, followed by a local JSON file.')
const file=await open(path,'r')
let bytes
try{
  const size=(await file.stat()).size
  if(size<2||size>1_000_000)throw Error('Case files must be between 2 bytes and 1 MB.')
  bytes=Buffer.alloc(size)
  let pos=0
  while(pos<size){
    const {bytesRead}=await file.read(bytes,pos,size-pos,pos)
    if(!bytesRead)throw Error('Case file changed during reading.')
    pos+=bytesRead
  }
  if((await file.stat()).size!==size)throw Error('Case file changed during reading.')
}finally{await file.close()}
let cases
try{cases=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw Error('Expected valid UTF-8 JSON.')}
if(!Array.isArray(cases)||!cases.length||cases.length>512)throw Error('Provide 1–512 cases.')
const ids=new Set()
const requireLabel=(valid)=>{if(!valid)throw Error('Invalid case or missing ground truth at case '+ids.size)}
const ratio=(n,d)=>d?n/d:null
let tp=0,fp=0,fn=0,tn=0,exact=0,rejected=0,invalid=0,accepted=0,dated=0,daysError=0,undated=0,resolved=0,resolutionTrials=0
for(const c of cases){
  requireLabel(c&&typeof c.id==='string'&&c.id.trim().length>0&&!ids.has(c.id))
  ids.add(c.id)
  if(mode==='clarity'){
    requireLabel(typeof c.text==='string'&&c.text.trim()&&c.text.length<=240&&Array.isArray(c.spans))
    const kinds=['lexical','syntactic','referential','scope','pragmatic','contextual']
    const key=i=>JSON.stringify([i.kind,i.start,i.end])
    for(const s of c.spans)requireLabel(s&&kinds.includes(s.kind)&&Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.end>s.start&&s.end<=c.text.length)
    const gold=new Set(c.spans.map(key)),pred=new Set(inspect(c.text).map(key))
    requireLabel(gold.size===c.spans.length)
    const hits=[...pred].filter(k=>gold.has(k)).length
    tp+=hits;fp+=pred.size-hits;fn+=gold.size-hits
    if(!gold.size){invalid++;if(!pred.size)tn++}
    if(c.resolution_correct!==undefined&&c.resolution_correct!==null){
      requireLabel(typeof c.resolution_correct==='boolean')
      resolutionTrials++;resolved+=Number(c.resolution_correct)
    }
  }else{
    requireLabel(typeof c.reject==='boolean'&&Array.isArray(c.events)&&c.events.length<=256&&Number.isSafeInteger(c.day)&&c.day>=0&&c.day<=10000)
    let ledger
    try{ledger=replay(c.events,c.day)}catch(error){if(error.constructor!==Error)throw error}
    if(c.reject){invalid++;if(!ledger)rejected++;continue}
    requireLabel(Array.isArray(c.orders)&&c.orders.length>0)
    const orderIds=new Set()
    for(const o of c.orders){
      requireLabel(o&&typeof o.id==='string'&&!orderIds.has(o.id)&&typeof o.risk==='boolean'&&(o.ship===null||Number.isInteger(o.ship)&&o.ship>=0))
      orderIds.add(o.id)
    }
    if(ledger)accepted++
    const groups=new Map(ledger?.groups.map(g=>[g.id,g])??[])
    for(const o of c.orders){
      const g=groups.get(o.id)
      if(o.risk){if(g?.risk)tp++;else fn++}else if(g?.risk)fp++;else if(g)tn++
      if(g&&g.ship===o.ship)exact++
      if(o.ship!==null){if(g?.ship!=null){daysError+=Math.abs(g.ship-o.ship);dated++}else undated++}
    }
    for(const id of groups.keys())requireLabel(orderIds.has(id))
  }
}
const common={mode,cases:ids.size,sha256:createHash('sha256').update(bytes).digest('hex'),tp,fp,fn,
  precision:ratio(tp,tp+fp),recall:ratio(tp,tp+fn),f1:ratio(2*tp,2*tp+fp+fn)}
const measures=mode==='clarity'?{negativeCases:invalid,specificity:ratio(tn,invalid),resolutionTrials,
  resolutionAccuracy:ratio(resolved,resolutionTrials)}:{expectedReject:invalid,correctRejections:rejected,
  validCases:ids.size-invalid,acceptedValidCases:accepted,exactShipDates:exact,pairedDates:dated,
  missingDatedPredictions:undated,shipDateMaeDays:ratio(daysError,dated)}
console.log(JSON.stringify({...common,...measures},null,2))
