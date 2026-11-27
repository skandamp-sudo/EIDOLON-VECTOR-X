import assert from 'node:assert/strict'
import {fixture,replay} from './src/convergence/inventoryLedger.ts'
// Authored expected shipment days, including cases with missing units.
const delay={id:'D',day:1,kind:'delivery',ref:'P1',qty:0,sku:'membrane',due:8}
const purchase={id:'A',day:1,kind:'approve',ref:'O2',qty:2,sku:'membrane',due:2}
let tp=0,fp=0,fn=0,reactiveHits=0,error=0,dated=0
const leads=[]
for(const [log,expected] of [[fixture,[3,null]],[[...fixture,delay],[8,null]],[[...fixture,purchase],[3,3]]]){
 const s=replay(log,1)
 s.rows.forEach((row,i)=>{
   const actual=expected[i]===null||expected[i]>row.due,alarm=row.risk
   if(actual&&alarm){tp++;leads.push(row.due-1)}
   if(!actual&&alarm)fp++
   if(actual&&!alarm)fn++
   if(actual&&row.due<=1&&row.missing>0)reactiveHits++
   if(expected[i]!==null){assert.notEqual(row.ship,null);error+=Math.abs(row.ship-expected[i]);dated++}
 })
}
const metrics={orderSnapshots:6,precision:tp/(tp+fp),recall:tp/(tp+fn),datedShipMaeDays:error/dated,dated,reactiveRecall:reactiveHits/(tp+fn),warningLeadDays:leads}
console.log(metrics)
assert.deepEqual([metrics.precision,metrics.recall,metrics.datedShipMaeDays],[1,1,0])
