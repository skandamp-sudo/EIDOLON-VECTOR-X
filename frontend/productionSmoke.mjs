import assert from 'node:assert/strict'
import {chromium, devices} from 'playwright-core'
import {checkApplications} from './applicationSmoke.mjs'

const origin='https://eidolon-vector-x.vercel.app'
const api='https://vector-x-backend-production.up.railway.app'
const browser=await chromium.launch({channel:'chrome',headless:true})
try {
  for (const [name,options] of [
    ['desktop',{viewport:{width:1440,height:1000}}],
    ['mobile emulation',devices['Pixel 7']]
  ]){
    const context=await browser.newContext(options)
    const page=await context.newPage()
    page.setDefaultTimeout(45000)
    const errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    const foundation=page.waitForResponse(r=>r.url()===api+'/api/v1/foundation'&&r.ok())
    await page.goto(origin,{waitUntil:'domcontentloaded'})
    assert.equal((await (await foundation).json()).dimensions,8)
    await page.getByText('API connected',{exact:true}).waitFor()
    await page.getByRole('link',{name:'Data Foundry'}).click()
    await page.getByText(/Hosted file imports are disabled/).waitFor()
    await checkApplications(page,origin)
    assert.deepEqual(errors,[])
    console.log(name+' passed production API, hosted upload restriction and six walkthrough steps.')
    await context.close()
  }
} finally {
  await browser.close()
}
