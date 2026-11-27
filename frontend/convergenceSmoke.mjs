import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const browser=await chromium.launch({channel:'chrome',headless:true})
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
 // Additional module checks
 console.log('Convergence browser checks passed:',check)
} finally {await browser.close()}
