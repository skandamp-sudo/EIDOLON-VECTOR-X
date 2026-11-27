import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {chromium} from 'playwright-core'
const base='http://localhost:5173/', flows=JSON.parse(await readFile(new URL('./src/workflows.json',import.meta.url)))
const browser=await chromium.launch({channel:'chrome'})
const faulty=[],counts={nodes:0,viewports:0,presentationSteps:0}
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'})
 page.on('pageerror',e=>faulty.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))faulty.push(m.text())})
 page.setDefaultTimeout(12000)
 for(const f of flows){
  await page.goto(base+'#system-flow?view=workflows&ps='+f.id)
  for(const n of f.nodes){
   const entry=page.getByRole('button',{name:'Inspect '+n.title,exact:true})
   await entry.focus();await page.keyboard.press('Enter')
   await page.locator('.node-inspector h3').filter({hasText:n.title}).waitFor()
   assert.equal(await entry.getAttribute('aria-pressed'),'true')
   counts.nodes++
  }
  assert.equal((await page.request.get(base+f.evidence.slice(1))).status(),200)
 }
 for(const width of [360,390,768,1280,1440]){
  await page.setViewportSize({width,height:width===360||width===1280?800:width===768?1024:width===390?844:900})
  for(const hash of ['system-flow?view=platform','system-flow?view=workflows&ps=PS05','system-flow?view=technical','system-flow?view=trace','guided-demo','evidence-vault']){
   await page.goto(base+'#'+hash);await page.locator('main h1').first().waitFor()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),hash+' '+width);counts.viewports++
  }
 }
 await page.goto(base+'#guided-demo')
 for(const [mode,n] of [['90-second overview',3],['5-minute flagship',6],['Six-workspace tour',6]]){
  await page.getByLabel('Presentation mode').selectOption(mode)
  for(let i=0;i<n;i++){
   const proof=await page.getByRole('link',{name:'Inspect recorded artifact'}).getAttribute('href')
   assert.equal((await page.request.get(base+proof.slice(1))).status(),200)
   if(i<n-1)await page.getByRole('button',{name:'Next step'}).click()
   counts.presentationSteps++
  }
 }
 await page.goto(base+'#retrieval-debugger')
 await page.getByLabel('Search query',{exact:true}).fill('ocean waves')
 await page.getByRole('button',{name:'Run comparison'}).click()
 await page.getByRole('button',{name:'Review active task in SYMBIOSIS'}).click()
 await page.getByLabel('Feasible operating point').waitFor();assert.equal(await page.getByLabel('Sweep query').inputValue(),'ocean waves')
 assert.equal(await page.getByLabel('Relevant calibration point IDs').inputValue(),'6')
 await page.goBack();assert.equal(await page.getByLabel('Search query',{exact:true}).inputValue(),'ocean waves')
 await page.goto(base+'#clarity')
 await page.getByLabel('Instruction to interpret').fill('Send it');await page.getByRole('button',{name:'Inspect language'}).click()
 await page.getByLabel('Enter the entity or reference frame').fill('ocean waves');await page.getByRole('button',{name:'Use my interpretation'}).click()
 await page.getByRole('button',{name:'Open interpretation in Vector Warp'}).click()
 assert.match(await page.getByLabel('Query text').inputValue(),/Send it.*ocean waves/)
 await page.goBack();await page.getByText('PROCEED',{exact:true}).waitFor()
 // Retry only the failed reading while keeping the successful direct result.
 await page.getByLabel('Instruction to interpret').fill('Compare waves near the bank')
 await page.getByRole('button',{name:'Inspect language'}).click()
 const calls=new Map()
 await page.route('**/api/v1/explore',async r=>{
  const text=r.request().postDataJSON().text
  calls.set(text,(calls.get(text)??0)+1)
  if(text.includes(' · ')&&calls.get(text)===1)return r.fulfill({status:503,body:''})
  return r.continue()
 })
 await page.getByRole('button',{name:'Compare interpretation retrieval'}).click()
 await page.getByRole('button',{name:'Retry this reading'}).first().waitFor()
 const direct='Compare waves near the bank'
 assert.equal(calls.get(direct),1)
 await page.getByRole('button',{name:'Retry comparison',exact:true}).click()
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Retry comparison'||b.textContent==='Cancel comparison'))
 assert.equal(calls.get(direct),1)
 await page.unroute('**/api/v1/explore')
 await page.goto(base+'#retrieval-debugger')
 await page.route('**/research-v2/debug-workspace',r=>r.fulfill({status:422,json:{detail:'Model unavailable in this verification fixture.'}}))
 await page.getByLabel('Retrieval encoder').selectOption('minilm')
 await page.getByText(/The selected model could not be loaded/).waitFor()
 assert.equal(await page.getByLabel('Retrieval encoder').inputValue(),'minilm')
 assert.equal(await page.getByRole('button',{name:'Run comparison'}).count(),0)
 await page.getByLabel('Retrieval encoder').selectOption('focus')
 await page.getByRole('button',{name:'Run comparison'}).waitFor()
 assert.deepEqual(faulty,[])
 console.log(JSON.stringify({...counts,browser:browser.version(),pageErrors:faulty,handoffs:['FOCUS → SYMBIOSIS and back','CLARITY → Atlas and back']}))
}finally{await browser.close()}
