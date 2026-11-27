import { useMemo, useRef, useState } from 'react'
import { Euler, Vector3 } from 'three'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, Orbit, Move } from 'lucide-react'
import { colors, topics } from './explore'
import type { Run, XYZ } from './explore'

const home = { yaw: .65, pitch: -.18, zoom: 1, x:0, y:0 }
export default function Galaxy({ run, selected, select }: { run: Run | null; selected: number | null; select: (id:number)=>void }) {
  const [view, setView] = useState(home)
  const drag = useRef<[number,number] | null>(null)
  const moved = useRef(false)
  const projection = useMemo(() => {
    const rotation = new Euler(view.pitch, view.yaw, -.06, 'YXZ')
    return (point: XYZ) => {
      const v = new Vector3(...point).applyEuler(rotation)
      const k = 210 * view.zoom * 4 / (4 - v.z)
      return { x: 360 + view.x + v.x*k, y: 184 + view.y - v.y*k, z: v.z }
    }
  }, [view])
  const points = run?.documents.map(d => ({...d, ...projection(d.xyz)})) ?? []
  const trace = run?.trajectory.map(projection) ?? []
  const first = trace[0], last = trace.at(-1)
  function turn(x: number, y: number) {
    setView(v => ({...v, yaw: v.yaw+x, pitch: Math.max(-1.5,Math.min(1.5,v.pitch+y))}))
  }
  function pan(x:number,y:number){setView(v=>({...v,x:Math.max(-200,Math.min(200,v.x+x)),y:Math.max(-120,Math.min(120,v.y+y))}))}
  function zoom(step:number) { setView(v => ({...v,zoom: Math.min(1.65,Math.max(.65,v.zoom+step))})) }
  return <section className="atlas-plot panel" aria-label="Semantic Universe">
    <div className="panel-head"><div className="panel-title"><Orbit size={19}/><h2>Semantic Universe</h2></div><span className="frame-label">PCA · 3D</span></div>
    <div className="space"><svg viewBox="0 0 720 364" className="galaxy" role="group" aria-label="Rotatable three-dimensional PCA map. Arrow keys orbit. Shift plus arrow pans." tabIndex={0}
      onKeyDown={e => {const directions:Record<string,number[]>={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]};if(directions[e.key]){e.preventDefault();const [x,y]=directions[e.key];if(e.shiftKey)pan(x*120,y*120);else turn(x,y)}}}
      onPointerDown={e => {drag.current=[e.clientX,e.clientY];moved.current=false}}
      onPointerMove={e => {if(!drag.current)return; const dx=e.clientX-drag.current[0],dy=e.clientY-drag.current[1];if(Math.abs(dx)+Math.abs(dy)<3&&!moved.current)return; moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);if(e.shiftKey)pan(dx,dy);else turn(dx*.008,dy*.008);drag.current=[e.clientX,e.clientY]}}
      onPointerUp={()=>{drag.current=null}} onPointerLeave={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
      <defs>{topics.map(t=><radialGradient key={t} id={'halo'+t}><stop stopColor={colors[t]} stopOpacity=".23"/><stop offset=".42" stopColor={colors[t]} stopOpacity=".09"/><stop offset="1" stopColor={colors[t]} stopOpacity="0"/></radialGradient>)}
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.8"/></filter></defs>
      {run && <>
      {([0,1,2] as const).map((k)=>{
        const a:XYZ=[0,0,0],b:XYZ=[0,0,0];a[k]=-1;b[k]=1
        const p=projection(a),q=projection(b)
        return <g key={k}><line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#657b8c" opacity=".36" strokeDasharray="2 5"/><text x={q.x+4} y={q.y} className="axis-name">PC{k+1}</text></g>
      })}
      {topics.map(t=>{
        const group=points.filter(p=>p.topic===t)
        const x=group.reduce((s,p)=>s+p.x,0)/group.length,y=group.reduce((s,p)=>s+p.y,0)/group.length
        const radius=Math.max(35,Math.sqrt(group.reduce((s,p)=>s+(p.x-x)**2+(p.y-y)**2,0)/group.length)*1.7)
        return <g key={t}><circle cx={x} cy={y} r={radius+20} fill={'url(#halo'+t+')'}/>
        {group.map(p=>{
          const distance=(q:typeof p)=>q.xyz.reduce((s,v,i)=>s+(v-p.xyz[i])**2,0)
          const n=group.filter(q=>p.id!==q.id).sort((a,b)=>distance(a)-distance(b))[0]
          return <line key={p.id} x1={p.x} y1={p.y} x2={n.x} y2={n.y} stroke={colors[t]} strokeWidth=".9" opacity=".32"/>
        })}
        </g>
      })}
      {[...points].sort((a,b)=>a.z-b.z).map(p=><g key={p.id} className="star" role="button" tabIndex={0} aria-label={'Inspect document '+(p.id+1)+', '+p.topic}
        onClick={()=>{if(!moved.current)select(p.id)}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(p.id)}}}>
        <title>{p.text}</title><circle cx={p.x} cy={p.y} r={7} fill={colors[p.topic]} opacity=".57" filter="url(#glow)"/>
        <circle cx={p.x} cy={p.y} r={3.3+p.z*.7} fill={colors[p.topic]}/><circle cx={p.x} cy={p.y} r={1.3} fill="#fff"/>
        <circle className="hit" cx={p.x} cy={p.y} r={9} fill="transparent" stroke={p.id===selected?'white':'transparent'}/></g>)}
      {first && last && <g pointerEvents="none"><polyline key={run.steered.join(',')} className="trajectory" pathLength="1" points={trace.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="#f3edd9" strokeWidth="2"/>
        <circle cx={first.x} cy={first.y} r="7" fill="#101a23" stroke="#eef3f6" strokeWidth="1.6"/>
        <path d={'M'+last.x+' '+(last.y-7)+'l7 7 -7 7 -7 -7z'} fill="#ffda8e" stroke="#fff5d9"/>
      </g>}
      {topics.map(t=>{
        const g=points.filter(p=>p.topic===t),x=g.reduce((s,p)=>s+p.x,0)/g.length,y=g.reduce((s,p)=>s+p.y,0)/g.length
        const side=x>=360?1:-1, endX=Math.max(68,Math.min(652,x+side*45)),endY=Math.max(25,Math.min(335,y+(y>184?35:-35)))
        return <g key={t} pointerEvents="none"><path d={'M'+x+' '+y+'L'+endX+' '+endY+'h'+side*8} stroke={colors[t]} opacity=".52" fill="none"/>
        <text x={endX+side*12} y={endY+4} textAnchor={side===1?'start':'end'} fill={colors[t]} className="cluster-name">{t}</text></g>
      })}</>}
    </svg>{!run&&<p className="space-empty">Awaiting a valid embedding</p>}
    <div className="view-tools"><button aria-label="Rotate galaxy left" onClick={()=>turn(-.2,0)}><ChevronLeft/></button><button aria-label="Rotate galaxy right" onClick={()=>turn(.2,0)}><ChevronRight/></button><button aria-label="Zoom out" onClick={()=>zoom(-.12)}><Minus/></button><button aria-label="Zoom in" onClick={()=>zoom(.12)}><Plus/></button><button aria-label="Reset galaxy camera" onClick={()=>setView(home)}><RotateCcw/></button></div></div>
    <div className="plot-foot"><span><i className="query-dot"/> Original <i className="steered-dot"/> Steered</span><span><Move size={13}/> Drag to orbit · Shift to pan</span></div>
  </section>
}
