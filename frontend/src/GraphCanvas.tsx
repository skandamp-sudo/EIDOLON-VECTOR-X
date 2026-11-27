import {useId,useRef,useState} from 'react'
import {Maximize,Minus,Plus,Scan,Download,RotateCcw} from 'lucide-react'
export type GraphNode={title:string;x:number;y:number;kind?:'term'|'decision'|'start'|'end'|'human'|'store';detail?:string}
export type GraphEdge={src:number;dst:number;label?:string;accent?:boolean}
type Props={title:string;nodes:GraphNode[];edges:GraphEdge[];selected:number;onSelect:(i:number)=>void;color?:string;download?:boolean}
function lines(title:string){
 const words=(title.length>52?title.slice(0,49)+'…':title).split(/\s+/).map(w=>w.length>20?w.slice(0,17)+'…':w),result:string[]=['']
 for(const word of words){const i=result.length-1;if(result[i]&&result[i].length+word.length>18)result.push(word);else result[i]+=(result[i]?' ':'')+word}
 return result
}
export default function GraphCanvas({title,nodes,edges,selected,onSelect,color='#77caff',download=false}:Props){
 const id=useId().replace(/:/g,''),ref=useRef<SVGSVGElement>(null),box=useRef<HTMLDivElement>(null)
 const [view,setView]=useState({x:0,y:0,k:1}),[full,setFull]=useState(false)
 const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null)
 const width=Math.max(360,...nodes.map(n=>n.x+94)),height=Math.max(240,...nodes.map(n=>n.y+64))
 function zoom(f:number){setView(v=>{const k=Math.min(4,Math.max(.45,v.k*f));return {k,x:width/2-(width/2-v.x)*k/v.k,y:height/2-(height/2-v.y)*k/v.k}})}
 function save(){if(!ref.current)return;const copy=ref.current.cloneNode(true) as SVGSVGElement;copy.setAttribute('xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width',String(width));copy.setAttribute('height',String(height));copy.querySelector('[data-camera]')?.removeAttribute('transform');const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download='eidolon-workflow.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <div ref={box} className={'map-canvas'+(full?' map-expanded':'')} onKeyDown={e=>{if(e.key==='Escape')setFull(false)}}>
 <div className="map-toolbar"><strong>{title}</strong><div>{[[Minus,'Zoom out',()=>zoom(1/1.2)],[Plus,'Zoom in',()=>zoom(1.2)],[Scan,'Fit to view',()=>setView({x:0,y:0,k:1})],[RotateCcw,'Reset view',()=>setView({x:0,y:0,k:1})],[Maximize,full?'Exit fullscreen':'Fullscreen',()=>setFull(!full)],...(download?[[Download,'Export SVG',save]]:[])].map(item=>{const Icon=item[0] as typeof Plus;return <button type="button" key={Icon===Maximize?'screen':String(item[1])} aria-label={String(item[1])} title={String(item[1])} onClick={item[2] as ()=>void}><Icon size={16}/></button>})}</div></div>
 <svg ref={ref} viewBox={'0 0 '+width+' '+height} role="group" tabIndex={0} aria-label={title+' · drag background or use arrow keys to pan'} onKeyDown={e=>{const d:Record<string,number[]>={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]};if(d[e.key]){e.preventDefault();const [x,y]=d[e.key];setView(v=>({...v,x:v.x+x,y:v.y+y}))}}}
 onPointerDown={e=>{if((e.target as Element).closest('[role=button]'))return;drag.current={x:e.clientX,y:e.clientY,ox:view.x,oy:view.y};e.currentTarget.setPointerCapture(e.pointerId)}}
 onPointerMove={e=>{const a=drag.current,m=e.currentTarget.getScreenCTM();if(a&&m)setView(v=>({...v,x:a.ox+(e.clientX-a.x)/m.a,y:a.oy+(e.clientY-a.y)/m.d}))}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}>
 <defs><marker id={id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 8 4 0 8" fill="#92a9be"/></marker></defs>
 <rect width="100%" height="100%" fill="#0b1520"/><g data-camera="" transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
 {edges.map((e,i)=>{const a=nodes[e.src],b=nodes[e.dst];if(!a||!b)return null
 // A highlighted connection is one hop from the selected stage; cycles and branches remain explicit.
 const incident=download&&(e.src===selected||e.dst===selected)
 const incoming=incident&&e.dst===selected
 const dx=b.x-a.x,dy=b.y-a.y,side=Math.abs(dx)>Math.abs(dy),sx=side?Math.sign(dx):0,sy=side?0:Math.sign(dy),ax=a.x+sx*(a.kind==='term'?36:73),ay=a.y+sy*(a.kind==='term'?33:25),bx=b.x-sx*(b.kind==='term'?37:75),by=b.y-sy*(b.kind==='term'?34:27)
 const long=side&&Math.abs(dx)>255&&Math.abs(dy)<35, lift=long?-51:0
 const path=long?`M${a.x} ${a.y-25} Q${a.x} ${a.y-64} ${(ax+bx)/2} ${ay+lift} T${b.x} ${b.y-28}`:side?`M${ax} ${ay} C${(ax+bx)/2} ${ay} ${(ax+bx)/2} ${by} ${bx} ${by}`:`M${ax} ${ay} C${ax} ${(ay+by)/2} ${bx} ${(ay+by)/2} ${bx} ${by}`
 return <g key={i} data-selected-edge={incident?(incoming?"incoming":"outgoing"):undefined}><path d={path} stroke={incident||e.accent?color:'#627d95'} strokeWidth={incident?3.4:e.accent?2.6:1.7} strokeDasharray={incoming?"6 3":undefined} fill="none" markerEnd={'url(#'+id+')'}/>{e.label&&e.label!=='Next'&&<text x={(ax+bx)/2} y={(ay+by)/2+lift-4} fill="#d3deeb" stroke="#0b1520" strokeWidth="4" paintOrder="stroke" fontSize={download?13:11} fontWeight={incident?700:500} textAnchor="middle">{e.label}</text>}</g>})}
 {nodes.map((n,i)=>{const active=selected===i,stroke=active?color:'#577289',shape={fill:active?'#173345':'#152331',stroke,strokeWidth:active?2.5:1.3},wrapped=lines(n.title)
 return <g key={i} role="button" tabIndex={0} aria-label={'Inspect '+n.title} aria-pressed={active} onClick={()=>onSelect(i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(i)}}} transform={`translate(${n.x} ${n.y})`}>
 <title>{n.detail??n.title}</title>{n.kind==='term'?<ellipse rx="38" ry="32" {...shape}/>:n.kind==='decision'?<polygon points="0,-35 82,0 0,35 -82,0" {...shape}/>:<rect x="-73" y="-25" width="146" height="50" rx={n.kind==='start'||n.kind==='end'?24:n.kind==='human'?15:7} {...shape}/>}
 {n.kind==='store'&&<path d="M-68 -16H68" stroke={stroke}/>}<text textAnchor="middle" fill={active?'#ffffff':'#dce7f2'} fontSize={download?14:12} fontWeight={active?650:500} fontFamily="system-ui,sans-serif">{wrapped.map((s,j)=><tspan key={j} x="0" y={(j-(wrapped.length-1)/2)*14+4}>{s}</tspan>)}</text></g>})}</g></svg>{download&&<small className="path-legend">Selected stage · dashed lines enter it, solid highlighted lines leave it.</small>}</div>
}
