'use client'

import { useRef, useState, DragEvent, ChangeEvent } from 'react'

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

const MAX_MB = 10

export default function ImageDropzone({ onFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate(file: File): string | null {
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      return 'Only JPEG and PNG files are supported.'
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_MB} MB.`
    }
    return null
  }

  function handleFile(file: File) {
    const err = validate(file)
    if (err) { setError(err); return }
    setError(null)
    onFile(file)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div>
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
          ${dragging ? 'border-[#FFD700] bg-yellow-50' : 'border-gray-200 bg-gray-50 hover:border-[#FFD700] hover:bg-yellow-50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={onInputChange}
          disabled={disabled}
        />
        <div className="text-5xl mb-4">📸</div>
        <p className="font-semibold text-[#1A1A2E]">
          Drag & drop your photo here
        </p>
        <p className="text-sm text-gray-400 mt-1">or click to choose a file</p>
        <p className="text-xs text-gray-300 mt-3">JPEG · PNG · max {MAX_MB} MB</p>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-500 font-medium">{error}</p>
      )}
    </div>
  )
}
