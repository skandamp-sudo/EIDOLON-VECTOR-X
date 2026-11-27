type Rule={kind:string;match:RegExp;meanings:[string,string];question:string;cost:number}
const rules:Rule[]=[
 {kind:'lexical',match:/\bbank\b/i,meanings:['financial institution','river shore'],question:'Which meaning of bank applies?',cost:1},
 {kind:'lexical',match:/\bbass\b/i,meanings:['low frequency sound','freshwater fish'],question:'Which meaning of bass applies?',cost:1},
 {kind:'lexical',match:/\bwave[s]?\b/i,meanings:['ocean water waves','sound waves'],question:'Which kind of wave is intended?',cost:1},
 {kind:'syntactic',match:/\b(?:with|using) (?:the|a|an) [\w-]+/i,meanings:['instrument of the action','attribute of the object'],question:'What does the final phrase modify?',cost:1.5},
 {kind:'referential',match:/\b(?:it|that one|they|them)\b/i,meanings:['the previously discussed subject','a different referenced entity'],question:'What entity does this reference denote?',cost:1.2},
 {kind:'scope',match:/\b(?:not (?:all|every)|all\b.{0,35}\bnot|every\b.{0,35}\bnot)\b/i,meanings:['none satisfy the condition','some fail the condition'],question:'Does the negative apply to every item or to the group as a whole?',cost:1.3},
 {kind:'pragmatic',match:/\b(?:can|could|would) you\b/i,meanings:['request to perform the action','question about ability'],question:'Is this a request for action or information?',cost:1},
 {kind:'contextual',match:/\b(?:soon|nearby|large|recent|later)\b/i,meanings:['relative to the current situation','relative to a particular comparison point'],question:'Which reference frame sets the threshold?',cost:1.4}
]
export type Issue={kind:string;start:number;end:number;span:string;question:string;meanings:string[];weights:number[];entropy:number;utility:number;key:string}
export function inspect(text:string):Issue[]{
 return rules.flatMap(r=>{
  const m=r.match.exec(text);if(!m)return []
  const context=text.slice(0,m.index)+' '+text.slice(m.index+m[0].length)
  const tokens=new Set(context.toLowerCase().match(/[a-z]+/g)??[])
  const raw=r.meanings.map(s=>1+s.split(' ').filter(w=>w.length>3&&tokens.has(w)).length)
  const weights=raw.map(v=>v/(raw[0]+raw[1])),entropy=-weights.reduce((n,p)=>n+p*Math.log2(p),0)
  return [{kind:r.kind,start:m.index,end:m.index+m[0].length,span:m[0],question:r.question,meanings:[...r.meanings],weights,entropy,utility:entropy/r.cost,key:r.kind+':'+m[0].toLowerCase()}]
 }).sort((a,b)=>b.utility-a.utility||a.start-b.start)
}
export function verdict(text:string,remaining:number){
 if(!remaining)return 'PROCEED'
 return /\b(?:delete|send|pay|purchase|transfer|deploy|publish|buy)\b/i.test(text)?'DEFER':'CLARIFY'
}
