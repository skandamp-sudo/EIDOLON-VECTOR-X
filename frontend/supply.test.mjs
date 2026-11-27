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
