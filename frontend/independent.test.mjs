import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {fixture} from './src/convergence/inventoryLedger.ts'

const dir=mkdtempSync(join(tmpdir(),'vector-x-scoring-'))
const file=join(dir,'cases.json')
const scorer=fileURLToPath(new URL('./score-independent.mjs',import.meta.url))
function score(mode,cases){
  writeFileSync(file,JSON.stringify(cases))
  return JSON.parse(execFileSync(process.execPath,[scorer,mode,file],{stdio:['ignore','pipe','pipe']}))
}
try{
  const cases=[{id:'a',text:'Send it',spans:[{kind:'referential',start:5,end:7}]},
    {id:'b',text:'Map the shore',spans:[]},{id:'c',text:'Near the bank',spans:[],resolution_correct:false}]
  const language=score('clarity',cases)
  assert.deepEqual([language.tp,language.fp,language.fn,language.specificity,language.resolutionAccuracy],[1,1,0,.5,0])
  assert.equal(score('clarity',[cases[1]]).resolutionAccuracy,null)
  assert.throws(()=>score('clarity',[cases[0],cases[0]]))
  const valid={id:'a',day:1,events:fixture,reject:false,orders:[{id:'O1',risk:false,ship:3},{id:'O2',risk:true,ship:null}]}
  const inventory=score('supply',[valid,{id:'b',day:1,events:[...fixture,fixture[3]],reject:true}])
  assert.deepEqual([inventory.acceptedValidCases,inventory.tp,inventory.exactShipDates,inventory.correctRejections,inventory.shipDateMaeDays],[1,1,2,1,0])
  assert.throws(()=>score('supply',[{...valid,orders:[]}]))
  console.log('Independent scorer passed 5 engineering checks, including undefined metrics and invalid labels.')
}finally{unlinkSync(file);rmdirSync(dir)}
