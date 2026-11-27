// Eight equally spaced azimuths sample the signed LSA coefficients. Linear
// interpolation controls tube radius. The twist and color are fixed styling.
export type Point = [number, number, number]
export const palette = ['#61e7de', '#72d7e2', '#87badf', '#a298ea', '#ba91ed']
export function signature(vector: number[]) {
  const rings = 112, sides = 32, tau = Math.PI * 2
  function point(i: number, j: number): Point {
    const t = i / rings * tau, p = j / sides * tau
    const sample = i / rings * vector.length, k = Math.floor(sample) % vector.length
    const f = sample - Math.floor(sample)
    const value = vector[k] * (1 - f) + vector[(k + 1) % vector.length] * f
    const r = 0.56 + value * 0.38
    const major = 1.52 + 0.21 * Math.cos(3 * t + 0.6)
    const radius = major + r * Math.cos(p)
    return [radius * Math.cos(t), (0.44 * Math.sin(2*t + 0.5) + r*Math.sin(p)), radius * Math.sin(t)]
  }
  const segments: { a: Point; b: Point; color: number; cross: boolean }[] = []
  for (let i = 0; i < rings; i++) {
    const color = Math.round((1 - Math.cos(i/rings*tau - 2.9)) * 2)
    for (let j = 0; j < sides; j++) {
      segments.push({ a: point(i,j), b: point(i,j+1), color, cross: false })
      if (j % 2 === 0) segments.push({ a: point(i,j), b: point(i+1,j), color, cross: true })
    }
  }
  return segments
}
