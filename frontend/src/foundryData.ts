import type { FoundryPoint } from './FoundryMap'

export type Dataset = { columns: string[]; rows: string[][] }
export type Neighbor = { row: number; score: number }
export async function requestData<T>(operation: string, body: BodyInit, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/v1/foundry/' + operation, {
    method: 'POST', body, signal, cache: 'no-store', redirect: 'error',
    headers: { 'X-Vector-X-Client': 'foundry' },
  })
  if (!response.ok) {
    const message = await response.json().catch(() => ({}))
    throw new Error(typeof message.detail === 'string' ? message.detail : 'Local request failed.')
  }
  return response.json()
}

export function quality(data: Dataset, column: number) {
  const seen = new Set<string>(), indices: number[] = []
  let missing = 0, duplicates = 0
  data.rows.forEach((row, i) => {
    const text = row[column].trim(), key = JSON.stringify(row)
    if (!text) missing++
    else if (seen.has(key)) duplicates++
    else { seen.add(key); indices.push(i) }
  })
  return { missing, duplicates, indices }
}

export function nearest(points: FoundryPoint[], query: number[]): Neighbor[] {
  return points.map(p => ({ row: p.row, score: Math.max(-1, Math.min(1, p.vector.reduce((sum, value, i) => sum + value * query[i], 0))) }))
    .sort((a, b) => b.score - a.score || a.row - b.row).slice(0, 3)
}

export function exportNeighbors(data: Dataset, textColumn: number, metadata: number[], lists: Neighbor[][]) {
  const rows: (string | number)[][] = [['query', 'rank', 'row', 'cosine', 'text', ...metadata.map(i => data.columns[i])]]
  lists.forEach((neighbors, side) => neighbors.forEach((item, i) => {
    const record = data.rows[item.row]
    rows.push([side ? 'steered' : 'original', i + 1, item.row + 1, item.score, record[textColumn], ...metadata.map(c => record[c])])
  }))
  function csv(value: string | number) {
    let s = String(value)
    if (typeof value === 'string' && (/^[\s\uFEFF]*[=+@＝＋＠－-]/u.test(s) || /^[\t\r\n]/.test(s))) s = "'" + s
    return '"' + s.replaceAll('"', '""') + '"'
  }
  const blob = new Blob([rows.map(row => row.map(csv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = 'vector-x-retrieval.csv'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
