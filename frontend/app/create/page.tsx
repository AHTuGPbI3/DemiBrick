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

interface ColorEntry {
  color_id: number
  name: string
  hex: string
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
  const [noBgUrl, setNoBgUrl]         = useState<string | null>(null)   // base64 data URL
  const [resolution, setResolution]   = useState(32)
  const [mosaicData, setMosaicData]   = useState<MosaicData | null>(null)
  const [error, setError]             = useState<string | null>(null)

  // ── Step 1: file chosen ──────────────────────────────────────────────────
  function handleFile(file: File) {
    setOriginalFile(file)
    setOriginalUrl(URL.createObjectURL(file))
    setNoBgUrl(null); setMosaicData(null); setError(null)
    setStep('preview')
  }

  // ── Step 2: remove background ────────────────────────────────────────────
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

  // ── Step 3: pixelize ─────────────────────────────────────────────────────
  async function handlePixelize() {
    if (!noBgUrl) return
    setStep('pixelizing'); setError(null)
    try {
      const res = await fetch(`${API_URL}/api/pixelize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: noBgUrl, resolution }),
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
          Create Your <span className="text-[#FFD700]">LEGO Mosaic</span>
        </h1>
        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mt-4 text-xs font-semibold">
          {['Upload', 'Remove BG', 'Pixelize', 'Export'].map((label, i) => {
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

      {/* ── STEP: upload ── */}
      {step === 'upload' && <ImageDropzone onFile={handleFile} />}

      {/* ── STEP: preview / removing ── */}
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

      {/* ── STEP: pixelize / pixelizing ── */}
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
            <button onClick={handlePixelize} disabled={isLoading} className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 disabled:opacity-50">
              {step === 'pixelizing' ? <Spinner label="Sorting bricks…" /> : 'Generate Mosaic →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: result ── */}
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
