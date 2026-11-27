import {useSyncExternalStore} from 'react'
import {downloadFile} from '../foundryData'

export const domains=['CORTEX','SUPPLY','SYMBIOSIS','MORPH','VECTOR-X','CLARITY'] as const
export type Domain=typeof domains[number]
export type Action='visit'|'complete'|'retry'|'back'|'prefer'|'approve'|'reject'|'undo'
export type Interaction={domain:Domain;action:Action;time:number;context?:Domain}
let events:Interaction[]=[]
let enabled=false
const listeners=new Set<()=>void>()
const notify=()=>listeners.forEach(f=>f())
export function record(domain:Domain,action:Action,context?:Domain){
  if(enabled){events=[...events.slice(-255),{domain,action,context,time:Date.now()}];notify()}
}
export function configureLearning(value:boolean){enabled=value;notify()}
export function clearHistory(){events=[];notify()}
const subscribe=(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn)}}
export function useHistory(){return useSyncExternalStore(subscribe,()=>events)}
export function useLearning(){return useSyncExternalStore(subscribe,()=>enabled)}
export function exportEvidence(file:string,data:unknown){downloadFile(file+'.json','application/json',JSON.stringify(data,null,2))}
