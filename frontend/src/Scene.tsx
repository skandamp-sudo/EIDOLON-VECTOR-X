import { Canvas, useThree } from '@react-three/fiber'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { palette, signature } from './geometry'

export type Pose = [number, number, number]
type Props = { vector: number[]; pose: Pose }
function FitCamera() {
  const { camera, size, invalidate } = useThree()
  useLayoutEffect(() => {
    camera.zoom = Math.min(size.width / 5.2, size.height / 3.9, 95)
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, size.width, size.height, invalidate])
  return null
}
function Surface({ vector, pose }: Props) {
  const layers = useMemo(() => {
    const lines = signature(vector)
    return [false, true].map(cross => {
      const positions: number[] = [], colors: number[] = []
      for (const s of lines) {
        if (s.cross !== cross) continue
        positions.push(...s.a, ...s.b)
        const c = new Color(palette[s.color])
        colors.push(c.r,c.g,c.b,c.r,c.g,c.b)
      }
      const geometry = new BufferGeometry()
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
      geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
      return geometry
    })
  }, [vector])
  useEffect(() => () => layers.forEach(layer => layer.dispose()), [layers])
  return <group rotation={pose}>{layers.map((geometry, i) =>
    <lineSegments key={i} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={i ? 0.18 : 0.7} depthWrite={false} />
    </lineSegments>)}</group>
}
export default function Scene(props: Props) {
  return <Canvas orthographic camera={{ position: [0,0,7], zoom: 60 }} dpr={[1,1.6]}
    frameloop="demand" gl={{ alpha: true, antialias: true }}>
    <FitCamera />
    <Surface {...props} />
  </Canvas>
}
