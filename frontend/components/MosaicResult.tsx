'use client'

import { useState, useEffect, lazy, Suspense } from 'react'

const LegoPreview3D = lazy(() => import('./LegoPreview3D'))

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ColorEntry {
  color_id: string
  name: string
  hex: string
  filament_type: string
  count: number
}

interface BomEntry {
  part: string
  name: string
  color_id: string
  color_name: string
  filament_type: string
  hex: string
  count: number
}

interface OptimizeResult {
  bricks: object[]
  bom: BomEntry[]
  total_bricks: number
  total_1x1_equivalent: number
  optimization_ratio: number
}

export interface MosaicData {
  preview: string
  pixel_grid: (number | null)[][]
  dimensions: { w: number; h: number }
  color_summary: ColorEntry[]
  total_studs: number
  layers?: (number | null)[][][]
  depth_preview?: string
  num_layers?: number
}

interface Props {
  mosaicData: MosaicData
  initialOptResult?: OptimizeResult
  onBack: () => void
  onReset: () => void
}

type Tab = 'preview' | '3d' | 'bom'

export default function MosaicResult({ mosaicData, initialOptResult, onBack, onReset }: Props) {
  const { preview, dimensions, color_summary, total_studs, pixel_grid, depth_preview, num_layers } = mosaicData
  const [tab, setTab]               = useState<Tab>('preview')
  const [optimizing, setOptimizing] = useState(false)
  const [optResult, setOptResult]   = useState<OptimizeResult | null>(initialOptResult ?? null)
  const [optError, setOptError]     = useState<string | null>(null)

  // Auto-trigger optimization on mount only if no pre-computed result
  useEffect(() => {
    if (!initialOptResult) runOptimize()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function runOptimize() {
    setOptimizing(true); setOptError(null)
    try {
      const res = await fetch(`${API_URL}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pixel_grid }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
      setOptResult(await res.json())
    } catch (e: unknown) {
      setOptError(e instanceof Error ? e.message : 'Optimization failed')
    } finally {
      setOptimizing(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['preview', '3d', 'bom'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tab === t ? 'bg-white shadow text-[#1A1A2E]' : 'text-gray-400 hover:text-gray-600'}`}>
            {t === 'preview' ? '🧱 Preview' : t === '3d' ? '🔮 3D View' : '📋 Parts (BOM)'}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div className={`grid gap-2 ${num_layers && num_layers > 1 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        <StatCard label="Studs" value={total_studs.toLocaleString()} />
        <StatCard label="Size" value={`${dimensions.w}×${dimensions.h}`} />
        <StatCard label="Colors" value={color_summary.length} />
        {num_layers && num_layers > 1 && (
          <StatCard label="Layers" value={num_layers} sub="2.5D relief" />
        )}
        <StatCard
          label="Bricks"
          value={optimizing ? '…' : optResult ? optResult.total_bricks.toLocaleString() : '—'}
          sub={optResult ? `${optResult.optimization_ratio}× opt` : undefined}
        />
      </div>

      {/* Tab: Preview */}
      {tab === 'preview' && (
        <div className="space-y-4">
          {depth_preview ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Mosaic</p>
                <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 200 }}>
                  <img src={preview} alt="LEGO mosaic" className="max-h-64 max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest text-center">Depth map</p>
                <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 200 }}>
                  <img src={depth_preview} alt="Depth map" className="max-h-64 max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 260 }}>
              <img src={preview} alt="LEGO mosaic" className="max-h-96 max-w-full object-contain" style={{ imageRendering: 'pixelated' }} />
            </div>
          )}
          {/* Color breakdown */}
          <div>
            <p className="text-sm font-bold text-[#1A1A2E] mb-2">Color Breakdown</p>
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-3 py-2 text-left">Color</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-right">Studs</th>
                    <th className="px-3 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {color_summary.map((c) => (
                    <tr key={c.color_id} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-1.5">
                        <span className="inline-block w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: c.hex }} />
                      </td>
                      <td className="px-3 py-1.5 font-medium text-[#1A1A2E]">
                        {c.name}
                        <span className="ml-1 text-xs text-gray-400 font-normal">Bambu {c.filament_type}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{c.count}</td>
                      <td className="px-3 py-1.5 text-right text-gray-400">{((c.count / total_studs) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: 3D */}
      {tab === '3d' && optResult && (
        <Suspense fallback={<div className="h-64 flex items-center justify-center text-gray-400">Loading 3D…</div>}>
          <LegoPreview3D
            bricks={optResult.bricks.map((b: any) => ({
              x: b.x, y: b.y, w: b.w, h: b.h,
              hex: b.hex, layer: b.layer ?? 0,
            }))}
            gridW={dimensions.w}
            gridH={dimensions.h}
          />
        </Suspense>
      )}
      {tab === '3d' && !optResult && (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          {optimizing ? 'Optimizing bricks first…' : 'Run optimization to enable 3D view'}
        </div>
      )}

      {/* Tab: BOM */}
      {tab === 'bom' && (
        <div className="space-y-3">
          {optimizing && (
            <div className="flex items-center gap-3 py-8 justify-center text-gray-400">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Optimizing brick layout…
            </div>
          )}
          {optError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {optError}
              <button onClick={runOptimize} className="ml-3 underline">Retry</button>
            </div>
          )}
          {optResult && !optimizing && (
            <>
              <div className="bg-[#1A1A2E] text-white rounded-xl px-4 py-3 text-sm font-medium">
                🧱 {optResult.total_bricks.toLocaleString()} bricks instead of {optResult.total_1x1_equivalent.toLocaleString()} 1×1s
                &nbsp;·&nbsp;
                <span className="text-[#FFD700] font-black">{optResult.optimization_ratio}× optimization</span>
              </div>

              {/* Shopping list */}
              <ShoppingList colorSummary={color_summary} />
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
                    {optResult.bom.map((b, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-1.5">
                          <span className="inline-block w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: b.hex }} />
                        </td>
                        <td className="px-3 py-1.5 text-gray-400 font-mono text-xs">{b.part}</td>
                        <td className="px-3 py-1.5 text-[#1A1A2E] font-medium">
                          {b.name}
                          <span className="text-gray-400 font-normal"> — {b.color_name}</span>
                          <span className="ml-1 text-xs text-gray-300">Bambu {b.filament_type}</span>
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-[#1A1A2E]">{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Export buttons */}
      {optResult && (
        <div className="grid grid-cols-3 gap-2">
          <ExportButton
            label="📄 Instructions PDF"
            onClick={() => downloadPDF(optResult, dimensions, total_studs)}
          />
          <ExportButton
            label="🖨️ STL for 3D Print"
            onClick={() => downloadSTL(optResult.bom)}
          />
          <ExportButton
            label="📊 Parts List CSV"
            onClick={() => downloadCSV(optResult.bom)}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button onClick={onBack} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400">
          ← Resolution
        </button>
        <button onClick={onReset} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400">
          ↺ New photo
        </button>
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

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={async () => { setLoading(true); await onClick(); setLoading(false) }}
      disabled={loading}
      className="py-3 px-3 rounded-xl border-2 border-gray-200 text-xs font-bold text-[#1A1A2E] hover:border-[#FFD700] hover:bg-yellow-50 transition-all disabled:opacity-50 text-center"
    >
      {loading ? '…' : label}
    </button>
  )
}

async function downloadPDF(
  optResult: OptimizeResult,
  dimensions: { w: number; h: number },
  total_studs: number,
) {
  const res = await fetch(`${API_URL}/api/instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bom: optResult.bom,
      dimensions,
      total_studs,
      total_bricks: optResult.total_bricks,
      optimization_ratio: optResult.optimization_ratio,
    }),
  })
  if (!res.ok) { alert('PDF generation failed'); return }
  const blob = await res.blob()
  _triggerDownload(blob, 'demibrick_instructions.pdf')
}

async function downloadSTL(bom: BomEntry[]) {
  const res = await fetch(`${API_URL}/api/stl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bom }),
  })
  if (!res.ok) { alert('STL generation failed'); return }
  const blob = await res.blob()
  _triggerDownload(blob, 'demibrick_stl.zip')
}

function downloadCSV(bom: BomEntry[]) {
  const header = 'Color ID,Color Name,Filament Type,Hex Code,Brick Type,Quantity\n'
  const rows = bom.map(b =>
    `${b.color_id},"${b.color_name}","Bambu ${b.filament_type}",${b.hex},"${b.name}",${b.count}`
  ).join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  _triggerDownload(blob, 'demibrick_parts.csv')
}

function ShoppingList({ colorSummary }: { colorSummary: ColorEntry[] }) {
  const spools = colorSummary.reduce<Record<string, { name: string; type: string; hex: string; bricks: number }>>((acc, c) => {
    const key = c.color_id
    if (!acc[key]) acc[key] = { name: c.name, type: c.filament_type, hex: c.hex, bricks: 0 }
    acc[key].bricks += c.count
    return acc
  }, {})
  const list = Object.values(spools).sort((a, b) => b.bricks - a.bricks)
  return (
    <div className="rounded-xl border border-gray-100 p-4 space-y-2">
      <p className="text-sm font-bold text-[#1A1A2E]">You need these Bambu Lab spools:</p>
      {list.map((s, i) => (
        <div key={i} className="flex items-center gap-3 text-sm">
          <span className="w-4 h-4 rounded border border-gray-200 flex-shrink-0" style={{ backgroundColor: s.hex }} />
          <span className="flex-1 text-[#1A1A2E]">
            {s.name}
            <span className="text-gray-400 font-normal ml-1">({s.type})</span>
          </span>
          <span className="text-gray-500">{s.bricks.toLocaleString()} bricks</span>
        </div>
      ))}
      <p className="text-xs text-gray-400 pt-1 border-t border-gray-100">
        Total: {list.length} spool{list.length !== 1 ? 's' : ''} needed
      </p>
    </div>
  )
}

function _triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
