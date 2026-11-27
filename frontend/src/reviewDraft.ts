import {hosted} from './apiOrigin'
import type {Direction} from './labTypes'

export type ReviewDraft = {
  model:string; dataset:string; query:string; relevant:number[]
  target:Direction; protection:Direction; strength:number; drift:number; cosine:number
}
let pending:ReviewDraft|null=null
export function openReview(draft:ReviewDraft){
  if(hosted||draft.query.length>400||!draft.query.trim()||draft.model!==draft.target.model_id||draft.model!==draft.protection.model_id)return
  pending=structuredClone(draft)
  location.hash='symbiosis'
}
export function takeReview(){const value=pending;pending=null;return hosted?null:value}
export function sameDirection(a:Direction,b:Direction){
  return a.model_id===b.model_id&&a.name===b.name&&a.linear.length===b.linear.length&&a.centroid.length===b.centroid.length&&
    a.linear.every((v,i)=>v===b.linear[i])&&a.centroid.every((v,i)=>v===b.centroid[i])
}
