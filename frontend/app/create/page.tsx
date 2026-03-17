'use client'

import { useState } from 'react'
import ImageDropzone from '@/components/ImageDropzone'
import MosaicResult from '@/components/MosaicResult'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Step = 'upload' | 'preview' | 'removing' | 'pixelize' | 'pixelizing' | 'result'

const RESOLUTIONS = [
  { value: 16, label: '16×', desc: 'Simple' },
  { value: 32, label: '32×', desc: 'Balanced' },
  { value: 48, label: '48×', desc: 'Detailed' },
  { value: 64, label: '64×', desc: 'Max detail' },
]

const BAMBU_COLORS = [
  { id: 'basic-01', name: 'Jade White',      hex: '#FFFFFF', type: 'PLA Basic' },
  { id: 'basic-02', name: 'Beige',           hex: '#F7E6DE', type: 'PLA Basic' },
  { id: 'basic-03', name: 'Light Gray',      hex: '#D1D3D5', type: 'PLA Basic' },
  { id: 'basic-04', name: 'Silver',          hex: '#A6A9AA', type: 'PLA Basic' },
  { id: 'basic-05', name: 'Gray',            hex: '#8E9089', type: 'PLA Basic' },
  { id: 'basic-06', name: 'Blue Grey',       hex: '#5B6579', type: 'PLA Basic' },
  { id: 'basic-07', name: 'Dark Gray',       hex: '#545454', type: 'PLA Basic' },
  { id: 'basic-08', name: 'Black',           hex: '#000000', type: 'PLA Basic' },
  { id: 'basic-09', name: 'Red',             hex: '#C12E1F', type: 'PLA Basic' },
  { id: 'basic-10', name: 'Maroon Red',      hex: '#9D2235', type: 'PLA Basic' },
  { id: 'basic-11', name: 'Magenta',         hex: '#EC008C', type: 'PLA Basic' },
  { id: 'basic-12', name: 'Hot Pink',        hex: '#F5547C', type: 'PLA Basic' },
  { id: 'basic-13', name: 'Pink',            hex: '#F55A74', type: 'PLA Basic' },
  { id: 'basic-14', name: 'Orange',          hex: '#FF6A13', type: 'PLA Basic' },
  { id: 'basic-15', name: 'Pumpkin Orange',  hex: '#FF9016', type: 'PLA Basic' },
  { id: 'basic-16', name: 'Gold',            hex: '#E4BD68', type: 'PLA Basic' },
  { id: 'basic-17', name: 'Bronze',          hex: '#847D48', type: 'PLA Basic' },
  { id: 'basic-18', name: 'Sunflower Yellow',hex: '#FEC600', type: 'PLA Basic' },
  { id: 'basic-19', name: 'Yellow',          hex: '#F4EE2A', type: 'PLA Basic' },
  { id: 'basic-20', name: 'Bright Green',    hex: '#BECF00', type: 'PLA Basic' },
  { id: 'basic-21', name: 'Bambu Green',     hex: '#00AE42', type: 'PLA Basic' },
  { id: 'basic-22', name: 'Mistletoe Green', hex: '#3F8E43', type: 'PLA Basic' },
  { id: 'basic-23', name: 'Turquoise',       hex: '#00B1B7', type: 'PLA Basic' },
  { id: 'basic-24', name: 'Cyan',            hex: '#0086D6', type: 'PLA Basic' },
  { id: 'basic-25', name: 'Cobalt Blue',     hex: '#0056B8', type: 'PLA Basic' },
  { id: 'basic-26', name: 'Blue',            hex: '#0A2989', type: 'PLA Basic' },
  { id: 'basic-27', name: 'Purple',          hex: '#5E43B7', type: 'PLA Basic' },
  { id: 'basic-28', name: 'Indigo Purple',   hex: '#482960', type: 'PLA Basic' },
  { id: 'basic-29', name: 'Cocoa Brown',     hex: '#6F5034', type: 'PLA Basic' },
  { id: 'basic-30', name: 'Brown',           hex: '#9D432C', type: 'PLA Basic' },
  { id: 'matte-01', name: 'Ivory White',     hex: '#FFFFFF', type: 'PLA Matte' },
  { id: 'matte-02', name: 'Bone White',      hex: '#CBC6B8', type: 'PLA Matte' },
  { id: 'matte-03', name: 'Desert Tan',      hex: '#E8DBB7', type: 'PLA Matte' },
  { id: 'matte-04', name: 'Latte Brown',     hex: '#D3B7A7', type: 'PLA Matte' },
  { id: 'matte-05', name: 'Caramel',         hex: '#AE835B', type: 'PLA Matte' },
  { id: 'matte-06', name: 'Terracotta',      hex: '#B15533', type: 'PLA Matte' },
  { id: 'matte-07', name: 'Dark Brown',      hex: '#7D6556', type: 'PLA Matte' },
  { id: 'matte-08', name: 'Dark Chocolate',  hex: '#4D3324', type: 'PLA Matte' },
  { id: 'matte-09', name: 'Lilac Purple',    hex: '#AE96D4', type: 'PLA Matte' },
  { id: 'matte-10', name: 'Sakura Pink',     hex: '#E8AFCF', type: 'PLA Matte' },
  { id: 'matte-11', name: 'Mandarin Orange', hex: '#F99963', type: 'PLA Matte' },
  { id: 'matte-12', name: 'Lemon Yellow',    hex: '#F7D959', type: 'PLA Matte' },
  { id: 'matte-13', name: 'Plum',            hex: '#950051', type: 'PLA Matte' },
  { id: 'matte-14', name: 'Scarlet Red',     hex: '#DE4343', type: 'PLA Matte' },
  { id: 'matte-15', name: 'Dark Red',        hex: '#BB3D43', type: 'PLA Matte' },
  { id: 'matte-16', name: 'Dark Green',      hex: '#68724D', type: 'PLA Matte' },
  { id: 'matte-17', name: 'Grass Green',     hex: '#61C680', type: 'PLA Matte' },
  { id: 'matte-18', name: 'Apple Green',     hex: '#C2E189', type: 'PLA Matte' },
  { id: 'matte-19', name: 'Ice Blue',        hex: '#A3D8E1', type: 'PLA Matte' },
  { id: 'matte-20', name: 'Sky Blue',        hex: '#56B7E6', type: 'PLA Matte' },
  { id: 'matte-21', name: 'Marine Blue',     hex: '#0078BF', type: 'PLA Matte' },
  { id: 'matte-22', name: 'Dark Blue',       hex: '#042F56', type: 'PLA Matte' },
  { id: 'matte-23', name: 'Ash Gray',        hex: '#9B9EA0', type: 'PLA Matte' },
  { id: 'matte-24', name: 'Nardo Gray',      hex: '#757575', type: 'PLA Matte' },
  { id: 'matte-25', name: 'Charcoal',        hex: '#000000', type: 'PLA Matte' },
]

interface ColorEntry {
  color_id: string
  name: string
  hex: string
  filament_type: string
  count: number
}

interface MosaicData {
  preview: string
  pixel_grid: (number | null)[][]
  dimensions: { w: number; h: number }
  color_summary: ColorEntry[]
  total_studs: number
}

export default function CreatePage() {
  const [step, setStep]               = useState<Step>('upload')
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [noBgUrl, setNoBgUrl]         = useState<string | null>(null)
  const [resolution, setResolution]   = useState(32)
  const [mosaicData, setMosaicData]   = useState<MosaicData | null>(null)
  const [error, setError]             = useState<string | null>(null)

  // Filament selection
  const [usePlaBasic, setUsePlaBasic]   = useState(true)
  const [usePlaMatte, setUsePlaMatte]   = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [customIds, setCustomIds]       = useState<string[] | null>(null) // null = use types

  const visibleColors = BAMBU_COLORS.filter(c =>
    c.type === 'PLA Basic' ? usePlaBasic : usePlaMatte
  )

  function toggleCustomId(id: string) {
    const base = customIds ?? visibleColors.map(c => c.id)
    setCustomIds(
      base.includes(id) ? base.filter(x => x !== id) : [...base, id]
    )
  }

  function getFilamentPayload() {
    if (customIds) return { custom_color_ids: customIds, filament_types: [] }
    const types = [usePlaBasic && 'PLA Basic', usePlaMatte && 'PLA Matte'].filter(Boolean) as string[]
    return { filament_types: types.length ? types : ['PLA Basic'], custom_color_ids: [] }
  }

  // ── Step 1 ────────────────────────────────────────────────────────────────
  function handleFile(file: File) {
    setOriginalFile(file)
    setOriginalUrl(URL.createObjectURL(file))
    setNoBgUrl(null); setMosaicData(null); setError(null)
    setStep('preview')
  }

  // ── Step 2 ────────────────────────────────────────────────────────────────
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
      setStep('pixelize')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStep('preview')
    }
  }

  // ── Step 3 ────────────────────────────────────────────────────────────────
  async function handlePixelize() {
    if (!noBgUrl) return
    setStep('pixelizing'); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/pixelize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: noBgUrl, resolution, ...getFilamentPayload() }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.detail || `Server error ${res.status}`) }
      const data: MosaicData = await res.json()
      setMosaicData(data)
      setStep('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStep('pixelize')
    }
  }

  function handleReset() {
    setStep('upload'); setOriginalFile(null); setOriginalUrl(null)
    setNoBgUrl(null); setMosaicData(null); setError(null)
  }

  const isLoading = step === 'removing' || step === 'pixelizing'

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-[#1A1A2E]">
          Create Your <span className="text-[#FFD700]">3D Print Mosaic</span>
        </h1>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs font-semibold">
          {['Upload', 'Remove BG', 'Filament & Resolution', 'Export'].map((label, i) => {
            const stepIdx = ['upload','preview','pixelize','result'].indexOf(
              step === 'removing' ? 'preview' : step === 'pixelizing' ? 'pixelize' : step
            )
            const active = stepIdx === i
            const done   = stepIdx > i
            return (
              <div key={label} className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full ${done ? 'bg-[#1A1A2E] text-white' : active ? 'bg-[#FFD700] text-[#1A1A2E]' : 'bg-gray-100 text-gray-400'}`}>
                  {i + 1}. {label}
                </span>
                {i < 3 && <span className="text-gray-300">›</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="underline text-red-400 ml-4">✕</button>
        </div>
      )}

      {/* STEP: upload */}
      {step === 'upload' && <ImageDropzone onFile={handleFile} />}

      {/* STEP: preview / removing */}
      {(step === 'preview' || step === 'removing') && originalUrl && (
        <div className="space-y-6">
          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 300 }}>
            <img src={originalUrl} alt="Original" className="max-h-72 max-w-full object-contain" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleReset} disabled={isLoading} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 disabled:opacity-40">
              ← Choose another
            </button>
            <button onClick={handleRemoveBg} disabled={isLoading} className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 disabled:opacity-50">
              {step === 'removing' ? <Spinner label="Removing background…" /> : 'Remove Background →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP: pixelize / pixelizing */}
      {(step === 'pixelize' || step === 'pixelizing') && noBgUrl && (
        <div className="space-y-6">
          {/* Side-by-side */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Original</p>
              <div className="rounded-xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 200 }}>
                <img src={originalUrl!} alt="Original" className="max-h-48 max-w-full object-contain" />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest text-center">No Background</p>
              <div className="rounded-xl overflow-hidden border border-gray-100 flex items-center justify-center"
                style={{ minHeight: 200, backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)', backgroundSize: '16px 16px' }}>
                <img src={noBgUrl} alt="No BG" className="max-h-48 max-w-full object-contain" />
              </div>
            </div>
          </div>

          {/* Filament picker */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-bold text-[#1A1A2E]">Your Filament</p>
            <p className="text-xs text-gray-400">Enable the filament types you have</p>
            <div className="flex gap-3">
              {[{ label: 'PLA Basic (30 colors)', key: 'basic', checked: usePlaBasic, set: setUsePlaBasic },
                { label: 'PLA Matte (25 colors)',  key: 'matte', checked: usePlaMatte, set: setUsePlaMatte }]
                .map(({ label, key, checked, set }) => (
                  <label key={key} className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-[#FFD700] bg-yellow-50' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={checked} onChange={e => { set(e.target.checked); setCustomIds(null) }} className="accent-[#FFD700]" />
                    <span className="text-sm font-semibold text-[#1A1A2E]">{label}</span>
                  </label>
                ))}
            </div>

            {/* Advanced color picker */}
            <button onClick={() => setShowColorPicker(v => !v)}
              className="text-xs text-gray-400 hover:text-[#1A1A2E] underline transition-colors">
              {showColorPicker ? '▲ Hide' : '▼ I want to pick specific colors'}
            </button>
            {showColorPicker && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">Only selected colors will be used in your model</p>
                <div className="flex gap-2">
                  <button onClick={() => setCustomIds(visibleColors.map(c => c.id))}
                    className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400">Select all</button>
                  <button onClick={() => setCustomIds([])}
                    className="text-xs px-3 py-1 rounded-lg border border-gray-200 hover:border-gray-400">Clear</button>
                  {customIds !== null && (
                    <button onClick={() => setCustomIds(null)}
                      className="text-xs px-3 py-1 rounded-lg border border-[#FFD700] text-[#1A1A2E] bg-yellow-50">Use all from types</button>
                  )}
                </div>
                <div className="grid grid-cols-10 gap-1">
                  {visibleColors.map(c => {
                    const active = customIds === null || customIds.includes(c.id)
                    return (
                      <button key={c.id} title={`${c.name} (${c.type})`} onClick={() => toggleCustomId(c.id)}
                        className={`relative w-8 h-8 rounded border-2 transition-all ${active ? 'border-[#1A1A2E] opacity-100' : 'border-gray-200 opacity-30'}`}
                        style={{ backgroundColor: c.hex }}>
                        {active && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-[9px] font-black drop-shadow"
                            style={{ textShadow: '0 0 2px #000' }}>✓</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {customIds !== null && (
                  <p className="text-xs text-gray-400">{customIds.length} color{customIds.length !== 1 ? 's' : ''} selected</p>
                )}
              </div>
            )}
          </div>

          {/* Resolution picker */}
          <div>
            <p className="text-sm font-bold text-[#1A1A2E] mb-3">Choose Resolution</p>
            <div className="grid grid-cols-4 gap-2">
              {RESOLUTIONS.map(({ value, label, desc }) => (
                <button key={value} onClick={() => setResolution(value)}
                  className={`py-3 rounded-xl border-2 text-center transition-all ${resolution === value ? 'border-[#FFD700] bg-yellow-50' : 'border-gray-200 hover:border-gray-400'}`}>
                  <div className="font-black text-lg text-[#1A1A2E]">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              16 = simple (few bricks) · 64 = detailed (many bricks)
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('preview')} disabled={isLoading} className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 disabled:opacity-40">
              ← Back
            </button>
            <button onClick={handlePixelize} disabled={isLoading || (!usePlaBasic && !usePlaMatte && !customIds?.length)}
              className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 disabled:opacity-50">
              {step === 'pixelizing' ? <Spinner label="Sorting bricks…" /> : 'Generate Mosaic →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP: result */}
      {step === 'result' && mosaicData && (
        <MosaicResult
          mosaicData={mosaicData}
          onBack={() => setStep('pixelize')}
          onReset={handleReset}
        />
      )}
    </div>
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
