import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {chromium} from 'playwright-core'

const phase=process.argv[2]
assert.ok(['before','after'].includes(phase))
const dir=new URL('../docs/ascension/'+phase+'/',import.meta.url)
await mkdir(dir,{recursive:true})
const routes=['mission-control','retrieval-debugger','cortex','supply','symbiosis','morph','vector-x','clarity','data-foundry','research-lab','evidence-vault']
const ready=['.probe-chart polyline','form .studio-grid','.relation-graph','.flow-list svg','.pareto-figure circle','.layout-study','.star','.reading-tree','input[type=file]','.retrieval-chart','text=Scientific review paused.']
if(phase==='after'){
 routes.push('system-flow?view=workflows&ps=PS05','guided-demo')
 ready.push('.node-inspector','text=Presentation mode')
}
const browser=await chromium.launch({channel:'chrome'})
const records=[]
try {
 for(const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844],[360,800]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'})
  for(const [index,route] of routes.entries()){
   await page.goto('http://localhost:5173/#'+route)
   await page.getByText('API connected',{exact:true}).waitFor()
   await page.locator(ready[index]).first().waitFor({state:'attached'})
   const title=await page.locator('main h1').first().innerText()
   await page.evaluate(()=>document.fonts.ready)
   const excess=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)
   const file=width+'-'+route.split('?')[0]+'.jpg'
   await page.screenshot({path:new URL(file,dir).pathname,type:'jpeg',quality:72})
   records.push({width,height,route,title,excess,file})
   if(phase==='after')assert.ok(excess<=1,route+' overflows by '+excess)
  }
  await page.close()
  console.log(width,'captured')
 }
 await writeFile(new URL('captures.json',dir),JSON.stringify(records,null,2)+'\n')
} finally {await browser.close()}
