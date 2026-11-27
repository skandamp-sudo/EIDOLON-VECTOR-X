// Requests are stateless. Retry transient contention for a bounded interval.
export async function localRequest<T>(path: string, body: BodyInit, signal: AbortSignal): Promise<T> {
  for (const delay of [0, 100, 250, 500]) {
    if (delay) await new Promise<void>((resolve, reject) => {
      signal.throwIfAborted()
      const abort = () => { clearTimeout(timer); reject(signal.reason) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, delay)
      signal.addEventListener('abort', abort, {once:true})
    })
    const response = await fetch('/api/v1/' + path, {method:'POST', body, signal, cache:'no-store',
      redirect:'error', headers:{'X-Vector-X-Client':'foundry'}})
    if (response.status === 429 && delay !== 500) { await response.body?.cancel(); continue }
    const value = await response.json()
    if (!response.ok) throw new Error(typeof value.detail === 'string' ? value.detail : 'Local operation failed.')
    return value
  }
  throw new Error('Local worker is busy.')
}
