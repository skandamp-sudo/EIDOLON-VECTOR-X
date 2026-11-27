import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const browser=await chromium.launch({channel:'chrome',headless:true,timeout:30000})
try {
 const page=await browser.newPage()
 await page.goto('http://localhost:5173/#applications')
 const step=page.getByLabel('Walkthrough step')
 const check=process.argv[2]??'all'
 if(check==='all'||check==='cortex'){
  await page.getByLabel('Research priority').fill('pressure')
  await page.getByRole('button',{name:'Row 1 · offset 0'}).first().click()
  await page.getByLabel('Evidence assessment').selectOption('Supports')
  await page.getByText('Evidence comparison',{exact:true}).click()
  await page.getByText(/Supports \(reader assessment\)/).waitFor()
 }
 if(check==='all'||check==='supply'){
  await step.selectOption('2')
  await page.getByRole('button',{name:'Replay duplicate'}).click()
  await page.getByText('Duplicate event ID.').waitFor()
  await page.getByRole('button',{name:'Approve simulated PO'}).click()
  await page.getByText(/0 at-risk orders · 0 open proposals/).waitFor()
 }
 if(check==='all'||check==='symbiosis'){
  await step.selectOption('4')
  const approve=page.getByRole('button',{name:'Approve recommendation'})
  await approve.waitFor()
  await page.getByRole('button',{name:'Pause agent'}).click()
  assert.equal(await approve.isDisabled(),true)
  await page.getByRole('button',{name:'Resume agent'}).click()
  await page.getByLabel('Agent interaction mode').selectOption('Suggestion only')
  await approve.waitFor()
  assert.equal(await approve.isDisabled(),true)
  await page.getByRole('button',{name:'Abort pending action'}).click()
  await page.getByText(/Pending sweep aborted/).waitFor()
  await page.getByRole('button',{name:'Resume agent'}).click()
  await page.getByLabel('Agent interaction mode').selectOption('Automatic preview')
  await page.getByRole('button',{name:'Undo selection'}).click()
 }
 if(check==='all'||check==='morph'){
  await step.selectOption('3')
  const opt=page.getByLabel('Learn from this tab')
  assert.equal(await opt.isChecked(),false)
  await opt.check()
  await page.getByRole('button',{name:'Record preference'}).click()
  await page.getByRole('button',{name:'Accept shortcut'}).click()
  await page.getByRole('button',{name:'Shortcut to CORTEX'}).waitFor()
  await page.getByRole('button',{name:'Undo adaptation'}).click()
  assert.equal(await page.getByRole('button',{name:'Shortcut to CORTEX'}).count(),0)
  await page.getByRole('button',{name:'Delete history and reset learning'}).click()
  assert.equal(await opt.isChecked(),false)
 }
 if(check==='all'||check==='clarity'){
  await step.selectOption('1')
  await page.getByLabel('Instruction to interpret').fill('Send it')
  await page.getByRole('button',{name:'Inspect language'}).click()
  await page.getByText('DEFER',{exact:true}).waitFor()
  await page.getByLabel('Enter the entity or reference frame').fill('ocean waves')
  await page.getByRole('button',{name:'Use my interpretation'}).click()
  await page.getByText('PROCEED',{exact:true}).waitFor()
  await page.getByRole('button',{name:'Compare interpretation retrieval'}).click()
  await page.getByText(/top passages/).first().waitFor()
 }
 if(check==='all'||check==='core'){
  await step.selectOption('0')
  await page.getByRole('button',{name:'Open passage in Vector Warp'}).click()
  assert.match(await page.getByLabel('Query text').inputValue(),/Field note/)
  await page.getByRole('button',{name:'Embed query'}).click()
  await page.getByText(/Draft from Row/).waitFor()
  assert.equal(new URL(page.url()).hash,'#atlas')
 }
 if(check==='all'||check==='platform'){
  for(const width of [1400,390]){
   await page.setViewportSize({width,height:850})
   await page.goto('http://localhost:5173/#mission-control')
   const destinations=page.getByRole('navigation',{name:'Mission destinations'})
   await destinations.waitFor()
   assert.equal(await destinations.getByRole('link').count(),10)
   for(const name of ['CORTEX','SUPPLY','SYMBIOSIS','MORPH','VECTOR-X','CLARITY','Data Foundry','Research Lab','Evidence Vault']){
    await destinations.getByRole('link',{name,exact:true}).click()
    await page.getByRole('heading',{level:1,name:name==='VECTOR-X'?'Semantic atlas':name,exact:true}).waitFor()
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2)
    assert.equal(overflow,false,name+' overflows at '+width)
    await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('link',{name:'Mission Control',exact:true}).click()
   }
  }
 }
 // Additional module checks
 console.log('Convergence browser checks passed:',check)
} finally {await browser.close()}
