import { apiOrigin } from './apiOrigin'
import { useEffect, useRef, useState } from 'react'

export type Sample = { id: string; text: string; vector: number[] }
export type Foundation = {
  backbone: string; model_id: string; dimensions: number; documents: number; seed: number;
  corpus_sha256: string; samples: Sample[]
}
function valid(value: Foundation) {
  return value && typeof value.backbone === 'string' && value.dimensions === 8 && /^[a-f0-9]{64}$/.test(value.model_id) &&
    Number.isInteger(value.documents) && value.documents > 0 && Number.isInteger(value.seed) &&
    typeof value.corpus_sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.corpus_sha256) &&
    Array.isArray(value.samples) && value.samples.length > 0 && value.samples.length <= 32 &&
    value.samples.every(s => s && typeof s.id === 'string' && typeof s.text === 'string' &&
      Array.isArray(s.vector) && s.vector.length === value.dimensions &&
      s.vector.every(n => Number.isFinite(n) && Math.abs(n) <= 1.000001))
}
export function useRuntime() {
  const [data, setData] = useState<Foundation | null>(null)
  const [status, setStatus] = useState<'Checking' | 'Connected' | 'Unavailable'>('Checking')
  const last = useRef<Foundation | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let refresh = true
    let polls = 0
    let closed = false
    let timer: ReturnType<typeof setTimeout>
    let request: AbortController
    async function poll() {
      request = new AbortController()
      const deadline = setTimeout(() => request.abort(), 3500)
      try {
        async function read(route: string) {
          const response = await fetch(apiOrigin+'/api/v1/'+route, {signal:request.signal,cache:'no-store'})
          if (!response.ok) throw new Error('Runtime unavailable')
          return response.json()
        }
        const health = await read('health')
        if (health.service !== 'eidolon-vector-x' || health.status !== 'ready' || health.version !== '0.1.0') throw new Error('Unexpected service')
        if (refresh || ++polls >= 12) {
          const snapshot = await read('foundation')
          if (!valid(snapshot)) throw new Error('Invalid model snapshot')
          if (closed) return
          if (JSON.stringify(last.current) !== JSON.stringify(snapshot)) {
            last.current = snapshot
            setData(snapshot)
          }
          refresh = false
          polls = 0
        }
        if (!closed) setStatus('Connected')
      } catch {
        refresh = true
        if (!closed) setStatus('Unavailable')
      } finally {
        clearTimeout(deadline)
        if (!closed) timer = setTimeout(poll, 5000)
      }
    }
    void poll()
    return () => { closed = true; clearTimeout(timer); request.abort() }
  }, [attempt])
  return { data, status, retry: () => { setStatus('Checking'); setAttempt(n => n + 1) } }
}
