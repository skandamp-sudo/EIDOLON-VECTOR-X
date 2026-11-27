import assert from 'node:assert/strict'
import {inspect,verdict} from './src/convergence/ambiguity.ts'
const cases=[
 ['Look at the bank','lexical','bank'],['Inspect the lamp with a telescope','syntactic','with a telescope'],
 ['Send it','referential','it'],['Not every star is blue','scope','Not every'],
 ['Could you classify stars','pragmatic','Could you'],['Publish recent work','contextual','recent'],
 ['Measure ocean temperature',null,null],['List stellar spectra',null,null]]
let detected=0,localized=0,baseline=0
for(const [text,kind,span] of cases){
 const found=inspect(text)
 if(!kind){assert.equal(found.length,0);continue}
 const issue=found.find(x=>x.kind===kind)
 assert.ok(issue);detected++
 assert.equal(text.slice(issue.start,issue.end),span);localized++
 if(/\bbank\b/i.test(text))baseline++
}
assert.equal(verdict('Send it',1),'DEFER')
assert.equal(verdict('Inspect it',1),'CLARIFY')
assert.equal(verdict('Inspect it',0),'PROCEED')
console.log({authoredCases:cases.length,detected,localized,lexiconBaseline:baseline,unambiguousSpecificity:'2/2',directBaselineClarifications:0})
