export const topics = ['Astronomy', 'Ocean', 'Acoustics', 'Botany'] as const
export type Topic = typeof topics[number]
export type XYZ = [number, number, number]
export const colors: Record<Topic,string> = {
  Astronomy: '#bb9eff', Ocean: '#6ae9ed', Acoustics: '#f3ac83', Botany: '#a4dc9c',
}
export type Doc = { id: number; topic: Topic; text: string; xyz: XYZ; before: number; after: number }
export type Run = {
  model: string; dimensions: number; target: Topic; strength: number; documents: Doc[];
  original: number[]; steered: number[]; trajectory: XYZ[]; before: number[]; after: number[];
  retained_cosine: number; explained_variance: number; neighbor_overlap: number
}
const numbers = (v: unknown, length: number) => Array.isArray(v) && v.length === length && v.every(Number.isFinite)
export function validRun(r: Run) {
  return r && typeof r.model === 'string' && r.dimensions === 8 && topics.includes(r.target) &&
    [r.strength, r.retained_cosine,r.explained_variance,r.neighbor_overlap].every(Number.isFinite) &&
    numbers(r.original, r.dimensions) && numbers(r.steered, r.dimensions) &&
    Array.isArray(r.documents) && r.documents.length === 24 &&
    r.documents.every((d,i) => d && d.id === i && typeof d.text === 'string' && topics.includes(d.topic) &&
      numbers(d.xyz,3) && Number.isFinite(d.before) && Number.isFinite(d.after)) &&
    Array.isArray(r.trajectory) && r.trajectory.length === 25 && r.trajectory.every(p => numbers(p,3)) &&
    [r.before, r.after].every(ids => numbers(ids,3) && ids.every(id => Number.isInteger(id) && r.documents[id]))
}
