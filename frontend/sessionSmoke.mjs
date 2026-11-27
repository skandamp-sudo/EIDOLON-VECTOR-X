import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const origin='http://localhost:5173'
const browser=await chromium.launch({channel:'chrome',headless:true,timeout:30000})
try{
  const first=await browser.newContext({reducedMotion:'reduce'})
  const second=await browser.newContext()
  const a=await first.newPage(), b=await second.newPage()
  const faults=[], external=[]
  a.on('pageerror',err=>faults.push(err.message))
  a.on('request',req=>{if(req.url().startsWith('http')&&new URL(req.url()).origin!==origin)external.push(new URL(req.url()).origin)})
  await a.goto(origin+'/#mission-control')
  await a.getByRole('heading',{name:'Mission Control',exact:true}).waitFor()
  const navigation=await a.evaluate(()=>performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd)
  await a.keyboard.press('Tab')
  assert.equal(await a.locator(':focus').innerText(),'Skip to workspace')
  assert.notEqual(await a.locator(':focus').evaluate(e=>getComputedStyle(e).outlineStyle),'none')
  await a.keyboard.press('Enter')
  assert.equal(await a.locator(':focus').getAttribute('id'),'workspace')
  assert.equal(await a.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true)
  await a.getByRole('navigation',{name:'Mission destinations'}).getByRole('link',{name:'MORPH',exact:true}).click()
  await a.getByLabel('Learn from this tab').waitFor()
  assert.equal(await a.locator(':focus').getAttribute('id'),'workspace')
  assert.match(await a.title(),/MORPH/)
  await a.getByLabel('Learn from this tab').check()
  await a.getByRole('button',{name:'Record preference'}).evaluate(el=>{for(let i=0;i<270;i++)el.click()})
  await a.getByText(/256 recorded interactions/).waitFor()
  await b.goto(origin+'/#morph')
  assert.equal(await b.getByLabel('Learn from this tab').isChecked(),false)
  await a.goto(origin+'/#supply')
  await a.getByRole('button',{name:'Approve simulated PO'}).click()
  await a.getByText(/0 open proposals/).waitFor()
  await b.goto(origin+'/#supply')
  await b.getByText(/1 open proposals/).waitFor()
  const cdp=await a.context().newCDPSession(a)
  async function heap(){await cdp.send('HeapProfiler.collectGarbage');return (await cdp.send('Runtime.getHeapUsage')).usedSize}
  const before=await heap()
  const stages=['CORTEX','SUPPLY','MORPH','CLARITY']
  for(let round=0;round<8;round++){
    for(const stage of stages){
      await a.evaluate(name=>{location.hash=name.toLowerCase()},stage)
      await a.getByRole('heading',{level:1,name:stage,exact:true}).waitFor()
    }
  }
  await a.goBack()
  await a.getByRole('heading',{name:'MORPH',exact:true,level:1}).waitFor()
  await a.goForward()
  await a.getByRole('heading',{name:'CLARITY',exact:true,level:1}).waitFor()
  await a.goto(origin+'/#supply')
  await a.getByText(/0 open proposals/).waitFor()
  const after=await heap()
  await a.reload()
  await a.getByText(/1 open proposals/).waitFor()
  assert.deepEqual(faults,[])
  assert.deepEqual(external,[])
  console.log(JSON.stringify({routeChanges:32,isolatedContexts:2,preferenceActions:270,retainedEvents:256,domContentLoadedMs:navigation,heapBeforeBytes:before,heapAfterBytes:after}))
}finally{await browser.close()}
