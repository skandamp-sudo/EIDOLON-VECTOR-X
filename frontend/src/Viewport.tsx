import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, RotateCcw, Move, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Pose } from './Scene'
import { signature, palette } from './geometry'
import type { Sample } from './runtime'
const Scene = lazy(() => import('./Scene'))
const initial: Pose = [0.58, 0.24, -0.28]

class FallbackBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function FlatScene({ sample, pose }: { sample: Sample; pose: Pose }) {
  const lines = useMemo(() => signature(sample.vector), [sample.vector])
  const paths = useMemo(() => {
    const [x, y, z] = pose
    function project([a,b,c]: number[]) {
      const u = a * Math.cos(z) - b * Math.sin(z), v = a * Math.sin(z) + b * Math.cos(z)
      const h = u * Math.cos(y) + c * Math.sin(y), d = -u * Math.sin(y) + c * Math.cos(y)
      return h.toFixed(3) + ',' + (d * Math.sin(x) - v * Math.cos(x)).toFixed(3)
    }
    const paths = Array<string>(10).fill('')
    for (const s of lines) paths[s.color + (s.cross ? 5 : 0)] += 'M' + project(s.a) + 'L' + project(s.b)
    return paths
  }, [lines, pose])
  return <svg className="flat-scene" viewBox="-2.55 -1.75 5.1 3.5" aria-hidden="true">
    {paths.map((d,i) => <path key={i} d={d} fill="none" stroke={palette[i%5]} strokeWidth=".009" opacity={i<5 ? 0.78 : 0.22} />)}
  </svg>
}
export default function Viewport({ sample, status }: { sample?: Sample; status: string }) {
  const [pose, setPose] = useState<Pose>(initial)
  const [large, setLarge] = useState(false)
  const panel = useRef<HTMLElement>(null)
  const last = useRef<[number,number] | null>(null)
  useEffect(() => {
    function change() { setLarge(document.fullscreenElement === panel.current) }
    document.addEventListener('fullscreenchange', change)
    return () => document.removeEventListener('fullscreenchange', change)
  }, [])
  function rotate(x: number, y: number) { setPose(p => [p[0]+y, p[1]+x, p[2]]) }
  const fallback = sample && <FlatScene sample={sample} pose={pose} />
  return <section className="viewport panel" ref={panel} aria-label="Vector signature viewport">
    <div className="panel-head"><div className="panel-title"><Box size={18}/><h2>Vector signature</h2></div>
      <div className="tools"><button aria-label="Reset orientation" disabled={!sample} onClick={() => setPose(initial)}><RotateCcw/></button>
      {document.fullscreenEnabled && <button aria-label={large ? 'Exit fullscreen' : 'Expand viewport'} onClick={() => { if (large) void document.exitFullscreen(); else void panel.current?.requestFullscreen() }}>{large ? <Minimize2/> : <Maximize2/>}</button>}</div></div>
    <div className="plot" tabIndex={sample ? 0 : -1} role="group" aria-label="Embedding coefficient glyph. Use arrow keys to rotate."
      onKeyDown={e => {
        if (!sample || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) return
        e.preventDefault(); rotate(e.key === 'ArrowLeft' ? -0.14 : e.key === 'ArrowRight' ? 0.14 : 0, e.key === 'ArrowUp' ? -0.14 : e.key === 'ArrowDown' ? 0.14 : 0)
      }}
      onPointerDown={e => { if (!sample) return; e.currentTarget.setPointerCapture(e.pointerId); last.current = [e.clientX,e.clientY] }}
      onPointerMove={e => { if (!last.current) return; rotate((e.clientX-last.current[0])*0.01,(e.clientY-last.current[1])*0.01); last.current=[e.clientX,e.clientY] }}
      onLostPointerCapture={() => { last.current = null }}>
      <span className="plot-label"><i/> {sample ? sample.id.toUpperCase() + ' / LSA' : 'AWAITING RUNTIME'}</span>
      {sample ? <div className="scene"><FallbackBoundary fallback={fallback}><Suspense fallback={fallback}><Scene vector={sample.vector} pose={pose}/></Suspense></FallbackBoundary></div>
        : <p className="empty">{status === 'Checking' ? 'Checking local runtime…' : 'Waiting for the local API'}</p>}
      <span className="triad" aria-hidden="true"><svg width="50" height="44" viewBox="0 0 50 44"><path d="M18 28V6m0 22 21 7m-21-7L4 36" fill="none" stroke="#758a9b"/><g fill="#9dacb7" fontSize="8"><text x="21" y="9">Y</text><text x="40" y="39">X</text><text x="1" y="43">Z</text></g></svg></span>
      <div className="plot-nav"><button disabled={!sample} aria-label="Rotate left" onClick={() => rotate(-.25,0)}><ChevronLeft/></button><button disabled={!sample} aria-label="Rotate right" onClick={() => rotate(.25,0)}><ChevronRight/></button></div>
    </div>
    <div className="plot-foot"><span><i className="legend-line"/> Coefficient surface</span><span><Move size={13}/> Drag to rotate</span></div>
  </section>
}
