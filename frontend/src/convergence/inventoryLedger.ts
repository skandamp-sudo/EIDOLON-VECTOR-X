export type Kind='receipt'|'order'|'purchase'|'delivery'|'adjustment'|'demand'|'approve'|'reject'
export type Entry={id:string;day:number;kind:Kind;sku:string;qty:number;due:number;ref:string}
type Lot={id:string;sku:string;qty:number;due:number}
export type Order={id:string;sku:string;qty:number;due:number;booked:number;group:string}
export const fixture:Entry[]=[
 {id:'R1',day:0,kind:'receipt',sku:'membrane',qty:4,due:0,ref:''},
 {id:'P1',day:0,kind:'purchase',sku:'membrane',qty:6,due:3,ref:''},
 {id:'O1',day:1,kind:'order',sku:'membrane',qty:8,due:4,ref:''},
 {id:'O2',day:1,kind:'order',sku:'membrane',qty:4,due:6,ref:''}
]
const kinds=['receipt','order','purchase','delivery','adjustment','demand','approve','reject']
const fail=(s:string):never=>{throw Error(s)}
export function replay(log:readonly Entry[],now:number){
 if(log.length>256||!Number.isSafeInteger(now)||now<0||now>10000)fail('Simulation limits exceeded.')
 const ids=new Set<string>(),stock=new Map<string,number>(),lots:Lot[]=[],orders:Order[]=[]
 const decisions=new Set<string>()
 let prev=0
 const plan=()=>{
  const remaining=new Map(stock)
  const incoming=lots.map(l=>({...l})).sort((a,b)=>a.due-b.due||a.id.localeCompare(b.id))
  return orders.map(o=>{
   let need=o.qty
   const available=Math.max(0,remaining.get(o.sku)??0)
   const used=Math.min(available,need)
   remaining.set(o.sku,available-used);need-=used
   let ship=now,shortByDate=o.qty-(now<=o.due?used:0)
   const allocation:{source:string;qty:number}[]=[]
   if(used)allocation.push({source:'on-hand',qty:used})
   for(const l of incoming){
    if(!need||l.sku!==o.sku||!l.qty)continue
    const n=Math.min(l.qty,need)
    l.qty-=n;need-=n;ship=Math.max(ship,l.due)
    if(Math.max(now,l.due)<=o.due)shortByDate-=n
    allocation.push({source:l.id,qty:n})
   }
   return {...o,allocation,used,ship:need?null:ship,missing:need,shortByDate,risk:need>0||ship>o.due}
  })
 }
 for(const e of log){
  if(!e||typeof e!=='object'||Object.keys(e).sort().join()!=='day,due,id,kind,qty,ref,sku'||![e.id,e.sku].every(x=>typeof x==='string'&&/^[\w-]{1,32}$/.test(x))||typeof e.ref!=='string'||e.ref.length>32||!kinds.includes(e.kind)||
     ![e.day,e.due,e.qty].every(Number.isSafeInteger)||e.day<prev||e.day>now||e.due<0||e.due>10000||Math.abs(e.qty)>100000||e.qty<0&&e.kind!=='adjustment')fail('Malformed event, quantity or day.')
  if(ids.has(e.id))fail('Duplicate event ID.')
  prev=e.day;ids.add(e.id)
  const balance=stock.get(e.sku)??0
  if(e.kind==='receipt'||e.kind==='adjustment'){
   if(balance+e.qty<0||e.qty===0)fail('Invalid stock change.')
   if(e.ref){
    const l=lots.find(x=>x.id===e.ref&&x.sku===e.sku)
    if(!l||e.kind!=='receipt'||e.qty>l.qty)throw Error('Invalid linked receipt.')
    l.qty-=e.qty
   }
   stock.set(e.sku,balance+e.qty)
  }else if(e.kind==='order'||e.kind==='purchase'){
   if(!e.qty||e.due<e.day||(e.ref&&(e.kind!=='order'||!/^[-\w]{1,32}$/.test(e.ref))))fail('Supply and orders require a dated positive quantity.')
   if(e.kind==='order'){
    const group=e.ref||e.id
    if(orders.some(o=>o.group===group&&o.due!==e.due))fail('Grouped material lines require the same CRD.')
    orders.push({...e,group,booked:e.day})
   }
   else lots.push({...e})
  }else if(e.kind==='delivery'){
   const l=lots.find(x=>x.id===e.ref&&x.sku===e.sku)
   if(!l||e.due<e.day||e.qty!==0)throw Error('Unknown purchase or invalid arrival date.')
   l.due=e.due
  }else{
   const o=orders.find(x=>x.id===e.ref&&x.sku===e.sku)
   if(!o)throw Error('Unknown order.')
   if(e.kind==='demand'){if(!e.qty)fail('Demand revision must be positive.');o.qty=e.qty}
   else{
    const required=plan().find(r=>r.id===e.ref)!.missing
    const key=e.ref+'@'+required
    if(!required||decisions.has(key))fail('No open proposal for this shortage.')
    if(e.kind==='approve'&&(!e.qty||e.qty>required||e.due<e.day))fail('Approval exceeds missing quantity or has invalid date.')
    if(e.kind==='reject'&&e.qty!==0)fail('Reject quantity must be zero.')
    decisions.add(key)
    if(e.kind==='approve')lots.push({...e})
   }
  }
 }
 const rows=plan()
 const balances=Array.from(new Set(log.map(e=>e.sku))).map(sku=>{
  const onHand=stock.get(sku)??0,incoming=lots.filter(x=>x.sku===sku).reduce((n,x)=>n+x.qty,0)
  const allocated=rows.filter(x=>x.sku===sku).reduce((n,x)=>n+x.qty-x.missing,0)
  return {sku,onHand,incoming,allocated,net:onHand+incoming-allocated}
 })
 const groups=Array.from(new Set(rows.map(o=>o.group)),id=>{
  const lines=rows.filter(o=>o.group===id)
  return {id,lines:lines.map(o=>o.id),ship:lines.some(o=>o.ship===null)?null:Math.max(...lines.map(o=>o.ship!)),risk:lines.some(o=>o.risk)}
 })
 return {balances,groups,rows,stale:!log.length||now-prev>2,proposals:rows.filter(o=>o.missing&&!decisions.has(o.id+'@'+o.missing)).map(o=>({order:o.id,sku:o.sku,qty:o.missing,evidence:log.filter(e=>e.sku===o.sku).map(e=>e.id)}))}
}
