'use client'

import { useRef, useState, useEffect } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const HISTORY_LIMIT = 50

type Tool = 'paint' | 'eyedrop' | 'eraser' | 'fill'

interface PaletteColor {
  id: string; name: string; hex: string; type: string
}

interface BomEntry {
  part: string; name: string; color_id: string; color_name: string
  filament_type: string; hex: string; count: number
}

interface OptimizeResult {
  bricks: object[]
  bom: BomEntry[]
  total_bricks: number
  total_1x1_equivalent: number
  optimization_ratio: number
}

interface BrickEditorProps {
  pixelGrid:     (number | null)[][]
  dimensions:    { w: number; h: number }
  activePalette: PaletteColor[]
  onApply: (opt: OptimizeResult) => void
  onBack:  () => void
  onSkip:  () => void
}

const TOOL_DEFS: { id: Tool; icon: string; key: string; label: string }[] = [
  { id: 'paint',   icon: '🖌',  key: 'P', label: 'Paint'   },
  { id: 'eyedrop', icon: '💧',  key: 'I', label: 'Eyedrop' },
  { id: 'eraser',  icon: '⬜',  key: 'E', label: 'Erase'   },
  { id: 'fill',    icon: '🪣',  key: 'G', label: 'Fill'    },
]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

export default function BrickEditor({ pixelGrid, dimensions, activePalette, onApply, onBack, onSkip }: BrickEditorProps) {
  const { w, h } = dimensions
  const stud = Math.max(4, Math.min(16, Math.floor(480 / Math.max(w, h, 1))))

  const gridRef    = useRef<(number | null)[][]>(pixelGrid.map(r => [...r]))
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<(number | null)[][][]>([])
  const redoRef    = useRef<(number | null)[][][]>([])
  const dragging   = useRef(false)

  const [tool,        setTool]        = useState<Tool>('paint')
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const [applying,    setApplying]    = useState(false)
  const [tick,        setTick]        = useState(0)   // triggers BOM re-render

  // ── Canvas draw ─────────────────────────────────────────────────────────────

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width  = w * stud
    canvas.height = h * stud
    const grid = gridRef.current

    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const x   = col * stud
        const y   = row * stud
        const idx = grid[row]?.[col] ?? null

        if (idx === null) {
          ctx.fillStyle = ((col + row) % 2 === 0) ? '#bbbbbb' : '#ffffff'
          ctx.fillRect(x, y, stud, stud)
          continue
        }

        const color = activePalette[idx]
        if (!color) continue
        ctx.fillStyle = color.hex
        ctx.fillRect(x, y, stud, stud)

        if (stud >= 6) {
          ctx.strokeStyle = 'rgba(0,0,0,0.1)'
          ctx.lineWidth   = 0.5
          ctx.strokeRect(x + 0.25, y + 0.25, stud - 0.5, stud - 0.5)
        }

        if (stud >= 10) {
          const [r, g, b] = hexToRgb(color.hex)
          const cx = x + stud / 2, cy = y + stud / 2, pr = stud * 0.22
          ctx.beginPath()
          ctx.arc(cx, cy, pr, 0, Math.PI * 2)
          ctx.fillStyle   = `rgb(${Math.min(255,r+40)},${Math.min(255,g+40)},${Math.min(255,b+40)})`
          ctx.fill()
          ctx.strokeStyle = `rgb(${Math.max(0,r-30)},${Math.max(0,g-30)},${Math.max(0,b-30)})`
          ctx.lineWidth   = 0.5
          ctx.stroke()
        }
      }
    }
  }

  useEffect(() => { redraw() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── History ──────────────────────────────────────────────────────────────────

  function pushHistory() {
    historyRef.current.push(gridRef.current.map(r => [...r]))
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift()
    redoRef.current = []
  }

  function undo() {
    const snap = historyRef.current.pop()
    if (!snap) return
    redoRef.current.push(gridRef.current.map(r => [...r]))
    gridRef.current = snap
    redraw(); setTick(t => t + 1)
  }

  function redo() {
    const snap = redoRef.current.pop()
    if (!snap) return
    historyRef.current.push(gridRef.current.map(r => [...r]))
    gridRef.current = snap
    redraw(); setTick(t => t + 1)
  }

  // ── Flood fill ───────────────────────────────────────────────────────────────

  function floodFill(startRow: number, startCol: number, newIdx: number | null) {
    const grid = gridRef.current
    const targetIdx = grid[startRow]?.[startCol] ?? null
    if (targetIdx === newIdx) return
    const stack: [number, number][] = [[startRow, startCol]]
    const seen = new Set<number>()
    while (stack.length) {
      const [r, c] = stack.pop()!
      if (r < 0 || r >= h || c < 0 || c >= w) continue
      const key = r * w + c
      if (seen.has(key) || (grid[r]?.[c] ?? null) !== targetIdx) continue
      seen.add(key)
      grid[r][c] = newIdx
      stack.push([r-1, c], [r+1, c], [r, c-1], [r, c+1])
    }
  }

  // ── Mouse events ─────────────────────────────────────────────────────────────

  function getCell(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (w * stud) / rect.width
    const y = (e.clientY - rect.top)  * (h * stud) / rect.height
    return [Math.floor(y / stud), Math.floor(x / stud)]
  }

  function applyAt(row: number, col: number, firstClick: boolean) {
    if (row < 0 || row >= h || col < 0 || col >= w) return
    const grid = gridRef.current

    if (tool === 'paint') {
      if (grid[row][col] === selectedIdx) return
      grid[row][col] = selectedIdx
      redraw(); setTick(t => t + 1)
    } else if (tool === 'eraser') {
      if (grid[row][col] === null) return
      grid[row][col] = null
      redraw(); setTick(t => t + 1)
    } else if (tool === 'eyedrop' && firstClick) {
      const idx = grid[row]?.[col] ?? null
      if (idx !== null) { setSelectedIdx(idx); setTool('paint') }
    } else if (tool === 'fill' && firstClick) {
      floodFill(row, col, selectedIdx)
      redraw(); setTick(t => t + 1)
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    const [row, col] = getCell(e)
    if (tool === 'paint' || tool === 'eraser' || tool === 'fill') pushHistory()
    dragging.current = true
    applyAt(row, col, true)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragging.current) return
    applyAt(...getCell(e), false)
  }

  function handleMouseUp() { dragging.current = false }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      const k = e.key.toUpperCase()
      if      (k === 'P') setTool('paint')
      else if (k === 'I') setTool('eyedrop')
      else if (k === 'E') setTool('eraser')
      else if (k === 'G') setTool('fill')
      else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && k === 'Z') { e.preventDefault(); undo() }
      else if ((e.ctrlKey || e.metaKey) && (k === 'Y' || (e.shiftKey && k === 'Z'))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // intentionally no deps — always reads fresh undo/redo refs

  // ── Live BOM ─────────────────────────────────────────────────────────────────

  const bom = (() => {
    const counts = new Map<number, number>()
    for (const row of gridRef.current)
      for (const idx of row)
        if (idx !== null) counts.set(idx, (counts.get(idx) ?? 0) + 1)
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([idx, count]) => ({
        idx, count,
        color: activePalette[idx] ?? { id: '?', name: '?', hex: '#888888', type: '' } as PaletteColor,
      }))
  })()

  const totalStuds = bom.reduce((s, e) => s + e.count, 0)

  // ── Apply ─────────────────────────────────────────────────────────────────────

  async function handleApply() {
    setApplying(true)
    try {
      const res = await fetch(`${API_URL}/api/optimize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixel_grid: gridRef.current }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
      onApply(await res.json())
    } catch (e) {
      alert(`Optimization failed: ${e}`)
    } finally {
      setApplying(false)
    }
  }

  const cursorStyle = { paint: 'crosshair', eyedrop: 'cell', eraser: 'not-allowed', fill: 'copy' }[tool]
  void tick // suppress lint warning — tick drives BOM re-render

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-[#1A1A2E]">Edit Mosaic</h2>
        <div className="text-xs text-gray-400">{w}×{h} studs · {totalStuds.toLocaleString()} filled</div>
      </div>

      <div className="flex gap-3 items-start">
        {/* Canvas + toolbar */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {TOOL_DEFS.map(t => (
                <button key={t.id} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${tool === t.id ? 'bg-white shadow font-bold text-[#1A1A2E]' : 'text-gray-400 hover:text-gray-700'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <button onClick={undo} title="Undo (Ctrl+Z)"
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs hover:border-gray-400">↩ Undo</button>
            <button onClick={redo} title="Redo (Ctrl+Y)"
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs hover:border-gray-400">↪ Redo</button>
          </div>

          {/* Canvas */}
          <div className="rounded-xl overflow-auto border border-gray-200 bg-white" style={{ maxHeight: 500 }}>
            <canvas
              ref={canvasRef}
              style={{ cursor: cursorStyle, display: 'block', imageRendering: 'pixelated' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="w-48 flex-shrink-0 flex flex-col gap-3" style={{ maxHeight: 540, overflowY: 'auto' }}>
          {/* Active color */}
          {activePalette[selectedIdx] && (
            <div className="rounded-xl border-2 border-[#FFD700] bg-yellow-50 px-3 py-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded border border-gray-300 flex-shrink-0"
                style={{ backgroundColor: activePalette[selectedIdx].hex }} />
              <div className="text-xs min-w-0">
                <div className="font-bold text-[#1A1A2E] truncate">{activePalette[selectedIdx].name}</div>
                <div className="text-gray-400 truncate">{activePalette[selectedIdx].type}</div>
              </div>
            </div>
          )}

          {/* Palette grid */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Palette</p>
            <div className="grid grid-cols-6 gap-0.5">
              {activePalette.map((c, i) => (
                <button key={c.id} title={`${c.name} (${c.type})`}
                  onClick={() => { setSelectedIdx(i); setTool('paint') }}
                  className={`w-6 h-6 rounded border-2 transition-all ${selectedIdx === i ? 'border-[#FFD700] scale-110 relative z-10' : 'border-transparent hover:border-gray-400'}`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Live BOM */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              Used ({bom.length} colors)
            </p>
            <div className="space-y-0.5">
              {bom.slice(0, 20).map(e => (
                <div key={e.idx}
                  onClick={() => { setSelectedIdx(e.idx); setTool('paint') }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg cursor-pointer transition-all ${selectedIdx === e.idx ? 'bg-yellow-50 ring-1 ring-[#FFD700]' : 'hover:bg-gray-50'}`}>
                  <span className="w-3.5 h-3.5 rounded border border-gray-200 flex-shrink-0"
                    style={{ backgroundColor: e.color.hex }} />
                  <span className="text-xs flex-1 text-[#1A1A2E] truncate">{e.color.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button onClick={onBack}
          className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400">
          ← Back
        </button>
        <button onClick={onSkip}
          className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400">
          Skip →
        </button>
        <button onClick={handleApply} disabled={applying}
          className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 disabled:opacity-50">
          {applying ? '⟳ Optimizing…' : 'Apply & Continue →'}
        </button>
      </div>
    </div>
  )
}
