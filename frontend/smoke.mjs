import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 920 } })
  page.setDefaultTimeout(30000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('pageerror', error => console.error('Browser error:', error.message))
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/health')) {
      console.error('HTTP', response.status(), new URL(response.url()).pathname)
    }
  })
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' })
  await page.getByText('API connected', { exact: true }).waitFor()
  await page.locator('.scene canvas, .scene .flat-scene').first().waitFor()
  const sample = page.getByLabel('Calibration probe', { exact: true })
  await sample.selectOption('1')
  await page.getByText('“Cold ocean currents carry water through the deep.”').waitFor()
  await page.getByText('Inspect coefficients', { exact: true }).click()
  assert.equal(await page.locator('.coeff li').count(), 8)
  await page.getByRole('button', { name: 'Rotate right' }).click()
  await page.getByRole('button', { name: 'Reset orientation' }).click()
  await page.getByRole('button', { name: /Vector Forge/ }).click()
  await page.getByRole('dialog').waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.getByRole('link', { name: 'Protocol' }).click()
  await page.getByRole('heading', { name: 'Evaluation protocol' }).waitFor()
  await page.getByRole('link', { name: 'Architecture' }).click()
  await page.getByRole('heading', { name: 'System architecture' }).waitFor()
  await page.getByRole('link', { name: 'Overview' }).click()
  await page.route('**/api/v1/health', route => route.fulfill({ status: 503, body: '' }))
  await page.getByText('API unavailable', { exact: true }).waitFor()
  assert.equal(await sample.isDisabled(), true)
  assert.equal(await page.locator('.scene').count(), 0)
  await page.unroute('**/api/v1/health')
  await page.getByText('API connected', { exact: true }).waitFor()
  await sample.selectOption('0')
  await page.screenshot({ path: '../.runtime/overview.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: '../.runtime/mobile.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('Browser smoke passed: live samples, controls, module dialog, navigation, outage, recovery and mobile layout.')
} finally {
  await browser.close()
}
