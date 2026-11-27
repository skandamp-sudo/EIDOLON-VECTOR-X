import assert from 'node:assert/strict'
import {fixture,replay} from './src/convergence/inventoryLedger.ts'
const base=replay(fixture,1)
assert.deepEqual(base.balances,[{sku:'membrane',onHand:4,incoming:6,allocated:10,net:0}])
assert.deepEqual(base.rows.map(x=>[x.ship,x.missing,x.risk]),[[3,0,false],[null,2,true]])
assert.deepEqual(base.proposals.map(p=>p.qty),[2])
assert.throws(()=>replay([...fixture,fixture[3]],1),/Duplicate/)
assert.throws(()=>replay([...fixture,{...fixture[3],qty:-2,id:'bad'}],1))
const approve={day:1,kind:'approve',sku:'membrane',ref:'O2',id:'A1',qty:2,due:2}
assert.deepEqual(replay([...fixture,approve],1).rows.map(o=>o.risk),[false,false])
assert.throws(()=>replay([...fixture,{...approve,qty:3}],1))
assert.equal(replay([...fixture,{...approve,kind:'delivery',qty:0,ref:'P1',due:8}],1).rows[0].ship,8)
assert.equal(replay(fixture,5).stale,true)
console.log('SUPPLY simulated ledger, allocation, approval and delay checks passed.')

const extra={...fixture[2],id:'O1b',sku:'gasket',qty:1,ref:'O1'}
const kit=replay([...fixture,extra],1).groups.find(g=>g.id==='O1')
assert.deepEqual(kit,{id:'O1',lines:['O1','O1b'],ship:null,risk:true})
assert.throws(()=>replay([...fixture,{...extra,due:8}],1),/same CRD/)

// Engineering stream. Two material lines require distinct dated receipts.
const incoming={id:'P2',kind:'purchase',day:1,qty:1,due:4,sku:'gasket',ref:''}
const delayed={id:'L2',kind:'delivery',day:2,qty:0,due:7,sku:'gasket',ref:'P2'}
const stream=[...fixture,extra,incoming,delayed]
assert.equal(replay(stream,2).groups.find(g=>g.id==='O1').ship,7)
assert.throws(()=>replay([...stream,{...incoming,id:'late-append'}],2),/Malformed/)
assert.throws(()=>replay([...stream,delayed],2),/Duplicate/)
assert.deepEqual(replay(stream,2),replay(structuredClone(stream),2))
