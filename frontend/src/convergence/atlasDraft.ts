import {hosted} from '../apiOrigin'

type Draft={text:string;source:string}
let pending:Draft|null=null

// A single local handoff. Never include source text in a URL, storage or telemetry.
export function openAtlasDraft(text:string,source:string){
  if(hosted||!text.trim())return
  pending={text:text.trim().slice(0,400),source:source.slice(0,100)}
  location.hash='atlas'
}
export function readAtlasDraft(){return hosted?null:pending}
export function forgetAtlasDraft(){pending=null}
