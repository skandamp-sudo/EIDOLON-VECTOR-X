export function tourAction(action:string){window.dispatchEvent(new CustomEvent('eidolon-tour-action',{detail:action}))}
export function startTour(name:string){window.dispatchEvent(new CustomEvent('eidolon-tour-start',{detail:name}))}
