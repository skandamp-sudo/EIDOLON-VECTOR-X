import assert from 'node:assert/strict'

export async function checkAtlasInspector(page, run) {
  const inspector = page.getByRole('region', {name: 'Semantic similarity inspector'})
  const rows = inspector.getByRole('list', {name: 'Ranked semantic matches'}).getByRole('listitem')
  const sort = inspector.getByLabel('Rank by')
  const topic = inspector.getByLabel('Topic', {exact: true})
  const limit = inspector.getByLabel('Match count', {exact: true})
  const docs = run.documents
  const ids = side => [...docs].sort((a, b) => b[side] - a[side] || a.id - b.id).map(d => d.id)
  const before = ids('before'), after = ids('after')
  assert.deepEqual(before.slice(0, 3), run.before)
  assert.deepEqual(after.slice(0, 3), run.after)
  const visibleIds = () => rows.locator('.match-id').allTextContents().then(labels =>
    labels.map(label => Number(/^Point (\d+)/.exec(label)[1]) - 1))
  assert.deepEqual(await visibleIds(), after.slice(0, 5))
  for (const [value, count] of [['3', 3], ['10', 10], ['all', docs.length]]) {
    await limit.selectOption(value)
    assert.deepEqual(await visibleIds(), after.slice(0, count))
  }
  for (const category of new Set(docs.map(d => d.topic))) {
    await topic.selectOption(category)
    assert.deepEqual(await visibleIds(), after.filter(id => docs[id].topic === category))
  }
  await topic.selectOption('all')
  await sort.selectOption('before')
  assert.deepEqual(await visibleIds(), before)
  for (const [mode, sign] of [['gain', 1], ['loss', -1]]) {
    await sort.selectOption(mode)
    const delta = d => sign * (d.after - d.before)
    const expected = docs.filter(d => delta(d) > 0).sort((a, b) => delta(b) - delta(a) || a.id - b.id)
    assert.deepEqual(await visibleIds(), expected.map(d => d.id))
  }
  await sort.selectOption('after')
  await limit.selectOption('5')
  const id = after[2], d = docs[id], row = rows.nth(2)
  await row.getByRole('button').focus()
  await page.keyboard.press('Enter')
  assert.equal(await row.getByRole('button').getAttribute('aria-pressed'), 'true')
  const star = n => page.getByRole('button', {name: 'Inspect document ' + (n + 1) + ', ' + docs[n].topic, exact: true})
  assert.equal(await star(id).locator('.hit').getAttribute('stroke'), 'white')
  assert.ok((await row.innerText()).includes(d.text))
  assert.deepEqual(await row.locator('.match-measures b').allTextContents(), [
    d.before.toFixed(4), d.after.toFixed(4), (d.after > d.before ? '+' : '') + (d.after - d.before).toFixed(4),
    '#' + (before.indexOf(id) + 1), '#3'
  ])
  await row.getByText('PCA coordinates').click()
  assert.equal(await row.locator('details p').innerText(), d.xyz.map((v, i) => 'PC' + (i + 1) + ' ' + v.toFixed(4)).join(' · '))
  await row.getByText('PCA coordinates').click()

  // The last painted point is in front even when projected points overlap.
  const front = page.locator('.galaxy .star').last()
  await front.locator('.hit').click()
  const pointId = /Inspect document (\d+)/.exec(await front.getAttribute('aria-label'))[1]
  assert.match(await inspector.locator('.match-pick[aria-pressed=true] .match-id').innerText(), new RegExp('^Point ' + pointId + ' ·'))
  const outside = after.at(-1)
  await star(outside).focus()
  await page.keyboard.press('Space')
  const selected = inspector.locator('.match-outside button[aria-pressed=true]')
  assert.ok((await selected.innerText()).includes(docs[outside].text))
  assert.deepEqual(await visibleIds(), after.slice(0, 5))
  await limit.selectOption('all')
  assert.equal(await inspector.locator('.match-outside').count(), 0)
  assert.equal(await rows.nth(docs.length - 1).getByRole('button').getAttribute('aria-pressed'), 'true')

  await page.setViewportSize({width: 390, height: 844})
  assert.ok(await inspector.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().right <= innerWidth))
  await page.setViewportSize({width: 1400, height: 920})
  await limit.selectOption('5')
}
