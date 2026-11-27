import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {chromium} from 'playwright-core'

const out=process.argv[2], base='http://localhost:5173/#', browser=await chromium.launch({channel:'chrome'})
const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'})
const errors=[],captures=[],passed=[]
page.on('pageerror',e=>errors.push(e.message))
page.setDefaultTimeout(12000)
const btn=(n)=>page.getByRole('button',{name:n,exact:true})
const target=n=>page.locator('[data-tour="'+n+'"]').first()
async function shot(workspace,state,element){
 if(element)await element.waitFor({state:'visible'})
 if(!out)return
 if(element)await element.scrollIntoViewIfNeeded();else await page.evaluate(()=>scrollTo(0,0))
 const file=workspace+'-'+state+'.jpg';await page.screenshot({path:path.join(out,file),type:'jpeg',quality:81});captures.push(file)
}
async function visit(route,ready){
 await page.goto(base+route);await page.getByText('API connected',{exact:true}).first().waitFor();await page.locator(ready).first().waitFor({state:'visible'})
}
const tours={
 cortex:[()=>page.locator('[data-tour=passage] button').nth(1).click(),()=>page.locator('[data-tour=connections] svg [role=button]').nth(1).click(),()=>page.getByLabel('Evidence assessment').selectOption('Supports'),null],
 supply:[()=>target('supply-delay').click(),()=>target('supply-order').locator('button').first().click(),null,()=>target('supply-reset').click()],
 symbiosis:[()=>target('agent-goal').locator('button').first().click(),null,()=>target('agent-approve').click(),()=>target('agent-undo').click()],
 morph:[()=>target('morph-consent').check(),()=>target('morph-prefer').click(),()=>target('morph-accept').click(),null],
 clarity:[()=>target('clarify-inspect').click(),null,()=>page.getByRole('button',{name:/^ocean water waves/}).click(),()=>target('clarify-compare').click()],
 'vector-x':[null,()=>target('atlas-embed').click(),null,()=>target('atlas-target').selectOption('Botany'),null]
}
const readiness={cortex:'.relation-graph svg',supply:'.flow-list svg',symbiosis:'[data-tour=agent-approve]:enabled',morph:'.mini-window',clarity:'.reading-tree svg','vector-x':'.star'}
try{
 if(out)await mkdir(out,{recursive:true})
 for(const [name,steps] of Object.entries(tours)){
  await visit(name,readiness[name]);assert.equal(await btn('Beginner').getAttribute('aria-pressed'),'true')
  await shot(name,'entry');await shot(name,'example',page.locator(readiness[name]).first())
  await btn('Walk me through').click();const tip=page.getByLabel('Interactive walkthrough')
  await tip.waitFor()
  if(name==='cortex'){
   await tip.getByRole('button',{name:'Exit'}).click();await btn('Resume walkthrough').click()
   await page.goto(base+'mission-control');await tip.getByText(/control is unavailable/).waitFor()
   await tip.getByRole('button',{name:'Find control'}).click();await target('passage').waitFor()
   await tip.getByRole('button',{name:'Skip'}).click();await tip.getByRole('button',{name:'Back'}).click()
   await tip.getByRole('button',{name:'Restart'}).click()
  }
  for(let i=0;i<steps.length;i++){
   const next=tip.getByRole('button',{name:i===steps.length-1?'Finish':'Next',exact:true})
   if(steps[i]){assert.ok(await next.isDisabled(),name+' action must gate step '+i);await steps[i]();await tip.getByText('Action verified').waitFor()}
   if(i===0)await shot(name,'interaction',tip)
   if(i===(name==='vector-x'?3:2))await shot(name,'result',name==='morph'?page.locator('.preview-pair').first():tip)
   await next.click()
  }
  await page.getByText('Walkthrough finished.',{exact:true}).waitFor()
  // Exercise a real empty, error or unavailable state in each domain.
  if(name==='cortex'){await page.getByLabel('Find a passage').fill('no-such-field-note');await shot(name,'empty',page.getByText('No passages match.',{exact:false}));await page.getByLabel('Find a passage').fill('')}
  if(name==='supply'){await btn('Replay duplicate').click();await shot(name,'error',page.getByText('Duplicate event ID.',{exact:true}))}
  if(name==='symbiosis'){await page.getByLabel('Sweep query').fill(' ');await shot(name,'empty',page.getByText(/Enter a nonempty sweep query/));await page.getByLabel('Sweep query').fill('forest canopy gathers distant light');await target('agent-approve').waitFor()}
  if(name==='morph'){
   const rails=page.locator('.preview-pair .mini-rail')
   assert.equal(await rails.nth(1).getByRole('button').first().innerText(),'Shortcut to CORTEX')
   assert.equal(await rails.first().getByText('Shortcut to CORTEX').count(),0)
   await page.getByRole('status').filter({hasText:'Pinned CORTEX at the top'}).waitFor()
   await btn('Undo adaptation').click()
   assert.equal(await rails.getByText('Shortcut to CORTEX').count(),0)
   await target('morph-reset').click();assert.ok(!(await target('morph-consent').isChecked()));await shot(name,'learning-off',page.locator('.preview-pair').first())}
  if(name==='clarity'){await page.getByLabel('Instruction to interpret').fill('Inspect the telescope');await target('clarify-inspect').click();await shot(name,'no-cues',page.getByText('No rule matched this instruction.'))}
  if(name==='vector-x'){await target('atlas-query').fill('xylolith');await target('atlas-embed').click();await shot(name,'abstention',page.getByText(/No known vocabulary/));await target('atlas-query').fill('A telescope records light from a distant star.');await target('atlas-embed').click();await page.locator('.star').first().waitFor()}
  await btn('Advanced').click();assert.equal(await btn('Advanced').getAttribute('aria-pressed'),'true');await shot(name,'advanced',page.locator(({cortex:'.cortex-desk details.expert-settings',supply:'.logistics details.expert-settings',symbiosis:'.pareto-figure',morph:'.morph-desk details.expert-settings',clarity:'.clarity-studio details.expert-settings','vector-x':'.science-strip'})[name]).first())
  if(name==='cortex'){assert.equal(await page.getByLabel('Evidence assessment').inputValue(),'Supports');assert.ok(await page.getByLabel('Reading workflow').isVisible())}
  await btn('Beginner').click();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' mobile');await shot(name,'mobile');await page.setViewportSize({width:1440,height:900})
  passed.push(name);console.log('Verified '+name)
 }
 await visit('mission-control','.mission-hero');await shot('mission','entry');await target('mission-start').click()
 const tip=page.getByLabel('Interactive walkthrough')
 await tip.getByRole('button',{name:'Next',exact:true}).click();await tip.getByRole('button',{name:'Next',exact:true}).click();await target('mission-flow').click();await tip.getByText('Action verified').waitFor();await tip.getByRole('button',{name:'Next',exact:true}).click();await tip.getByRole('button',{name:'Finish'}).click()
 for(const view of ['platform','workflows','technical','trace']){
  await visit('system-flow?view='+view+'&ps=PS05','.map-canvas svg')
  if(view==='platform'){await btn('Data transfers').click();await page.getByRole('button',{name:'Inspect Retrieval Debugger'}).click();await btn('Processing engines').click();await page.getByLabel('Problem statement').selectOption('PS02');await page.getByRole('button',{name:'Inspect Deterministic inventory ledger'}).waitFor();await btn('Navigation').click()}
  const graph=page.locator('.map-canvas'),camera=graph.locator('[data-camera]'),original=await camera.getAttribute('transform')
  await graph.getByRole('button',{name:'Zoom in'}).click();assert.notEqual(await camera.getAttribute('transform'),original)
  await graph.locator('svg[tabindex]').focus();await page.keyboard.press('ArrowLeft')
  await graph.getByRole('button',{name:'Fit to view'}).click();assert.equal(await camera.getAttribute('transform'),original)
  await graph.getByRole('button',{name:'Fullscreen'}).click();await page.keyboard.press('Escape');assert.ok(!(await graph.getAttribute('class')).includes('expanded'))
  const node=graph.locator('g[role=button]').nth(2);await node.focus();await page.keyboard.press('Enter');assert.equal(await node.getAttribute('aria-pressed'),'true')
  if(view==='workflows'){
   await graph.getByRole('button',{name:'Inspect Quality gate?',exact:true}).click()
   assert.ok(await graph.locator('[data-selected-edge=incoming] path[stroke-dasharray]').count()>0)
   assert.ok(await graph.locator('[data-selected-edge=outgoing] path:not([stroke-dasharray])').count()>0)
  }
  const svg=graph.locator('svg[tabindex]'),box=await svg.boundingBox();assert.ok(box)
  const prior=await camera.getAttribute('transform');await page.mouse.move(box.x+6,box.y+6);await page.mouse.down();await page.mouse.move(box.x+37,box.y+28,{steps:3});await page.mouse.up();assert.notEqual(await camera.getAttribute('transform'),prior);await graph.getByRole('button',{name:'Reset view'}).click()
  const download=page.waitForEvent('download');await graph.getByRole('button',{name:'Export SVG'}).click();assert.equal((await download).suggestedFilename(),'eidolon-workflow.svg');await shot('flow',view,graph)
 }
 await visit('evidence-vault','.evidence-summary');await shot('evidence','fixture');await visit('guided-demo','main select');await shot('guide','presenter')
 assert.deepEqual(errors,[])
 const result={browser:browser.version(),tours:[...passed,'Introduction'],graphViews:4,chromeErrors:errors,captures}
 if(out)await writeFile(path.join(out,'checks.json'),JSON.stringify(result,null,2)+'\n')
 console.log(JSON.stringify(result))
}finally{await browser.close()}
