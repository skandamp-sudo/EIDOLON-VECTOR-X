import {useEffect, useRef, useState} from 'react'
import {Activity, Archive, BookOpen, Boxes, Compass, Database, FlaskConical, GitBranch, Hexagon, Layers3, Menu, Network, PanelLeftClose, PanelLeftOpen, ScanText, SlidersHorizontal, Workflow, X} from 'lucide-react'
import {hosted} from './apiOrigin'
import type {Foundation} from './runtime'

const groups = [
  {label:'Workspaces', links:[['Mission Control',Compass],['CORTEX',Network],['SUPPLY',Boxes],['SYMBIOSIS',GitBranch],['MORPH',SlidersHorizontal],['VECTOR-X',Hexagon],['CLARITY',ScanText]]},
  {label:'Research', links:[['Data Foundry',Database],['Research Lab',FlaskConical],['Evidence Vault',Archive]]},
  {label:'Tools and reference', links:[['Atlas',Hexagon],['Intelligence',Layers3],['Applications',Workflow],['Overview',Activity],['Architecture',Network],['Protocol',BookOpen]]},
] as const
const shortcuts=['Mission Control','Atlas','Data Foundry','Intelligence','Research Lab','Applications','Overview','Architecture','Protocol']
const route=(name:string)=>'#'+name.toLowerCase().replaceAll(' ','-')
export default function WorkspaceShell({page,status,data}:{page:string;status:string;data:Foundation|null}){
  const [compact,collapse]=useState(false)
  const drawer=useRef<HTMLDialogElement>(null)
  useEffect(()=>{drawer.current?.close()},[page])
  const directory=(iconsOnly:boolean)=>groups.map(group=><section key={group.label}><h2>{group.label}</h2>{group.links.map(([name,Icon])=><a key={name} aria-label={name} title={name} href={route(name)} aria-current={name===page?'page':undefined} onClick={()=>drawer.current?.close()}><Icon size={17}/>{!iconsOnly&&<span>{name}</span>}</a>)}</section>)
  return <div className={'shell '+(compact?'compact':'')}>
    <aside className="rail"><a className="rail-brand" aria-label="Open Mission Control" href="#mission-control"><img src="/mark.svg" alt=""/>{!compact&&<b>EIDOLON</b>}</a><nav aria-label="Workspace">{directory(compact)}</nav>
      <button className="rail-toggle" aria-label={compact?'Expand navigation':'Collapse navigation'} onClick={()=>collapse(!compact)}>{compact?<PanelLeftOpen/>:<PanelLeftClose/>}{!compact&&'Collapse navigation'}</button></aside>
    <header className="command"><button className="drawer-toggle" aria-label="Open workspace menu" onClick={()=>drawer.current?.showModal()}><Menu/></button><span className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></span>
      <small title={data?.model_id}> {hosted?'Hosted':'Local'} · {data?data.dimensions+'D LSA':'Model unavailable'}</small><span role="status" className={'connection '+status.toLowerCase()}><i/> API {status.toLowerCase()}</span>
      <a href="#protocol" title="Evaluation protocol and help" aria-label="Evaluation protocol and help"><BookOpen size={16}/></a></header>
    <nav className="quick-nav" aria-label="Workspace">{shortcuts.map(s=><a key={s} href={route(s)} aria-current={page===s?'page':undefined}>{s}</a>)}</nav>
    <dialog className="workspace-drawer" ref={drawer} aria-label="Workspace menu"><button aria-label="Close menu" onClick={()=>drawer.current?.close()}><X/></button><nav aria-label="Full directory">{directory(false)}</nav></dialog>
  </div>
}
