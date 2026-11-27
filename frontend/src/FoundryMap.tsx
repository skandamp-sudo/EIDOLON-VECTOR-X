import { useMemo, useRef, useState } from 'react'
import { Euler, Vector3 } from 'three'
import type { XYZ } from './explore'

export type FoundryPoint = { row: number; xyz: XYZ; vector: number[] }
type Props = { points: FoundryPoint[]; selected: number; select: (row: number) => void; path: XYZ[] }
const home = { yaw: .45, pitch: -.22, zoom: 1 }

export default function FoundryMap({ points, selected, select, path }: Props) {
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const [view, setView] = useState(home)
  const project = useMemo(() => {
    const rotation = new Euler(view.pitch, view.yaw, 0, 'YXZ')
    return (xyz: XYZ) => {
      const v = new Vector3(...xyz).applyEuler(rotation)
      const scale = 145 * view.zoom * 4 / (4 - v.z)
      return { x: 320 + v.x * scale, y: 175 - v.y * scale }
    }
  }, [view])
  const marks = useMemo(() => points.map(p => ({ row: p.row, ...project(p.xyz) })), [points, project])
  const dots = useMemo(() => marks.map(p => 'M' + p.x.toFixed(2) + ',' + p.y.toFixed(2) + 'h.1').join(''), [marks])
  const focus = marks.find(p => p.row === selected)
  const trace = path.map(project)
  function rotate(dx: number, dy: number) {
    setView(v => ({ ...v, yaw: v.yaw + dx, pitch: Math.max(-1.5, Math.min(1.5, v.pitch + dy)) }))
  }
  return <section className="panel foundry-cloud"><div className="panel-head"><h2>Dataset point cloud</h2><small>Fixed PCA · 3D</small></div>
    <svg viewBox="0 0 640 350" role="group" tabIndex={0} aria-label="Imported points. Drag or use arrow keys to orbit. Select a point to inspect its row."
      onKeyDown={e => {
        const shifts: Record<string, [number, number]> = { ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, -.2], ArrowDown: [0, .2] }
        if (shifts[e.key]) { e.preventDefault(); rotate(...shifts[e.key]) }
      }}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, moved: false } }}
      onPointerMove={e => {
        const p = drag.current
        if (!p) return
        const dx = e.clientX - p.x, dy = e.clientY - p.y
        if (!p.moved && Math.abs(dx) + Math.abs(dy) < 3) return
        rotate(dx * .008, dy * .008); drag.current = { x: e.clientX, y: e.clientY, moved: true }
      }}
      onPointerUp={e => {
        const matrix = e.currentTarget.getScreenCTM()
        if (drag.current && !drag.current.moved && matrix) {
          const pos = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse())
          let best = 12, row = null
          for (const p of marks) {
            const distance = Math.hypot(p.x - pos.x, p.y - pos.y)
            if (distance < best) { best = distance; row = p.row }
          }
          if (row !== null) select(row)
        }
        drag.current = null
      }} onLostPointerCapture={() => { drag.current = null }}>
      {[0, 1, 2].map(i => {
        const a: XYZ = [0, 0, 0], b: XYZ = [0, 0, 0]; a[i] = -1; b[i] = 1
        const start = project(a), end = project(b)
        return <g key={i}><line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="#455665" strokeDasharray="3 4"/>
          <text x={end.x} y={end.y} fill="#adbac7" fontSize="10">PC{i+1}</text></g>
      })}
      <path d={dots} stroke="#89e0d4" strokeWidth="6" strokeLinecap="round" />
      {focus && <circle cx={focus.x} cy={focus.y} r={7} fill="none" stroke="white"/>}
      {trace.length > 0 && <g stroke="#ffcf88"><polyline points={trace.map(p => p.x+','+p.y).join(' ')} fill="none"/>
        <circle cx={trace.at(-1)!.x} cy={trace.at(-1)!.y} r="3" fill="#ffcf88"/></g>}
    </svg>
    <div className="plot-foot"><span>{points.length} embedded points</span><div className="foundry-actions">
      <button onClick={() => setView(v => ({ ...v, zoom: Math.max(.5, v.zoom - .2) }))}>Zoom out</button>
      <button onClick={() => setView(v => ({ ...v, zoom: Math.min(3, v.zoom + .2) }))}>Zoom in</button>
      <button onClick={() => setView(home)}>Reset view</button></div></div>
  </section>
}
