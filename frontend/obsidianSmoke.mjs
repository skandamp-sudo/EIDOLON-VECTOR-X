import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'

const browser = await chromium.launch({channel:'chrome'})
try {
  const page = await browser.newPage({viewport:{width:360,height:800}, reducedMotion:'reduce'})
  const faults = []
  page.on('pageerror', error => faults.push(error.message))
  await page.goto('http://localhost:5173/#mission-control')
  await page.getByText('API connected', {exact:true}).waitFor()
  await page.getByRole('button', {name:'Start Guided Demo'}).click()
  assert.equal(await page.getByLabel('Scenario stage').evaluate(el=>el===document.activeElement), true)
  const menu = page.getByRole('button',{name:'Open workspace menu'})
  await menu.click()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  await menu.click()
  await page.getByRole('dialog').getByRole('link',{name:'SUPPLY',exact:true}).click()
  await page.getByRole('heading',{name:'Allocation flow'}).waitFor()
  await page.getByRole('button',{name:'Delay supplier'}).click()
  await page.getByText('P1 · expected arrival').waitFor()
  assert.match(await page.locator('.day-list').innerText(), /Day 8/)
  for (const route of ['mission-control','supply','vector-x','cortex','symbiosis','morph','clarity','data-foundry','research-lab','evidence-vault']) {
    await page.goto('http://localhost:5173/#'+route)
    await page.waitForFunction(r=>document.title.toLowerCase().replaceAll(' ','-').startsWith(r+'-')&&document.querySelector('main h1'),route)
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), route+' at 360px')
  }
  await page.setViewportSize({width:1440,height:900})
  await page.getByRole('button',{name:'Collapse navigation'}).click()
  await page.getByRole('navigation',{name:'Workspace',exact:true}).getByRole('link',{name:'CLARITY'}).click()
  await page.getByRole('heading',{name:'Ambiguity X-Ray'}).waitFor()
  await page.getByRole('button',{name:'Expand navigation'}).click()
  assert.deepEqual(faults, [])
  console.log('Obsidian guided focus, drawer, Escape, compact navigation, delivery update and ten 360px routes passed.')
} finally {
  await browser.close()
}
