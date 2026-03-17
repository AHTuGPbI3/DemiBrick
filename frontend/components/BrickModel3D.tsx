'use client'

import { useRef, useMemo, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'

// ── LEGO physical dimensions (mm) ────────────────────────────────────────────
const STUD  = 8.0    // stud pitch
const PLATE = 3.2    // plate height unit
const STUD_D = 1.8   // stud cylinder height
const STUD_R = 2.4   // stud cylinder radius

export interface Brick3D {
  x: number        // stud col
  y: number        // stud row
  z_floor: number  // plate layer (0 = bottom)
  w: number        // width studs
  d: number        // depth studs
  h: number        // height plate-units (1=plate, 3=brick)
  color_hex: string
  color_id: string
  color_name: string
  part: string
  name: string
}

type ViewMode = 'normal' | 'explode' | 'build' | 'xray'
type CamPreset = 'perspective' | 'top' | 'front' | 'side'

interface Props {
  bricks: Brick3D[]
  gridW: number
  gridD: number
  gridH: number
}

// ── Single instanced group per color ─────────────────────────────────────────
function ColorGroup({
  hex, bricks, explodeFactor, buildLayer, xray,
}: {
  hex: string
  bricks: Brick3D[]
  explodeFactor: number
  buildLayer: number
  xray: boolean
}) {
  const meshRef    = useRef<THREE.InstancedMesh>(null)
  const studRef    = useRef<THREE.InstancedMesh>(null)

  const color = useMemo(() => new THREE.Color(hex), [hex])
  const lightColor = useMemo(() => {
    const c = new THREE.Color(hex).multiplyScalar(1.35)
    c.r = Math.min(c.r, 1); c.g = Math.min(c.g, 1); c.b = Math.min(c.b, 1)
    return c
  }, [hex])

  const visible = useMemo(
    () => bricks.filter(b => b.z_floor <= buildLayer),
    [bricks, buildLayer],
  )

  useEffect(() => {
    const mesh  = meshRef.current
    const studs = studRef.current
    if (!mesh || !studs) return

    const mat4 = new THREE.Matrix4()
    let si = 0

    visible.forEach(b => {
      const bw = b.w * STUD
      const bh = b.h * PLATE
      const bd = b.d * STUD

      const cx = b.x * STUD + bw / 2
      const cz = b.y * STUD + bd / 2
      const cy = b.z_floor * PLATE + bh / 2

      const ex = cx * explodeFactor
      const ey = cy * explodeFactor
      const ez = cz * explodeFactor

      // Brick body
      mat4.makeTranslation(ex, ey, ez)
      mat4.scale(new THREE.Vector3(bw, bh, bd))
      mesh.setMatrixAt(visible.indexOf(b), mat4)

      // Studs
      for (let sx = 0; sx < b.w; sx++) {
        for (let sd = 0; sd < b.d; sd++) {
          const scx = (b.x + sx + 0.5) * STUD * explodeFactor
          const scz = (b.y + sd + 0.5) * STUD * explodeFactor
          const scy = (b.z_floor * PLATE + bh + STUD_D / 2) * explodeFactor
          mat4.makeTranslation(scx, scy, scz)
          studs.setMatrixAt(si++, mat4)
        }
      }
    })

    mesh.count = visible.length
    studs.count = si
    mesh.instanceMatrix.needsUpdate  = true
    studs.instanceMatrix.needsUpdate = true
  }, [visible, explodeFactor])

  const totalStuds = useMemo(() => bricks.reduce((s, b) => s + b.w * b.d, 0), [bricks])

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, visible.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          metalness={0.0}
          transparent={xray}
          opacity={xray ? 0.25 : 1.0}
        />
      </instancedMesh>
      <instancedMesh ref={studRef} args={[undefined, undefined, totalStuds]}>
        <cylinderGeometry args={[STUD_R, STUD_R, STUD_D, 12]} />
        <meshStandardMaterial
          color={lightColor}
          roughness={0.3}
          metalness={0.0}
          transparent={xray}
          opacity={xray ? 0.15 : 1.0}
        />
      </instancedMesh>
    </>
  )
}

// ── Baseplate ─────────────────────────────────────────────────────────────────
function Baseplate({ w, d }: { w: number; d: number }) {
  return (
    <mesh position={[w * STUD / 2, -1.6, d * STUD / 2]}>
      <boxGeometry args={[w * STUD + 4, 3.2, d * STUD + 4]} />
      <meshStandardMaterial color="#4CAF50" roughness={0.6} />
    </mesh>
  )
}

// ── Camera preset controller ──────────────────────────────────────────────────
function CameraController({ preset, cx, cy, cz }: { preset: CamPreset; cx: number; cy: number; cz: number }) {
  const { camera } = useThree()
  useEffect(() => {
    const r = Math.max(cx, cy, cz) * 2.5
    if (preset === 'top')   { camera.position.set(cx, r * 2, cz) }
    if (preset === 'front') { camera.position.set(cx, cy, r * 2) }
    if (preset === 'side')  { camera.position.set(r * 2, cy, cz) }
    if (preset === 'perspective') { camera.position.set(cx + r, cy + r * 0.8, cz + r) }
    camera.lookAt(cx, cy, cz)
  }, [preset, cx, cy, cz, camera])
  return null
}

// ── Build animation ticker ────────────────────────────────────────────────────
function BuildTicker({ maxLayer, onTick }: { maxLayer: number; onTick: (l: number) => void }) {
  const layerRef = useRef(0)
  useFrame((_, delta) => {
    layerRef.current += delta * 4  // 4 layers per second
    const l = Math.min(Math.floor(layerRef.current), maxLayer)
    onTick(l)
  })
  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BrickModel3D({ bricks, gridW, gridD, gridH }: Props) {
  const [mode,      setMode]      = useState<ViewMode>('normal')
  const [cam,       setCam]       = useState<CamPreset>('perspective')
  const [showBase,  setShowBase]  = useState(true)
  const [buildLyr,  setBuildLyr]  = useState(gridH)

  // Group bricks by hex color
  const byColor = useMemo(() => {
    const map: Record<string, Brick3D[]> = {}
    for (const b of bricks) {
      ;(map[b.color_hex] ??= []).push(b)
    }
    return map
  }, [bricks])

  const explode   = mode === 'explode' ? 1.5 : 1.0
  const xray      = mode === 'xray'
  const maxLayer  = gridH
  const cx = gridW * STUD / 2
  const cy = gridH * PLATE / 2
  const cz = gridD * STUD / 2

  useEffect(() => {
    if (mode !== 'build') setBuildLyr(maxLayer)
    else setBuildLyr(0)
  }, [mode, maxLayer])

  const modeButtons: { k: ViewMode; label: string }[] = [
    { k: 'normal',  label: '🧱 Normal'  },
    { k: 'explode', label: '💥 Explode' },
    { k: 'build',   label: '🏗 Build'   },
    { k: 'xray',    label: '🔎 X-Ray'   },
  ]
  const camButtons: { k: CamPreset; label: string }[] = [
    { k: 'perspective', label: '3D' },
    { k: 'top',         label: 'Top' },
    { k: 'front',       label: 'Front' },
    { k: 'side',        label: 'Side' },
  ]

  return (
    <div className="space-y-2">
      {/* Mode bar */}
      <div className="flex gap-1 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 flex-1">
          {modeButtons.map(({ k, label }) => (
            <button key={k} onClick={() => setMode(k)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all
                ${mode === k ? 'bg-white shadow text-[#1A1A2E]' : 'text-gray-400 hover:text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {camButtons.map(({ k, label }) => (
            <button key={k} onClick={() => setCam(k)}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all
                ${cam === k ? 'bg-white shadow text-[#1A1A2E]' : 'text-gray-400'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Build layer progress */}
      {mode === 'build' && (
        <div className="text-xs text-gray-400 text-center">
          Layer {Math.min(buildLyr, maxLayer)} / {maxLayer}
        </div>
      )}

      {/* Canvas */}
      <div className="rounded-2xl overflow-hidden border border-gray-100" style={{ height: 420 }}>
        <Canvas camera={{ position: [cx + 80, cy + 60, cz + 80], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[50, 100, 50]} intensity={1.2} castShadow />
          <directionalLight position={[-30, 60, -30]} intensity={0.4} />

          <CameraController preset={cam} cx={cx} cy={cy} cz={cz} />
          {mode === 'build' && (
            <BuildTicker maxLayer={maxLayer} onTick={l => setBuildLyr(l)} />
          )}

          {Object.entries(byColor).map(([hex, group]) => (
            <ColorGroup
              key={hex}
              hex={hex}
              bricks={group}
              explodeFactor={explode}
              buildLayer={buildLyr}
              xray={xray}
            />
          ))}

          {showBase && <Baseplate w={gridW} d={gridD} />}

          <OrbitControls
            target={[cx, cy, cz]}
            enableDamping dampingFactor={0.08}
            minDistance={20} maxDistance={500}
          />
          <Grid
            args={[gridW * STUD * 2, gridD * STUD * 2]}
            position={[cx, -1, cz]}
            cellSize={STUD}
            cellColor="#d1d5db"
            sectionSize={STUD * 4}
            sectionColor="#9ca3af"
            fadeDistance={400}
            infiniteGrid={false}
          />
        </Canvas>
      </div>

      {/* Baseplate toggle */}
      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
        <input type="checkbox" checked={showBase} onChange={e => setShowBase(e.target.checked)}
          className="accent-[#FFD700]" />
        Show baseplate
      </label>

      {/* Quick stats */}
      <div className="text-xs text-gray-400 text-center">
        {bricks.length.toLocaleString()} bricks · {Object.keys(byColor).length} colors
        · {gridW}×{gridD}×{gridH} grid
      </div>
    </div>
  )
}
