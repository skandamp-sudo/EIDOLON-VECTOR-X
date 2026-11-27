import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright-core'

const browser=await chromium.launch({channel:'chrome'})
try {
 const page=await browser.newPage()
 await page.goto('http://localhost:5173/#retrieval-debugger')
 const selection=page.getByLabel('Retrieval encoder')
 for(const [name,dim] of [['legacy8',8],['legacy16',16],['expanded',128],['minilm',384]]){
  await selection.selectOption(name)
  await page.getByLabel('Candidate method').selectOption('spherical')
  await page.getByLabel('Requested steering strength').fill(name==='legacy16'?'-1':name==='legacy8'?'0':'1')
  const response=page.waitForResponse(r=>r.url().endsWith('/research-v2/debug'))
  await page.getByRole('button',{name:'Run comparison'}).click()
  const report=await (await response).json()
  assert.equal(report.dimensions,dim)
  assert.equal(report.encoder,name)
  assert.equal(Object.keys(report.summary).length,6)
  const downloading=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export reproducible report'}).click()
  const path=await (await downloading).path()
  const downloaded=JSON.parse(await readFile(path,'utf8'))
  const {source,...exportedReport}=downloaded
  assert.deepEqual(exportedReport,report)
  assert.ok(source.calibration)
  execFileSync(fileURLToPath(new URL('../.venv/bin/python',import.meta.url)),
   [fileURLToPath(new URL('../scripts/replay_focus.py',import.meta.url)),path],{stdio:'inherit'})
  const replay=await page.request.post('http://localhost:5173/api/v1/research-v2/debug',{
   data:downloaded.replay,headers:{'X-Vector-X-Client':'foundry'}})
  assert.deepEqual(await replay.json(),report)
  console.log(name,dim,report.gate,'export/replay passed')
 }
}finally{await browser.close()}
