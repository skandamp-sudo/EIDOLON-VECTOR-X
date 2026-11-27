import { useEffect, useRef, useState } from 'react'
import { labRequest } from './labTypes'
import type { Concept, Example, Workspace } from './labTypes'

const labels = ['Fit positive', 'Fit negative', 'Validation positive', 'Validation negative']
function fromExamples(examples: Example[]) {
  return labels.map((_, i) => examples.filter(e => e.positive === (i % 2 === 0) && e.split === (i < 2 ? 'fit' : 'validation'))
    .map(e => e.family + ' | ' + e.text).join('\n'))
}
export default function ConceptEditor({ workspace, imported, add }: { workspace: Workspace; imported?: string[]; add: (c: Concept) => void }) {
  const [name, setName] = useState('Custom concept')
  const [blocks, setBlocks] = useState(() => fromExamples(workspace.presets[0].examples ?? []))
  const [row, setRow] = useState(0), [group, setGroup] = useState(0)
  const [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  function update(i: number, s: string) { setBlocks(previous => previous.map((b,j) => j === i ? s : b)) }
  async function train() {
    const controller = new AbortController()
    active.current = controller; setBusy(true); setFeedback('')
    try {
      const examples = blocks.flatMap((block, i) => block.split('\n').filter(s => s.trim()).map(line => {
        const divider = line.indexOf('|')
        if (divider < 1) throw new Error('Enter each source family and text separated by |.')
        return {family: line.slice(0, divider).trim(), text: line.slice(divider+1).trim(), positive:i%2 === 0,
          split:i < 2 ? 'fit' : 'validation'}
      }))
      const result = await labRequest<Concept>('learn', {name:name.trim(), examples}, controller.signal)
      if (!controller.signal.aborted) { add(result); setFeedback('Direction fitted and selected.') }
    } catch (e) { if (!controller.signal.aborted) setFeedback(e instanceof Error ? e.message : 'Training failed.') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  return <details className="panel foundry-panel concept-editor"><summary>Concept DNA · train a direction</summary>
    <p>The starter form contains the Ocean development anchors. Replace them with your own labeled examples. Give related paraphrases the same source family. Keep validation families independent.</p>
    <label>Direction name<input value={name} maxLength={64} onChange={e => setName(e.target.value)}/></label>
    {imported && <div className="foundry-actions"><label>Imported example<select value={row} onChange={e => setRow(Number(e.target.value))}>
      {imported.map((text,i) => <option key={i} value={i}>{i + 1} · {text.slice(0,56)}</option>)}</select></label>
      <label>Assign example to<select value={group} onChange={e => setGroup(Number(e.target.value))}>{labels.map((l,i) => <option key={l} value={i}>{l}</option>)}</select></label>
      <button onClick={() => update(group, blocks[group] + '\nimport-' + (row+1) + ' | ' + imported[row].replace(/[\r\n]+/g,' '))}>Add selected record</button></div>}
    <div className="rank-pair">{labels.map((label, i) => <label key={label}>{label} · family | text
      <textarea value={blocks[i]} rows={3} maxLength={100000} onChange={e => update(i, e.target.value)}/></label>)}</div>
    <button className="encode" disabled={busy} onClick={() => void train()}>Train and validate</button><p role="status">{feedback}</p>
  </details>
}
