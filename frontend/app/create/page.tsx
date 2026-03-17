'use client'

import { useState } from 'react'
import Image from 'next/image'
import ImageDropzone from '@/components/ImageDropzone'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Step = 'upload' | 'preview' | 'result'

export default function CreatePage() {
  const [step, setStep] = useState<Step>('upload')
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file: File) {
    setOriginalFile(file)
    setOriginalUrl(URL.createObjectURL(file))
    setResultUrl(null)
    setError(null)
    setStep('preview')
  }

  async function handleRemoveBg() {
    if (!originalFile) return
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('file', originalFile)

    try {
      const res = await fetch(`${API_URL}/api/remove-background`, {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setResultUrl(data.image)
      setStep('result')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error occurred.')
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setStep('upload')
    setOriginalFile(null)
    setOriginalUrl(null)
    setResultUrl(null)
    setError(null)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-[#1A1A2E]">
          Create Your <span className="text-[#FFD700]">LEGO Mosaic</span>
        </h1>
        <p className="text-gray-400 mt-2 text-sm">
          Step 1 of 4 — Upload &amp; Remove Background
        </p>
      </div>

      {/* Step: Upload */}
      {step === 'upload' && (
        <ImageDropzone onFile={handleFile} />
      )}

      {/* Step: Preview — show original, offer to remove bg */}
      {step === 'preview' && originalUrl && (
        <div className="space-y-6">
          <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 320 }}>
            <img
              src={originalUrl}
              alt="Original"
              className="max-h-80 max-w-full object-contain"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 underline text-red-400 hover:text-red-600"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 transition-colors"
            >
              ← Choose another
            </button>
            <button
              onClick={handleRemoveBg}
              disabled={loading}
              className="flex-1 bg-[#FFD700] text-[#1A1A2E] px-6 py-3 rounded-xl font-black hover:bg-yellow-400 transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Removing background…
                </span>
              ) : (
                'Remove Background →'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step: Result — original vs no-bg side by side */}
      {step === 'result' && originalUrl && resultUrl && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Original</p>
              <div className="rounded-2xl overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center" style={{ minHeight: 240 }}>
                <img src={originalUrl} alt="Original" className="max-h-60 max-w-full object-contain" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#FFD700] uppercase tracking-widest text-center">Background Removed</p>
              <div
                className="rounded-2xl overflow-hidden border border-gray-100 flex items-center justify-center"
                style={{
                  minHeight: 240,
                  backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)',
                  backgroundSize: '20px 20px',
                }}
              >
                <img src={resultUrl} alt="No background" className="max-h-60 max-w-full object-contain" />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:border-gray-400 transition-colors"
            >
              ← Start over
            </button>
            <button
              className="flex-1 bg-[#1A1A2E] text-white px-6 py-3 rounded-xl font-black hover:bg-[#2a2a4e] transition-colors"
              onClick={() => alert('Coming in Phase 2: Pixelization!')}
            >
              Continue to DemiBrick →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
