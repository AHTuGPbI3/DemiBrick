'use client'

import { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'

// LEGO dimensions (mm → scene units where 1 unit = 1mm)
const STUD_W   = 8     // stud pitch
const PLATE_H  = 3.2   // plate height
const STUD_D   = 4.8   // stud diameter
const STUD_H   = 1.8   // stud height
const GAP      = 0.2   // gap between bricks

interface Brick {
  x: number; y: number; w: number; h: number
  hex: string
  layer?: number
}

interface Props {
  bricks: Brick[]
  gridW: number
  gridH: number
  showGrid?: boolean
  visibleLayers?: number[]
}

function BrickMesh({ bricks }: { bricks: Brick[] }) {
  // Group by colour for InstancedMesh
  const groups = useMemo(() => {
    const map = new Map<string, Brick[]>()
    for (const b of bricks) {
      if (!map.has(b.hex)) map.set(b.hex, [])
      map.get(b.hex)!.push(b)
    }
    return map
  }, [bricks])

  return (
    <>
      {Array.from(groups.entries()).map(([hex, group]) => (
        <BrickGroup key={hex} hex={hex} bricks={group} />
      ))}
    </>
  )
}

function BrickGroup({ hex, bricks }: { hex: string; bricks: Brick[] }) {
  const color   = useMemo(() => new THREE.Color(hex), [hex])
  const darkCol = useMemo(() => new THREE.Color(hex).multiplyScalar(0.75), [hex])
  const lightCol= useMemo(() => { const c = new THREE.Color(hex).multiplyScalar(1.3); c.r = Math.min(c.r,1); c.g = Math.min(c.g,1); c.b = Math.min(c.b,1); return c }, [hex])

  return (
    <>
      {bricks.map((b, i) => {
        const bw = b.w * STUD_W - GAP
        const bd = b.h * STUD_W - GAP
        const bh = PLATE_H
        const cx = b.x * STUD_W + bw / 2
        const cy = (b.layer ?? 0) * (PLATE_H + STUD_H) + bh / 2
        const cz = b.y * STUD_W + bd / 2

        // Studs
        const studs: JSX.Element[] = []
        for (let sx = 0; sx < b.w; sx++) {
          for (let sz = 0; sz < b.h; sz++) {
            const sx_pos = b.x * STUD_W + sx * STUD_W + STUD_W / 2
            const sz_pos = b.y * STUD_W + sz * STUD_W + STUD_W / 2
            studs.push(
              <mesh key={`${sx}-${sz}`}
                position={[sx_pos, cy + bh / 2 + STUD_H / 2, sz_pos]}
                castShadow>
                <cylinderGeometry args={[STUD_D / 2, STUD_D / 2, STUD_H, 12]} />
                <meshStandardMaterial color={lightCol} roughness={0.3} />
              </mesh>
            )
          }
        }

        return (
          <group key={i}>
            <mesh position={[cx, cy, cz]} castShadow receiveShadow>
              <boxGeometry args={[bw, bh, bd]} />
              <meshStandardMaterial color={color} roughness={0.3} metalness={0.05} />
            </mesh>
            {studs}
          </group>
        )
      })}
    </>
  )
}

function Scene({ bricks, gridW, gridH, showGrid, visibleLayers }: Props) {
  const filtered = useMemo(() => {
    if (!visibleLayers || visibleLayers.length === 0) return bricks
    return bricks.filter(b => visibleLayers.includes(b.layer ?? 0))
  }, [bricks, visibleLayers])

  const totalW = gridW * STUD_W
  const totalD = gridH * STUD_W

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[totalW, totalW, totalD]} intensity={1.2} castShadow
        shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-totalW * 0.5, totalW * 0.3, -totalD * 0.5]} intensity={0.4} />

      <group position={[-totalW / 2, 0, -totalD / 2]}>
        <BrickMesh bricks={filtered} />
        {showGrid && (
          <Grid
            position={[totalW / 2, -0.5, totalD / 2]}
            args={[totalW + STUD_W * 2, totalD + STUD_W * 2]}
            cellSize={STUD_W}
            cellColor="#aaaaaa"
            sectionSize={STUD_W * 4}
            sectionColor="#888888"
            fadeDistance={totalW * 5}
            infiniteGrid={false}
          />
        )}
      </group>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  )
}

export default function LegoPreview3D({ bricks, gridW, gridH }: Props) {
  const maxDim = Math.max(gridW, gridH)
  const camDist = maxDim * STUD_W * 1.8

  const [showGrid, setShowGrid]           = useMemo(() => [true, (v: boolean) => {}], []) as any
  const [showGridState, setShowGridState] = useMemo(() => {
    let s = true
    return [s, (v: boolean) => { s = v }]
  }, []) as [boolean, (v: boolean) => void]

  // Use React state properly
  const [grid, setGrid]   = require('react').useState(true)
  const [camPreset, setCam] = require('react').useState<'perspective' | 'top' | 'front'>('perspective')

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getCameraPos = (): [number, number, number] => {
    const cw = gridW * STUD_W
    const ch = gridH * STUD_W
    switch (camPreset) {
      case 'top':   return [0, camDist * 1.5, 0.01]
      case 'front': return [0, ch / 2, camDist]
      default:      return [camDist * 0.7, camDist * 0.8, camDist * 0.7]
    }
  }

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-400 font-semibold uppercase tracking-widest">View:</span>
        {(['perspective', 'top', 'front'] as const).map(p => (
          <button key={p} onClick={() => setCam(p)}
            className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${camPreset === p ? 'bg-[#1A1A2E] text-white border-[#1A1A2E]' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
        <label className="flex items-center gap-1.5 ml-2 cursor-pointer text-xs text-gray-500">
          <input type="checkbox" checked={grid} onChange={e => setGrid(e.target.checked)} className="accent-[#FFD700]" />
          Grid
        </label>
      </div>

      {/* Canvas */}
      <div className="rounded-2xl overflow-hidden border border-gray-100 bg-[#1A1A2E]" style={{ height: 400 }}>
        <Canvas
          camera={{ position: getCameraPos(), fov: 45, near: 0.1, far: 100000 }}
          shadows
          gl={{ antialias: true }}
        >
          <Suspense fallback={null}>
            <Scene
              bricks={bricks}
              gridW={gridW}
              gridH={gridH}
              showGrid={grid}
            />
          </Suspense>
        </Canvas>
      </div>
      <p className="text-xs text-gray-400 text-center">Drag to rotate · Scroll to zoom · Right-click to pan</p>
    </div>
  )
}
