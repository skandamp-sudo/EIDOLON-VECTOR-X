import { localRequest } from './localRequest'
import type { XYZ } from './explore'
import type { FoundryPoint } from './FoundryMap'

export type Direction = { name: string; model_id: string; linear: number[]; centroid: number[] }
export type Example = { text: string; family: string; positive: boolean; split: 'fit' | 'validation' }
export type Validation = { fit: number; held_out: number; balanced_accuracy: number; confusion: Record<string,number>; threshold: number }
export type Concept = { direction: Direction; validation: Validation; examples?: Example[] }
export type Workspace = { model_id: string; presets: Concept[]; documents: string[]; categories: string[] }
export type ImportIndex = { modelId: string; texts: string[]; points: FoundryPoint[]; categories?: string[] }
export type Mode = 'original' | 'naive' | 'learned' | 'locked'
export type Variant = {
  vector: number[]; trajectory: XYZ[]; applied: number; target_delta: number; drift: number; cosine: number;
  satisfied: boolean; reason: string | null; neighbors: {id:number; score:number}[]; gained: number[]; lost: number[];
  changes: {id:number; before:number; after:number}[]; attributes: {name:string; role:string; before:number; after:number}[];
  suspicions: {id:number; reason:string}[]; ndcg: number | null
}
export type Analysis = {
  model_id: string; requested: number; variants: Record<Mode,Variant>; points: XYZ[];
  conflicts: {a:string; b:string; cosine:number}[];
  fidelity: {population:number; sample:number; k:number; calibration_variance:number; trustworthiness:number|null;
    overlap:number|null; distance_rho:number|null; distortion:Record<string,number>}
}
export async function labRequest<T>(route: string, input: unknown, signal: AbortSignal): Promise<T> {
  return localRequest<T>('intelligence/'+route, JSON.stringify(input), signal)
}
export const fmt = (v: number | null | undefined) => v == null ? 'Unavailable' : v.toFixed(3)
export const title: Record<Mode,string> = {original:'Original', naive:'Naive centroid', learned:'Learned', locked:'Semantic Lock'}
