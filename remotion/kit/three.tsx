// Real 3D for the 3D styles: a lit stage, a camera that moves in sync with frames, and a few materials.
// Scenes import from '@kit/three' plus 'three' and '@react-three/fiber'.
import React, { useMemo } from 'react'
import { ThreeCanvas } from '@remotion/three'
import { interpolate, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useScene } from './index'

const ease = Easing.bezier(0.45, 0, 0.25, 1)

export type Vec3 = [number, number, number]
export interface CameraKey {
  at: number // frame
  pos: Vec3
  look?: Vec3
  fov?: number
}

function Camera({ keys }: { keys: CameraKey[] }) {
  const frame = useCurrentFrame()
  const { camera } = useThree()
  const ks = keys.length ? keys : [{ at: 0, pos: [0, 3, 9] as Vec3, look: [0, 0, 0] as Vec3 }]
  const ats = ks.map((k) => k.at)
  const lerp = (get: (k: CameraKey) => number) =>
    ks.length === 1 ? get(ks[0]) : interpolate(frame, ats, ks.map(get), { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
  const pos: Vec3 = [lerp((k) => k.pos[0]), lerp((k) => k.pos[1]), lerp((k) => k.pos[2])]
  const look: Vec3 = [lerp((k) => (k.look ?? [0, 0, 0])[0]), lerp((k) => (k.look ?? [0, 0, 0])[1]), lerp((k) => (k.look ?? [0, 0, 0])[2])]
  camera.position.set(...pos)
  if ((camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = lerp((k) => k.fov ?? 40)
    cam.updateProjectionMatrix()
  }
  camera.lookAt(...look)
  return null
}

/** The 3D stage: background, soft key light with shadows, fill and rim lights, and an optional ground. */
export function Stage3D({
  camera = [],
  ground = true,
  fog = true,
  light = 'studio',
  children
}: {
  camera?: CameraKey[]
  ground?: boolean
  fog?: boolean
  light?: 'studio' | 'sunset' | 'night' | 'paper'
  children?: React.ReactNode
}) {
  const s = useScene()
  const { width, height } = useVideoConfig()
  const bg = s.palette.bg
  const L = {
    studio: { key: '#ffffff', keyI: 2.2, fill: '#b9c8ff', fillI: 0.6, amb: 0.35 },
    sunset: { key: '#ffd2a1', keyI: 2.6, fill: '#7a8cff', fillI: 0.5, amb: 0.3 },
    night: { key: '#9ec4ff', keyI: 1.4, fill: '#3a4a8a', fillI: 0.4, amb: 0.15 },
    paper: { key: '#fff4e2', keyI: 2.0, fill: '#ffe8cc', fillI: 0.7, amb: 0.45 }
  }[light]
  return (
    <ThreeCanvas width={width} height={height} style={{ background: bg }} shadows gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <Camera keys={camera} />
      <color attach="background" args={[bg]} />
      {fog && <fog attach="fog" args={[bg, 14, 40]} />}
      <ambientLight intensity={L.amb} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={L.keyI}
        color={L.key}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <directionalLight position={[-8, 4, -4]} intensity={L.fillI} color={L.fill} />
      <pointLight position={[0, 6, -10]} intensity={0.8} color={s.palette.accent} />
      {ground && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color={s.palette.paper ?? bg} roughness={1} />
        </mesh>
      )}
      {children}
    </ThreeCanvas>
  )
}

/** 0 → 1 between two frames, eased: use it to grow, move or fade 3D things in sync with words. */
export function useProgress(start: number, dur = 20) {
  const frame = useCurrentFrame()
  return interpolate(frame, [start, start + Math.max(1, dur)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease })
}

/** A springy pop-in scale for 3D objects. */
export function usePop(start: number) {
  const p = useProgress(start, 14)
  // Grows to 1 with a small overshoot in the middle of the move.
  return p === 0 ? 0.0001 : p + Math.sin(p * Math.PI) * 0.15
}

/** Materials that suit the 3D styles. */
export function Paper({ color = '#f4efe6' }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.95} metalness={0} side={THREE.DoubleSide} />
}
export function Clay({ color = '#ff8a5c' }: { color?: string }) {
  return <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} />
}
export function Glow({ color = '#7cc4ff', intensity = 2 }: { color?: string; intensity?: number }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
}
/** Blueprint / pencil look: white (or graphite) edges over a faint face. */
export function LineBox({ size = [1, 1, 1] as Vec3, color = '#e8f0ff', face = '#1747b8', opacity = 0.15, draw = 1 }: { size?: Vec3; color?: string; face?: string; opacity?: number; draw?: number }) {
  const geo = useMemo(() => new THREE.BoxGeometry(...size), [size.join()])
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo])
  return (
    <group>
      <mesh geometry={geo}>
        <meshBasicMaterial color={face} transparent opacity={opacity * draw} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent opacity={draw} />
      </lineSegments>
    </group>
  )
}

/** A simple folded paper plane, about 2 units long, pointing down -Z. */
export function PaperPlane({ color = '#f7f3ea' }: { color?: string }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // nose, left wing tip, tail centre (keel), right wing tip, tail top
    const v = new Float32Array([
      0, 0, -1, -0.9, 0.05, 0.9, 0, 0, 0.9,
      0, 0, -1, 0, 0, 0.9, 0.9, 0.05, 0.9,
      0, 0, -1, 0, 0, 0.9, 0, -0.35, 0.9
    ])
    g.setAttribute('position', new THREE.BufferAttribute(v, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} castShadow>
      <Paper color={color} />
    </mesh>
  )
}

export { THREE }
