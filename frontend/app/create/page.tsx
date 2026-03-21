'use client'

import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import ImageDropzone from '@/components/ImageDropzone'
import MosaicResult from '@/components/MosaicResult'

const BrickModel3D = lazy(() => import('@/components/BrickModel3D'))

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Types ─────────────────────────────────────────────────────────────────────
type AppMode = 'mosaic' | '3d'
type Step =
  | 'upload' | 'preview' | 'removing'
  | 'pixelize' | 'pixelizing' | 'result'          // mosaic
  | 'reconstructing' | 'mesh_preview'              // 3D – mesh
  | 'voxelizing' | 'optimizing3d' | 'result3d'    // 3D – bricks

const RESOLUTIONS_MOSAIC = [
  { value: 16, label: '16×', desc: 'Simple' },
  { value: 32, label: '32×', desc: 'Balanced' },
  { value: 48, label: '48×', desc: 'Detailed' },
  { value: 64, label: '64×', desc: 'Max detail' },
]
const RESOLUTIONS_3D = [
  { value: 8,  label: '8×',  desc: 'Fast (low detail)' },
  { value: 16, label: '16×', desc: 'Balanced' },
  { value: 24, label: '24×', desc: 'Detailed' },
  { value: 32, label: '32×', desc: 'Max (slow)' },
]

const FUN_FACTS = [
  'TripoSR uses a transformer network to predict 3D shape from a single image.',
  'LEGO produces ~400 billion bricks per year — 50 for every person on Earth.',
  'The word "LEGO" comes from the Danish "leg godt" — play well.',
  'A 2×4 LEGO brick can withstand 4,240 N of force before crumbling.',
  'Bambu Lab PLA Basic has a melt index of ~10–30 g/10min — great for detail.',
  'The first LEGO patent for the stud-and-tube system was filed in 1958.',
  'TripoSR can reconstruct a 3D mesh from a photo in under 30 seconds on GPU.',
  'faBrickation (the algorithm used here) was published at CHI 2014.',
]

const BAMBU_COLORS = [
  { id: 'basic-01', name: 'Jade White',       hex: '#FFFFFF', type: 'PLA Basic' },
  { id: 'basic-02', name: 'Beige',            hex: '#F7E6DE', type: 'PLA Basic' },
  { id: 'basic-03', name: 'Light Gray',       hex: '#D1D3D5', type: 'PLA Basic' },
  { id: 'basic-04', name: 'Silver',           hex: '#A6A9AA', type: 'PLA Basic' },
  { id: 'basic-05', name: 'Gray',             hex: '#8E9089', type: 'PLA Basic' },
  { id: 'basic-06', name: 'Blue Grey',        hex: '#5B6579', type: 'PLA Basic' },
  { id: 'basic-07', name: 'Dark Gray',        hex: '#545454', type: 'PLA Basic' },
  { id: 'basic-08', name: 'Black',            hex: '#000000', type: 'PLA Basic' },
  { id: 'basic-09', name: 'Red',              hex: '#C12E1F', type: 'PLA Basic' },
  { id: 'basic-10', name: 'Maroon Red',       hex: '#9D2235', type: 'PLA Basic' },
  { id: 'basic-11', name: 'Magenta',          hex: '#EC008C', type: 'PLA Basic' },
  { id: 'basic-12', name: 'Hot Pink',         hex: '#F5547C', type: 'PLA Basic' },
  { id: 'basic-13', name: 'Pink',             hex: '#F55A74', type: 'PLA Basic' },
  { id: 'basic-14', name: 'Orange',           hex: '#FF6A13', type: 'PLA Basic' },
  { id: 'basic-15', name: 'Pumpkin Orange',   hex: '#FF9016', type: 'PLA Basic' },
  { id: 'basic-16', name: 'Gold',             hex: '#E4BD68', type: 'PLA Basic' },
  { id: 'basic-17', name: 'Bronze',           hex: '#847D48', type: 'PLA Basic' },
  { id: 'basic-18', name: 'Sunflower Yellow', hex: '#FEC600', type: 'PLA Basic' },
  { id: 'basic-19', name: 'Yellow',           hex: '#F4EE2A', type: 'PLA Basic' },
  { id: 'basic-20', name: 'Bright Green',     hex: '#BECF00', type: 'PLA Basic' },
  { id: 'basic-21', name: 'Bambu Green',      hex: '#00AE42', type: 'PLA Basic' },
  { id: 'basic-22', name: 'Mistletoe Green',  hex: '#3F8E43', type: 'PLA Basic' },
  { id: 'basic-23', name: 'Turquoise',        hex: '#00B1B7', type: 'PLA Basic' },
  { id: 'basic-24', name: 'Cyan',             hex: '#0086D6', type: 'PLA Basic' },
  { id: 'basic-25', name: 'Cobalt Blue',      hex: '#0056B8', type: 'PLA Basic' },
  { id: 'basic-26', name: 'Blue',             hex: '#0A2989', type: 'PLA Basic' },
  { id: 'basic-27', name: 'Purple',           hex: '#5E43B7', type: 'PLA Basic' },
  { id: 'basic-28', name: 'Indigo Purple',    hex: '#482960', type: 'PLA Basic' },
  { id: 'basic-29', name: 'Cocoa Brown',      hex: '#6F5034', type: 'PLA Basic' },
  { id: 'basic-30', name: 'Brown',            hex: '#9D432C', type: 'PLA Basic' },
  { id: 'matte-01', name: 'Ivory White',      hex: '#FFFFFF', type: 'PLA Matte' },
  { id: 'matte-02', name: 'Bone White',       hex: '#CBC6B8', type: 'PLA Matte' },
  { id: 'matte-03', name: 'Desert Tan',       hex: '#E8DBB7', type: 'PLA Matte' },
  { id: 'matte-04', name: 'Latte Brown',      hex: '#D3B7A7', type: 'PLA Matte' },
  { id: 'matte-05', name: 'Caramel',          hex: '#AE835B', type: 'PLA Matte' },
  { id: 'matte-06', name: 'Terracotta',       hex: '#B15533', type: 'PLA Matte' },
  { id: 'matte-07', name: 'Dark Brown',       hex: '#7D6556', type: 'PLA Matte' },
  { id: 'matte-08', name: 'Dark Chocolate',   hex: '#4D3324', type: 'PLA Matte' },
  { id: 'matte-09', name: 'Lilac Purple',     hex: '#AE96D4', type: 'PLA Matte' },
  { id: 'matte-10', name: 'Sakura Pink',      hex: '#E8AFCF', type: 'PLA Matte' },
  { id: 'matte-11', name: 'Mandarin Orange',  hex: '#F99963', type: 'PLA Matte' },
  { id: 'matte-12', name: 'Lemon Yellow',     hex: '#F7D959', type: 'PLA Matte' },
  { id: 'matte-13', name: 'Plum',             hex: '#950051', type: 'PLA Matte' },
  { id: 'matte-14', name: 'Scarlet Red',      hex: '#DE4343', type: 'PLA Matte' },
  { id: 'matte-15', name: 'Dark Red',         hex: '#BB3D43', type: 'PLA Matte' },
  { id: 'matte-16', name: 'Dark Green',       hex: '#68724D', type: 'PLA Matte' },
  { id: 'matte-17', name: 'Grass Green',      hex: '#61C680', type: 'PLA Matte' },
  { id: 'matte-18', name: 'Apple Green',      hex: '#C2E189', type: 'PLA Matte' },
  { id: 'matte-19', name: 'Ice Blue',         hex: '#A3D8E1', type: 'PLA Matte' },
  { id: 'matte-20', name: 'Sky Blue',         hex: '#56B7E6', type: 'PLA Matte' },
  { id: 'matte-21', name: 'Marine Blue',      hex: '#0078BF', type: 'PLA Matte' },
  { id: 'matte-22', name: 'Dark Blue',        hex: '#042F56', type: 'PLA Matte' },
  { id: 'matte-23', name: 'Ash Gray',         hex: '#9B9EA0', type: 'PLA Matte' },
  { id: 'matte-24', name: 'Nardo Gray',       hex: '#757575', type: 'PLA Matte' },
  { id: 'matte-25', name: 'Charcoal',         hex: '#000000', type: 'PLA Matte' },
]

// ── Interfaces ────────────────────────────────────────────────────────────────
interface ColorEntry {
  color_id: string; name: string; hex: string; filament_type: string; count: number
}
interface MosaicData {
  preview: string; pixel_grid: (number | null)[][]
  dimensions: { w: number; h: number }; color_summary: ColorEntry[]; total_studs: number
  layers?: (number | null)[][][]; depth_preview?: string; num_layers?: number
}
interface VoxelData {
  voxel_grid: (string | null)[][][]; dimensions: { w: number; d: number; h: number }
  total_voxels: number; color_summary: { color_id: string; name: string; hex: string; filament_type: string; count: number }[]
  spools_needed: string[]
}
interface BrickEntry {
  x: number; y: number; z_floor: number; w: number; d: number; h: number
  color_hex: string; color_id: string; color_name: string; part: string; name: string
  filament_type: string; layer: number
}
interface BomEntry3D {
  part: string; name: string; color_id: string; color_name: string
  color_hex: string; hex: string; filament_type: string; count: number
}
interface Optimize3DResult {
  bricks: BrickEntry[]; bom: BomEntry3D[]
  total_bricks: number; total_voxels: number; optimization_ratio: number; stability: number
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CreatePage() {
  const [mode, setMode]               = useState<AppMode>('mosaic')
  const [step, setStep]               = useState<Step>('upload')
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [noBgUrl, setNoBgUrl]         = useState<string | null>(null)
  const [error, setError]             = useState<string | null>(null)

  // 3D health status
  const [triposrStatus, setTriposrStatus] = useState<'unknown'|'checking'|'ok'|'warn'>('unknown')

  // Mosaic state
  const [resolution, setResolution]   = useState(32)
  const [depthLayers, setDepthLayers] = useState(1)
  const [mosaicData, setMosaicData]   = useState<MosaicData | null>(null)

  // 3D state
  const [resolution3d, setResolution3d] = useState(16)
  const [model3dUrl, setModel3dUrl]   = useState<string | null>(null)
  const [voxelData, setVoxelData]     = useState<VoxelData | null>(null)
  const [opt3dResult, setOpt3dResult] = useState<Optimize3DResult | null>(null)
  const [hollow, setHollow]           = useState(false)

  // Filament selection
  const [usePlaBasic, setUsePlaBasic]         = useState(true)
  const [usePlaMatte, setUsePlaMatte]         = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [customIds, setCustomIds]             = useState<string[] | null>(null)

  // Live preview (L1 = canvas, L2 = quality server preview)
  const [l2Preview, setL2Preview]  = useState<string | null>(null)
  const [l2Grid, setL2Grid]        = useState<(number | null)[][] | null>(null)
  const [l2Dims, setL2Dims]        = useState<{ w: number; h: number } | null>(null)
  const [l2Colors, setL2Colors]    = useState<ColorEntry[] | null>(null)
  const [l2Studs, setL2Studs]      = useState<number>(0)
  const [l2Loading, setL2Loading]  = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const noBgImgRef  = useRef<HTMLImageElement | null>(null)

  // Fun facts ticker
  const [factIdx, setFactIdx] = useState(0)
  useEffect(() => {
    if (!['reconstructing', 'voxelizing', 'optimizing3d'].includes(step)) return
    const t = setInterval(() => setFactIdx(i => (i + 1) % FUN_FACTS.length), 4000)
    return () => clearInterval(t)
  }, [step])

  // Check TripoSR health when user picks 3D mode
  useEffect(() => {
    if (mode !== '3d') return
    setTriposrStatus('checking')
    fetch(`${API_URL}/api/3d/health`)
      .then(r => r.json())
      .then(d => setTriposrStatus(d.any_available ? 'ok' : 'warn'))
      .catch(() => setTriposrStatus('warn'))
  }, [mode])

  const visibleColors = BAMBU_COLORS.filter(c =>
    c.type === 'PLA Basic' ? usePlaBasic : usePlaMatte
  )

  function toggleCustomId(id: string) {
    const base = customIds ?? visibleColors.map(c => c.id)
    setCustomIds(base.includes(id) ? base.filter(x => x !== id) : [...base, id])
  }

  function getFilamentPayload() {
    if (customIds) return { custom_color_ids: customIds, filament_types: [] }
    const types = [usePlaBasic && 'PLA Basic', usePlaMatte && 'PLA Matte'].filter(Boolean) as string[]
    return { filament_types: types.length ? types : ['PLA Basic'], custom_color_ids: [] }
  }

  // ── Live preview helpers ────────────────────────────────────────────────────

  function doInstantPreview() {
    const img = noBgImgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas || img.naturalWidth === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const aspect = img.naturalWidth / img.naturalHeight
    const pw = resolution
    const ph = Math.max(1, Math.round(pw / aspect))

    const off = document.createElement('canvas')
    off.width = pw; off.height = ph
    const octx = off.getContext('2d')!
    octx.drawImage(img, 0, 0, pw, ph)
    const px = octx.getImageData(0, 0, pw, ph)

    const SCALE = Math.max(4, Math.floor(320 / pw))
    canvas.width  = pw * SCALE
    canvas.height = ph * SCALE
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const activePal = BAMBU_COLORS.filter(c =>
      customIds !== null
        ? customIds.includes(c.id)
        : (c.type === 'PLA Basic' ? usePlaBasic : usePlaMatte)
    )
    if (activePal.length === 0) return
    const palRgb = activePal.map(c => ({
      hex: c.hex,
      r: parseInt(c.hex.slice(1, 3), 16),
      g: parseInt(c.hex.slice(3, 5), 16),
      b: parseInt(c.hex.slice(5, 7), 16),
    }))

    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const i = (y * pw + x) * 4
        const r = px.data[i], g = px.data[i + 1], b = px.data[i + 2], a = px.data[i + 3]
        if (a < 128) continue
        let best = palRgb[0], bestD = Infinity
        for (const c of palRgb) {
          const d = (r - c.r) ** 2 + (g - c.g) ** 2 + (b - c.b) ** 2
          if (d < bestD) { bestD = d; best = c }
        }
        ctx.fillStyle = best.hex
        ctx.fillRect(x * SCALE, y * SCALE, SCALE - 1, SCALE - 1)
      }
    }
  }

  function scheduleL2() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!noBgUrl) return
      setL2Loading(true)
      try {
        const resp = await fetch(`${API_URL}/api/preview`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: noBgUrl, resolution, ...getFilamentPayload() }),
        })
        if (!resp.ok) return
        const data = await resp.json()
        setL2Preview(data.preview)
        setL2Grid(data.pixel_grid)
        setL2Dims(data.dimensions)
        setL2Colors(data.color_summary)
        setL2Studs(data.total_studs)
      } catch { /* silent */ } finally {
        setL2Loading(false)
      }
    }, 500)
  }

  // Load noBg image and kick off L1 + L2 when entering pixelize step
  useEffect(() => {
    if (step !== 'pixelize' || !noBgUrl) return
    setL2Preview(null); setL2Grid(null); setL2Dims(null); setL2Colors(null); setL2Studs(0)
    const img = new Image()
    img.onload = () => { noBgImgRef.current = img; doInstantPreview(); scheduleL2() }
    img.src = noBgUrl
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [step, noBgUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh preview when mosaic settings change
  useEffect(() => {
    if (step !== 'pixelize' || !noBgImgRef.current) return
    setL2Preview(null)
    doInstantPreview()
    scheduleL2()
  }, [resolution, depthLayers, usePlaBasic, usePlaMatte, customIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Common ─────────────────────────────────────────────────────────────────
  function handleFile(file: File) {
    setOriginalFile(file); setOriginalUrl(URL.createObjectURL(file))
    setNoBgUrl(null); setMosaicData(null); setModel3dUrl(null)
    setVoxelData(null); setOpt3dResult(null); setError(null)
    setStep('preview')
  }

  async function handleRemoveBg() {
    if (!originalFile) return
    setStep('removing'); setError(null)
    const form = new FormData()
    form.append('file', originalFile)
    try {
      const res = await fetch(`${API_URL}/api/remove-background`, { method: 'POST', body: form })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
      const data = await res.json()
      setNoBgUrl(data.image)
      setStep(mode === '3d' ? 'mesh_preview' : 'pixelize')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStep('preview')
    }
  }

  function handleReset() {
    setStep('upload'); setOriginalFile(null); setOriginalUrl(null)
    setNoBgUrl(null); setMosaicData(null); setModel3dUrl(null)
    setVoxelData(null); setOpt3dResult(null); setError(null)
    setL2Preview(null); setL2Grid(null); setL2Dims(null); setL2Colors(null); setL2Studs(0)
    noBgImgRef.current = null
  }

  // ── Mosaic flow ────────────────────────────────────────────────────────────
  async function handlePixelize() {
    if (!noBgUrl) return
    setStep('pixelizing'); setError(null)
    try {
      let data: MosaicData
      if (l2Grid && l2Preview && l2Dims && l2Colors) {
        // L2 data is fresh — skip repixelization, go straight to result
        data = {
          preview:       l2Preview,
          pixel_grid:    l2Grid,
          dimensions:    l2Dims,
          color_summary: l2Colors,
          total_studs:   l2Studs,
        }
      } else {
        // L2 not ready — full pixelization
        const res = await fetch(`${API_URL}/api/pixelize`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: noBgUrl, resolution, depth_layers: depthLayers, ...getFilamentPayload() }),
        })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
        data = await res.json()
      }
      setMosaicData(data); setStep('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error'); setStep('pixelize')
    }
  }

  // ── 3D flow ────────────────────────────────────────────────────────────────
  async function handleReconstruct() {
    if (!noBgUrl) return
    setStep('reconstructing'); setError(null)
    try {
      // Convert data URL → Blob → File for upload
      const blob = await (await fetch(noBgUrl)).blob()
      const form = new FormData()
      form.append('file', blob, 'nobg.png')
      const res = await fetch(`${API_URL}/api/3d/reconstruct`, { method: 'POST', body: form })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
      const data = await res.json()
      setModel3dUrl(data.model)
      setStep('voxelizing')        // auto-advance to voxelization picker
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '3D reconstruction failed — TripoSR may be unavailable')
      setStep('mesh_preview')
    }
  }

  async function handleVoxelize() {
    if (!model3dUrl) return
    setStep('voxelizing'); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/3d/voxelize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model3dUrl, resolution: resolution3d, ...getFilamentPayload() }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
      const data: VoxelData = await res.json()
      setVoxelData(data)
      // Auto-optimize
      await handle3DOptimize(data.voxel_grid)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Voxelization failed')
      setStep('mesh_preview')
    }
  }

  async function handle3DOptimize(grid?: (string | null)[][][]) {
    const vg = grid ?? voxelData?.voxel_grid
    if (!vg) return
    setStep('optimizing3d'); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/3d/optimize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voxel_grid: vg, hollow }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
      setOpt3dResult(await res.json())
      setStep('result3d')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '3D optimization failed')
      setStep('mesh_preview')
    }
  }

  // ── Download helpers ───────────────────────────────────────────────────────
  async function downloadLDraw() {
    if (!opt3dResult) return
    const res = await fetch(`${API_URL}/api/export/ldraw`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bricks: opt3dResult.bricks }),
    })
    if (!res.ok) { alert('LDraw export failed'); return }
    const blob = await res.blob()
    _dl(blob, 'demibrick_model.ldr')
  }

  async function download3DSTL() {
    if (!opt3dResult) return
    const res = await fetch(`${API_URL}/api/export/stl-full`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bom: opt3dResult.bom }),
    })
    if (!res.ok) { alert('STL export failed'); return }
    _dl(await res.blob(), 'demibrick_3d_parts.zip')
  }

  async function download3DCSV() {
    if (!opt3dResult) return
    const res = await fetch(`${API_URL}/api/export/bom-csv`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bom: opt3dResult.bom }),
    })
    if (!res.ok) { alert('CSV export failed'); return }
    _dl(await res.blob(), 'demibrick_3d_parts.csv')
  }

  async function downloadCalibration() {
    const res = await fetch(`${API_URL}/api/calibration-strip`)
    if (!res.ok) { alert('Failed'); return }
    _dl(await res.blob(), 'calibration_strip.stl')
  }

  function _dl(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  const isLoading = ['removing','pixelizing','reconstructing','voxelizing','optimizing3d'].includes(step)

  // ── Step labels ────────────────────────────────────────────────────────────
  const mosaicStepLabels = ['Upload', 'Remove BG', 'Filament & Res', 'Export']
  const _3dStepLabels    = ['Upload', 'Remove BG', 'Reconstruct 3D', 'Brickify', 'Export']

  const stepLabels = mode === 'mosaic' ? mosaicStepLabels : _3dStepLabels
  const mosaicStepOrder: Step[] = ['upload','preview','pixelize','result']
  const _3dStepOrder: Step[]    = ['upload','preview','mesh_preview','voxelizing','result3d']

  const stepOrder = mode === 'mosaic' ? mosaicStepOrder : _3dStepOrder
  const curIdx = stepOrder.indexOf(
    step === 'removing' ? 'preview'
    : step === 'pixelizing' ? 'pixelize'
    : step === 'reconstructing' ? 'mesh_preview'
    : step === 'optimizing3d' ? 'voxelizing'
    : step
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-[#1A1A2E]">
          {mode === 'mosaic'
            ? <>Create Your <span className="text-[#FFD700]">3D Print Mosaic</span></>
            : <>Turn Photo into <span className="text-[#FFD700]">3D Brick Model</span></>
          }
        </h1>

        {/* Mode selector */}
        {step === 'upload' && (
          <div className="mt-5 inline-flex gap-1 bg-gray-100 rounded-xl p-1">
            {([['mosaic','🧱 Mosaic','Flat pixel mosaic'],['3d','🏗️ 3D Model','Full 3D brick sculpture']] as const).map(([m, label, sub]) => (
              <button key={m} onClick={() => setMode(m as AppMode)}
                className={`px-5 py-2.5 rounded-lg transition-all ${mode === m ? 'bg-white shadow text-[#1A1A2E]' : 'text-gray-400 hover:text-gray-600'}`}>
                <div className="font-bold text-sm">{label}</div>
                <div className="text-xs opacity-70">{sub}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step breadcrumb */}
        <div className="flex items-center justify-center gap-1 mt-4 flex-wrap text-xs font-semibold">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              <span className={`px-2.5 py-1 rounded-full ${curIdx > i ? 'bg-[#1A1A2E] text-white' : curIdx === i ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}. {label}
              </span>
              {i < stepLabels.length - 1 && <span className="text-gray-300">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 space-y-2">
          <div className="flex justify-between items-start">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="underline text-red-400 ml-4 flex-shrink-0">✕</button>
          </div>
          {mode === '3d' && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setError(null); setStep('mesh_preview') }}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 font-semibold">
                ↺ Retry 3D
              </button>
              <button onClick={() => { setMode('mosaic'); setError(null); setStep(noBgUrl ? 'pixelize' : 'preview') }}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 font-semibold">
                🧱 Switch to Mosaic instead
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── UPLOAD ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <ImageDropzone onFile={handleFile} />
          {mode === '3d' && (
            <div className="text-xs text-center bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1">
              <div className="flex items-center justify-center gap-2">
                {triposrStatus === 'checking' && <><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />Checking TripoSR availability…</>}
                {triposrStatus === 'ok'       && <><span className="w-2 h-2 rounded-full bg-green-400" />TripoSR is available — ready to reconstruct</>}
                {triposrStatus === 'warn'     && <><span className="w-2 h-2 rounded-full bg-red-400" />TripoSR may be busy — queued spaces will be tried</>}
                {triposrStatus === 'unknown'  && <><span className="w-2 h-2 rounded-full bg-gray-300" />3D mode: TripoSR on HuggingFace</>}
              </div>
              <p className="text-gray-400">Reconstruction takes 30–90 sec. Best with isolated objects on clean BG.</p>
            </div>
          )}
        </div>
      )}

      {/* ── PREVIEW / REMOVING ── */}
      {(step === 'preview' || step === 'removing') && originalUrl && (
        <div className="space-y-6">
          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 300 }}>
            <img src={originalUrl} alt="Original" className="max-h-72 max-w-full object-contain" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleReset} disabled={isLoading}
              className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 disabled:opacity-40">
              ← Choose another
            </button>
            <button onClick={handleRemoveBg} disabled={isLoading}
              className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 disabled:opacity-50">
              {step === 'removing' ? <Spinner label="Removing background…" /> : 'Remove Background →'}
            </button>
          </div>
        </div>
      )}

      {/* ── MOSAIC: PIXELIZE CONFIG ── */}
      {mode === 'mosaic' && (step === 'pixelize' || step === 'pixelizing') && noBgUrl && (
        <MosaicConfigStep
          originalUrl={originalUrl!} noBgUrl={noBgUrl}
          resolution={resolution} onResolution={setResolution}
          depthLayers={depthLayers} onDepthLayers={setDepthLayers}
          usePlaBasic={usePlaBasic} setUsePlaBasic={setUsePlaBasic}
          usePlaMatte={usePlaMatte} setUsePlaMatte={setUsePlaMatte}
          showColorPicker={showColorPicker} setShowColorPicker={setShowColorPicker}
          customIds={customIds} setCustomIds={setCustomIds}
          visibleColors={visibleColors} toggleCustomId={toggleCustomId}
          isLoading={isLoading}
          onBack={() => setStep('preview')}
          onGo={handlePixelize}
          goLabel={step === 'pixelizing'
            ? <Spinner label={l2Grid ? 'Optimizing…' : 'Pixelizing…'} />
            : (l2Grid ? 'Generate Final ✓' : 'Generate Mosaic →')}
          resolutions={RESOLUTIONS_MOSAIC}
          canvasRef={canvasRef}
          l2Preview={l2Preview}
          l2Loading={l2Loading}
          l2Studs={l2Studs}
        />
      )}

      {/* ── MOSAIC: RESULT ── */}
      {step === 'result' && mosaicData && (
        <MosaicResult mosaicData={mosaicData} onBack={() => setStep('pixelize')} onReset={handleReset} />
      )}

      {/* ── 3D: MESH PREVIEW ── */}
      {mode === '3d' && step === 'mesh_preview' && noBgUrl && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Original</p>
              <div className="rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 200 }}>
                <img src={originalUrl!} alt="Original" className="max-h-48 max-w-full object-contain" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest text-center">No Background</p>
              <div className="rounded-xl border border-gray-100 flex items-center justify-center"
                style={{ minHeight: 200, backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)', backgroundSize: '16px 16px' }}>
                <img src={noBgUrl} alt="No BG" className="max-h-48 max-w-full object-contain" />
              </div>
            </div>
          </div>

          {/* Filament + resolution for 3D */}
          <FilamentPicker
            usePlaBasic={usePlaBasic} setUsePlaBasic={setUsePlaBasic}
            usePlaMatte={usePlaMatte} setUsePlaMatte={setUsePlaMatte}
            showColorPicker={showColorPicker} setShowColorPicker={setShowColorPicker}
            customIds={customIds} setCustomIds={setCustomIds}
            visibleColors={visibleColors} toggleCustomId={toggleCustomId}
          />

          {/* 3D resolution */}
          <div>
            <p className="text-sm font-bold text-[#1A1A2E] mb-3">Voxel Resolution</p>
            <div className="grid grid-cols-4 gap-2">
              {RESOLUTIONS_3D.map(({ value, label, desc }) => (
                <button key={value} onClick={() => setResolution3d(value)}
                  className={`py-3 rounded-xl border-2 text-center transition-all ${resolution3d === value ? 'border-[#FFD700] bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}>
                  <div className="font-black text-lg text-[#1A1A2E]">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Hollow option */}
          <label className="flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300">
            <input type="checkbox" checked={hollow} onChange={e => setHollow(e.target.checked)} className="accent-[#FFD700] w-4 h-4" />
            <div>
              <div className="text-sm font-bold text-[#1A1A2E]">Hollow interior</div>
              <div className="text-xs text-gray-400">Save filament — removes interior bricks (good for large models)</div>
            </div>
          </label>

          <div className="flex gap-3">
            <button onClick={() => setStep('preview')} disabled={isLoading}
              className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 disabled:opacity-40">
              ← Back
            </button>
            <button onClick={handleReconstruct} disabled={isLoading}
              className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 disabled:opacity-50">
              Reconstruct 3D →
            </button>
          </div>
        </div>
      )}

      {/* ── 3D: RECONSTRUCTING / VOXELIZING / OPTIMIZING ── */}
      {mode === '3d' && ['reconstructing', 'voxelizing', 'optimizing3d'].includes(step) && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 flex flex-col items-center gap-5">
            <div className="relative w-16 h-16">
              <svg className="animate-spin w-16 h-16 text-[#FFD700]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl">
                {step === 'reconstructing' ? '🔮' : step === 'voxelizing' ? '🧊' : '🧱'}
              </span>
            </div>
            <div className="text-center">
              <p className="font-black text-[#1A1A2E] text-lg">
                {step === 'reconstructing' ? 'Reconstructing 3D model…'
                  : step === 'voxelizing' ? 'Voxelizing mesh…'
                  : 'Placing bricks…'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {step === 'reconstructing' ? 'TripoSR is running on HuggingFace GPU (30–90 sec)' : 'Almost there!'}
              </p>
            </div>
            {/* Fun fact ticker */}
            <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500 text-center max-w-sm animate-pulse-slow">
              💡 {FUN_FACTS[factIdx]}
            </div>
          </div>
        </div>
      )}

      {/* ── 3D: RESULT ── */}
      {step === 'result3d' && opt3dResult && voxelData && (
        <Result3D
          opt={opt3dResult} voxel={voxelData}
          onBack={() => setStep('mesh_preview')} onReset={handleReset}
          onDownloadLDraw={downloadLDraw}
          onDownload3DSTL={download3DSTL}
          onDownloadCSV={download3DCSV}
          onDownloadCalibration={downloadCalibration}
        />
      )}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function FilamentPicker({
  usePlaBasic, setUsePlaBasic, usePlaMatte, setUsePlaMatte,
  showColorPicker, setShowColorPicker, customIds, setCustomIds,
  visibleColors, toggleCustomId,
}: any) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-sm font-bold text-[#1A1A2E]">Your Filament</p>
      <div className="flex gap-3 flex-wrap">
        {[{ label: 'PLA Basic (30)', key: 'basic', checked: usePlaBasic, set: setUsePlaBasic },
          { label: 'PLA Matte (25)', key: 'matte', checked: usePlaMatte, set: setUsePlaMatte }]
          .map(({ label, key, checked, set }) => (
            <label key={key} className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-[#FFD700] bg-yellow-50' : 'border-gray-200'}`}>
              <input type="checkbox" checked={checked} onChange={e => { set(e.target.checked); setCustomIds(null) }} className="accent-[#FFD700]" />
              <span className="text-sm font-semibold text-[#1A1A2E]">{label}</span>
            </label>
          ))}
      </div>
      <button onClick={() => setShowColorPicker((v: boolean) => !v)}
        className="text-xs text-gray-400 hover:text-[#1A1A2E] underline">
        {showColorPicker ? '▲ Hide' : '▼ Pick specific colors'}
      </button>
      {showColorPicker && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button onClick={() => setCustomIds(visibleColors.map((c: any) => c.id))} className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400">All</button>
            <button onClick={() => setCustomIds([])} className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400">None</button>
            {customIds !== null && <button onClick={() => setCustomIds(null)} className="text-xs px-3 py-1 rounded-lg border border-[#FFD700] bg-yellow-50">Reset</button>}
          </div>
          <div className="grid grid-cols-10 gap-1">
            {visibleColors.map((c: any) => {
              const active = customIds === null || customIds.includes(c.id)
              return (
                <button key={c.id} title={`${c.name} (${c.type})`} onClick={() => toggleCustomId(c.id)}
                  className={`relative w-8 h-8 rounded border-2 transition-all ${active ? 'border-[#1A1A2E] opacity-100' : 'border-gray-200 opacity-30'}`}
                  style={{ backgroundColor: c.hex }}>
                  {active && <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-black" style={{ textShadow: '0 0 2px #000' }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

const DEPTH_OPTIONS = [
  { value: 1, label: 'Flat',  desc: 'Standard mosaic' },
  { value: 2, label: '2',     desc: '2 layers' },
  { value: 3, label: '3',     desc: '3 layers' },
  { value: 4, label: '4',     desc: '4 layers' },
  { value: 5, label: '5',     desc: '5 layers' },
]

function MosaicConfigStep({
  originalUrl, noBgUrl, resolution, onResolution, resolutions,
  depthLayers, onDepthLayers,
  usePlaBasic, setUsePlaBasic, usePlaMatte, setUsePlaMatte,
  showColorPicker, setShowColorPicker, customIds, setCustomIds,
  visibleColors, toggleCustomId, isLoading, onBack, onGo, goLabel,
  canvasRef, l2Preview, l2Loading, l2Studs,
}: any) {
  return (
    <div className="space-y-6">
      {/* Source images (compact) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Original</p>
          <div className="rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 120 }}>
            <img src={originalUrl} alt="Original" className="max-h-28 max-w-full object-contain" />
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest text-center">No Background</p>
          <div className="rounded-xl border border-gray-100 flex items-center justify-center"
            style={{ minHeight: 120, backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)', backgroundSize: '16px 16px' }}>
            <img src={noBgUrl} alt="No BG" className="max-h-28 max-w-full object-contain" />
          </div>
        </div>
      </div>

      {/* Live preview panel (L1 canvas → L2 quality image) */}
      <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-gray-50" style={{ minHeight: 180 }}>
        {l2Preview ? (
          <img
            src={l2Preview} alt="Preview"
            className="w-full object-contain"
            style={{ imageRendering: 'pixelated', display: 'block' }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ imageRendering: 'pixelated', display: 'block' }}
          />
        )}
        {l2Loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
            <Spinner label="Computing exact colors…" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between pointer-events-none">
          <span className="text-xs bg-black/40 text-white px-2 py-0.5 rounded-full">
            {l2Preview ? '✓ Exact Bambu colors' : '⚡ Quick preview — colors approximate'}
          </span>
          {l2Studs > 0 && (
            <span className="text-xs bg-black/40 text-white px-2 py-0.5 rounded-full">
              ~{l2Studs.toLocaleString()} studs
            </span>
          )}
        </div>
      </div>

      <FilamentPicker
        usePlaBasic={usePlaBasic} setUsePlaBasic={setUsePlaBasic}
        usePlaMatte={usePlaMatte} setUsePlaMatte={setUsePlaMatte}
        showColorPicker={showColorPicker} setShowColorPicker={setShowColorPicker}
        customIds={customIds} setCustomIds={setCustomIds}
        visibleColors={visibleColors} toggleCustomId={toggleCustomId}
      />

      <div>
        <p className="text-sm font-bold text-[#1A1A2E] mb-3">Choose Resolution</p>
        <div className="grid grid-cols-4 gap-2">
          {resolutions.map(({ value, label, desc }: any) => (
            <button key={value} onClick={() => onResolution(value)}
              className={`py-3 rounded-xl border-2 text-center transition-all ${resolution === value ? 'border-[#FFD700] bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}>
              <div className="font-black text-lg text-[#1A1A2E]">{label}</div>
              <div className="text-xs text-gray-400">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Relief depth */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold text-[#1A1A2E]">Relief Depth</p>
          {depthLayers > 1 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-semibold">2.5D</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-3">
          {depthLayers === 1
            ? 'Flat — standard single-layer mosaic'
            : `${depthLayers} layers — depth estimated from image, foreground raised`}
        </p>
        <div className="grid grid-cols-5 gap-2">
          {DEPTH_OPTIONS.map(({ value, label, desc }) => (
            <button key={value} onClick={() => onDepthLayers(value)}
              className={`py-3 rounded-xl border-2 text-center transition-all ${depthLayers === value ? 'border-[#FFD700] bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}>
              <div className="font-black text-lg text-[#1A1A2E]">{label}</div>
              <div className="text-xs text-gray-400">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} disabled={isLoading}
          className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 disabled:opacity-40">
          ← Back
        </button>
        <button onClick={onGo} disabled={isLoading || (!usePlaBasic && !usePlaMatte && !customIds?.length)}
          className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 disabled:opacity-50">
          {goLabel}
        </button>
      </div>
    </div>
  )
}

// ── 3D Result ─────────────────────────────────────────────────────────────────
function Result3D({ opt, voxel, onBack, onReset, onDownloadLDraw, onDownload3DSTL, onDownloadCSV, onDownloadCalibration }: {
  opt: Optimize3DResult; voxel: VoxelData
  onBack: () => void; onReset: () => void
  onDownloadLDraw: () => void; onDownload3DSTL: () => void
  onDownloadCSV: () => void; onDownloadCalibration: () => void
}) {
  const [tab, setTab] = useState<'3d'|'bom'>('3d')

  const bricks3d = opt.bricks.map(b => ({
    x: b.x, y: b.y, z_floor: b.z_floor, w: b.w, d: b.d, h: b.h,
    color_hex: b.color_hex || '#888888', color_id: b.color_id,
    color_name: b.color_name, part: b.part, name: b.name,
    filament_type: b.filament_type, layer: b.layer,
  }))

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {([['3d','🔮 3D View'],['bom','📋 Parts (BOM)']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === k ? 'bg-white shadow text-[#1A1A2E]' : 'text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Voxels"  value={opt.total_voxels.toLocaleString()} />
        <StatCard label="Bricks"  value={opt.total_bricks.toLocaleString()} sub={`${opt.optimization_ratio}× opt`} />
        <StatCard label="Colors"  value={voxel.color_summary.length} />
        <StatCard label="Stable"  value={`${Math.round(opt.stability * 100)}%`} />
      </div>

      {/* 3D View */}
      {tab === '3d' && (
        <Suspense fallback={<div className="h-64 flex items-center justify-center text-gray-400">Loading 3D…</div>}>
          <BrickModel3D
            bricks={bricks3d}
            gridW={voxel.dimensions.w}
            gridD={voxel.dimensions.d}
            gridH={voxel.dimensions.h}
          />
        </Suspense>
      )}

      {/* BOM */}
      {tab === 'bom' && (
        <div className="space-y-3">
          {/* Shopping list */}
          <div className="rounded-xl border border-gray-100 p-4 space-y-2">
            <p className="text-sm font-bold text-[#1A1A2E]">You need these Bambu Lab spools:</p>
            {voxel.color_summary.map((c, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: c.hex }} />
                <span className="flex-1 text-[#1A1A2E]">{c.name} <span className="text-gray-400 text-xs">({c.filament_type})</span></span>
                <span className="text-gray-500">{c.count.toLocaleString()} voxels</span>
              </div>
            ))}
          </div>

          {/* BOM table */}
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-3 py-2 text-left">Color</th>
                  <th className="px-3 py-2 text-left">Part</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                </tr>
              </thead>
              <tbody>
                {opt.bom.map((b, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <span className="inline-block w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: b.color_hex || b.hex }} />
                    </td>
                    <td className="px-3 py-1.5 text-gray-400 font-mono text-xs">{b.part}</td>
                    <td className="px-3 py-1.5 text-[#1A1A2E] font-medium">
                      {b.name} <span className="text-gray-400 font-normal">— {b.color_name}</span>
                      <span className="ml-1 text-xs text-gray-300">Bambu {b.filament_type}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-bold text-[#1A1A2E]">{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div className="grid grid-cols-2 gap-2">
        <ExportBtn label="📐 LDraw (.ldr)" onClick={onDownloadLDraw} />
        <ExportBtn label="🖨️ STL Parts ZIP" onClick={onDownload3DSTL} />
        <ExportBtn label="📊 Parts CSV" onClick={onDownloadCSV} />
        <ExportBtn label="📏 Calibration STL" onClick={onDownloadCalibration} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400">← Settings</button>
        <button onClick={onReset} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400">↺ New photo</button>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
      <div className="text-xl font-black text-[#1A1A2E]">{value}</div>
      {sub && <div className="text-xs text-[#FFD700] font-bold">{sub}</div>}
      <div className="text-xs text-gray-400 mt-0.5 uppercase tracking-widest">{label}</div>
    </div>
  )
}

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={async () => { setLoading(true); await onClick(); setLoading(false) }}
      disabled={loading}
      className="py-3 px-3 rounded-xl border-2 border-gray-200 text-xs font-bold text-[#1A1A2E] hover:border-[#FFD700] hover:bg-yellow-50 transition-all disabled:opacity-50 text-center">
      {loading ? '…' : label}
    </button>
  )
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      {label}
    </span>
  )
}
