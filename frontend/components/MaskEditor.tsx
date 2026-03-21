'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

type Tool = 'brush' | 'eraser' | 'lasso' | 'wand' | 'rect'
type Mode = 'erase' | 'restore'

interface MaskEditorProps {
  originalUrl: string   // original photo (before bg removal)
  noBgUrl:     string   // RGBA PNG from RMBG-2.0 (alpha = mask)
  onApply:     (maskedUrl: string) => void
  onSkip:      () => void
}

const HISTORY_LIMIT = 30

function drawCheckerboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sz = 16
  for (let y = 0; y < h; y += sz)
    for (let x = 0; x < w; x += sz) {
      ctx.fillStyle = ((x / sz + y / sz) % 2 === 0) ? '#bbbbbb' : '#ffffff'
      ctx.fillRect(x, y, sz, sz)
    }
}

const TOOL_DEFS: { id: Tool; icon: string; key: string; label: string }[] = [
  { id: 'brush',  icon: '🖌',  key: 'B', label: 'Brush' },
  { id: 'eraser', icon: '⬜', key: 'E', label: 'Eraser' },
  { id: 'lasso',  icon: '⭕', key: 'L', label: 'Lasso' },
  { id: 'wand',   icon: '✨', key: 'W', label: 'Magic Wand' },
  { id: 'rect',   icon: '▭',  key: 'M', label: 'Rect Select' },
]

export default function MaskEditor({ originalUrl, noBgUrl, onApply, onSkip }: MaskEditorProps) {
  // ── Canvas refs ──────────────────────────────────────────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null)
  const displayRef    = useRef<HTMLCanvasElement>(null)
  const maskRef       = useRef<HTMLCanvasElement | null>(null)      // offscreen mask
  const origCanvasRef = useRef<HTMLCanvasElement | null>(null)      // for magic wand
  const origImgRef    = useRef<HTMLImageElement | null>(null)
  const tmpRef        = useRef<HTMLCanvasElement | null>(null)      // composite temp
  const ghostRef      = useRef<HTMLCanvasElement | null>(null)      // ghost temp

  // ── Tool state ───────────────────────────────────────────────────────────────
  const [tool,       setTool]       = useState<Tool>('brush')
  const [mode,       setMode]       = useState<Mode>('erase')
  const [brushSize,  setBrushSize]  = useState(30)
  const [hardness,   setHardness]   = useState(0.8)
  const [opacity,    setOpacity]    = useState(1.0)
  const [tolerance,  setTolerance]  = useState(30)
  const [contiguous, setContiguous] = useState(true)
  const [checkers,   setCheckers]   = useState(true)
  const [zoom,       setZoom]       = useState(1)
  const [pan,        setPan]        = useState({ x: 0, y: 0 })
  const [imgSize,    setImgSize]    = useState({ w: 0, h: 0 })
  const [ready,      setReady]      = useState(false)
  const [canUndo,    setCanUndo]    = useState(false)
  const [canRedo,    setCanRedo]    = useState(false)

  // ── Mutable refs (avoid stale closures in event handlers) ────────────────────
  const toolRef      = useRef(tool)
  const modeRef      = useRef(mode)
  const brushSzRef   = useRef(brushSize)
  const hardRef      = useRef(hardness)
  const opacRef      = useRef(opacity)
  const tolRef       = useRef(tolerance)
  const contRef      = useRef(contiguous)
  const checkRef     = useRef(checkers)
  const panRef       = useRef(pan)
  const zoomRef      = useRef(zoom)

  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { brushSzRef.current = brushSize }, [brushSize])
  useEffect(() => { hardRef.current = hardness }, [hardness])
  useEffect(() => { opacRef.current = opacity }, [opacity])
  useEffect(() => { tolRef.current = tolerance }, [tolerance])
  useEffect(() => { contRef.current = contiguous }, [contiguous])
  useEffect(() => { checkRef.current = checkers }, [checkers])
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const isDrawingRef   = useRef(false)
  const isPanningRef   = useRef(false)
  const spaceRef       = useRef(false)
  const panStartRef    = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const lassoRef       = useRef<{ x: number; y: number }[]>([])
  const rectStartRef   = useRef<{ x: number; y: number } | null>(null)
  const historyRef     = useRef<ImageData[]>([])
  const redoStackRef   = useRef<ImageData[]>([])

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const noBgImg = new Image()
    noBgImg.crossOrigin = 'anonymous'
    noBgImg.onload = () => {
      const w = noBgImg.naturalWidth
      const h = noBgImg.naturalHeight
      setImgSize({ w, h })

      // Mask canvas: white pixels, alpha = original alpha from RMBG-2.0
      const mc = document.createElement('canvas')
      mc.width = w; mc.height = h
      const mctx = mc.getContext('2d')!
      mctx.drawImage(noBgImg, 0, 0)
      const id = mctx.getImageData(0, 0, w, h)
      for (let i = 0; i < id.data.length; i += 4) {
        id.data[i] = id.data[i + 1] = id.data[i + 2] = 255 // white; keep alpha
      }
      mctx.putImageData(id, 0, 0)
      maskRef.current = mc

      // Temp canvases for compositing
      const t1 = document.createElement('canvas'); t1.width = w; t1.height = h
      const t2 = document.createElement('canvas'); t2.width = w; t2.height = h
      tmpRef.current = t1; ghostRef.current = t2

      // Load original for magic wand
      const origImg = new Image()
      origImg.crossOrigin = 'anonymous'
      origImg.onload = () => {
        const oc = document.createElement('canvas'); oc.width = w; oc.height = h
        oc.getContext('2d')!.drawImage(origImg, 0, 0)
        origCanvasRef.current = oc
        origImgRef.current = origImg

        // Size display canvas
        const dc = displayRef.current
        if (dc) { dc.width = w; dc.height = h }

        // Fit to container
        const ct = containerRef.current
        if (ct) {
          const fz = Math.min(1, (ct.clientWidth - 4) / w, (ct.clientHeight - 4) / h)
          setZoom(fz); zoomRef.current = fz
        }
        setReady(true)
      }
      origImg.src = originalUrl
    }
    noBgImg.src = noBgUrl
  }, [originalUrl, noBgUrl])

  // ── Redraw ───────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const dc  = displayRef.current
    const mc  = maskRef.current
    const oi  = origImgRef.current
    const t1  = tmpRef.current
    const t2  = ghostRef.current
    if (!dc || !mc || !oi || !t1 || !t2) return
    const ctx = dc.getContext('2d')!
    const { w, h } = { w: dc.width, h: dc.height }

    ctx.clearRect(0, 0, w, h)
    if (checkRef.current) drawCheckerboard(ctx, w, h)

    // Composite: original × mask
    const tc = t1.getContext('2d')!
    tc.clearRect(0, 0, w, h)
    tc.drawImage(oi, 0, 0)
    tc.globalCompositeOperation = 'destination-in'
    tc.drawImage(mc, 0, 0)
    tc.globalCompositeOperation = 'source-over'
    ctx.drawImage(t1, 0, 0)

    // Ghost: erased areas at 20% opacity
    const gc = t2.getContext('2d')!
    gc.clearRect(0, 0, w, h)
    gc.drawImage(oi, 0, 0)
    gc.globalCompositeOperation = 'destination-out'
    gc.drawImage(mc, 0, 0)
    gc.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 0.22
    ctx.drawImage(t2, 0, 0)
    ctx.globalAlpha = 1
  }, [])

  useEffect(() => { if (ready) redraw() }, [ready, redraw, checkers, zoom, pan])

  // ── History ──────────────────────────────────────────────────────────────────
  function pushHistory() {
    const mc = maskRef.current; if (!mc) return
    const snap = mc.getContext('2d')!.getImageData(0, 0, mc.width, mc.height)
    historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), snap]
    redoStackRef.current = []
    setCanUndo(true); setCanRedo(false)
  }

  const undo = useCallback(() => {
    const mc = maskRef.current; if (!mc || !historyRef.current.length) return
    const mctx = mc.getContext('2d')!
    redoStackRef.current = [mctx.getImageData(0, 0, mc.width, mc.height), ...redoStackRef.current]
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    mctx.putImageData(prev, 0, 0); redraw()
    setCanUndo(historyRef.current.length > 0); setCanRedo(true)
  }, [redraw])

  const redo = useCallback(() => {
    const mc = maskRef.current; if (!mc || !redoStackRef.current.length) return
    const mctx = mc.getContext('2d')!
    historyRef.current = [...historyRef.current, mctx.getImageData(0, 0, mc.width, mc.height)]
    const next = redoStackRef.current[0]
    redoStackRef.current = redoStackRef.current.slice(1)
    mctx.putImageData(next, 0, 0); redraw()
    setCanUndo(true); setCanRedo(redoStackRef.current.length > 0)
  }, [redraw])

  // ── Coordinate helpers ───────────────────────────────────────────────────────
  function getImagePos(e: React.MouseEvent | MouseEvent): { x: number; y: number } {
    const dc = displayRef.current!
    const rect = dc.getBoundingClientRect()
    return {
      x: Math.round((e.clientX - rect.left) * dc.width  / rect.width),
      y: Math.round((e.clientY - rect.top)  * dc.height / rect.height),
    }
  }

  // ── Drawing tools ────────────────────────────────────────────────────────────
  function paintBrush(x: number, y: number, isErase: boolean) {
    const mc = maskRef.current; if (!mc) return
    const mctx = mc.getContext('2d')!
    const radius = brushSzRef.current / 2
    const op = opacRef.current
    const hd = hardRef.current

    if (hd >= 0.95) {
      mctx.globalAlpha = op
      mctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over'
      mctx.fillStyle = isErase ? 'rgba(0,0,0,1)' : 'white'
      mctx.beginPath(); mctx.arc(x, y, radius, 0, Math.PI * 2); mctx.fill()
    } else {
      const g = mctx.createRadialGradient(x, y, 0, x, y, radius)
      const inner = Math.max(0.001, hd)
      if (isErase) {
        g.addColorStop(0, `rgba(0,0,0,${op})`); g.addColorStop(inner, `rgba(0,0,0,${op})`); g.addColorStop(1, 'rgba(0,0,0,0)')
        mctx.globalCompositeOperation = 'destination-out'
      } else {
        g.addColorStop(0, `rgba(255,255,255,${op})`); g.addColorStop(inner, `rgba(255,255,255,${op})`); g.addColorStop(1, 'rgba(255,255,255,0)')
        mctx.globalCompositeOperation = 'source-over'
      }
      mctx.fillStyle = g
      mctx.fillRect(x - radius, y - radius, brushSzRef.current, brushSzRef.current)
    }
    mctx.globalAlpha = 1; mctx.globalCompositeOperation = 'source-over'
  }

  function applyMagicWand(x: number, y: number, isErase: boolean) {
    const oc = origCanvasRef.current; const mc = maskRef.current
    if (!oc || !mc) return
    const { data, width, height } = oc.getContext('2d')!.getImageData(0, 0, oc.width, oc.height)
    const si = (y * width + x) * 4
    const [tR, tG, tB] = [data[si], data[si + 1], data[si + 2]]
    const thr = tolRef.current * 4.41
    const sel = new Uint8Array(width * height)

    if (contRef.current) {
      const queue: number[] = [y * width + x]
      const vis = new Uint8Array(width * height)
      while (queue.length) {
        const k = queue.pop()!
        if (vis[k]) continue; vis[k] = 1
        const cx = k % width, cy = (k / width) | 0
        if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue
        const i = k * 4
        if (Math.sqrt((data[i]-tR)**2 + (data[i+1]-tG)**2 + (data[i+2]-tB)**2) <= thr) {
          sel[k] = 1
          if (cx + 1 < width)  queue.push(k + 1)
          if (cx - 1 >= 0)     queue.push(k - 1)
          if (cy + 1 < height) queue.push(k + width)
          if (cy - 1 >= 0)     queue.push(k - width)
        }
      }
    } else {
      for (let i = 0; i < width * height; i++) {
        const pi = i * 4
        if (Math.sqrt((data[pi]-tR)**2 + (data[pi+1]-tG)**2 + (data[pi+2]-tB)**2) <= thr) sel[i] = 1
      }
    }

    pushHistory()
    const mctx = mc.getContext('2d')!
    const md = mctx.getImageData(0, 0, mc.width, mc.height)
    for (let i = 0; i < sel.length; i++) if (sel[i]) md.data[i * 4 + 3] = isErase ? 0 : 255
    mctx.putImageData(md, 0, 0); redraw()
  }

  function applyLasso(points: { x: number; y: number }[], isErase: boolean) {
    const mc = maskRef.current; if (!mc || points.length < 3) return
    const mctx = mc.getContext('2d')!
    mctx.save()
    mctx.beginPath(); mctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) mctx.lineTo(points[i].x, points[i].y)
    mctx.closePath()
    mctx.globalCompositeOperation = isErase ? 'destination-out' : 'source-over'
    mctx.fillStyle = isErase ? 'rgba(0,0,0,1)' : 'white'
    mctx.fill(); mctx.restore(); redraw()
  }

  function applyRect(x1: number, y1: number, x2: number, y2: number, isErase: boolean) {
    const mc = maskRef.current; if (!mc) return
    const mctx = mc.getContext('2d')!
    const [rx, ry, rw, rh] = [Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1)]
    if (isErase) { mctx.clearRect(rx, ry, rw, rh) }
    else { mctx.fillStyle = 'white'; mctx.fillRect(rx, ry, rw, rh) }
    redraw()
  }

  // ── Mouse handlers ───────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    if (spaceRef.current) {
      isPanningRef.current = true
      panStartRef.current = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y }
      return
    }
    const pos = getImagePos(e)
    const isErase = toolRef.current === 'eraser' || modeRef.current === 'erase'

    if (toolRef.current === 'wand') { applyMagicWand(pos.x, pos.y, isErase); return }
    if (toolRef.current === 'lasso') {
      if (!isDrawingRef.current) { pushHistory(); isDrawingRef.current = true; lassoRef.current = [] }
      lassoRef.current = [...lassoRef.current, pos]; return
    }
    if (toolRef.current === 'rect') { pushHistory(); rectStartRef.current = pos; isDrawingRef.current = true; return }

    // brush / eraser
    pushHistory(); isDrawingRef.current = true
    paintBrush(pos.x, pos.y, isErase); redraw()
  }

  function onMouseMove(e: React.MouseEvent) {
    if (isPanningRef.current) {
      setPan({ x: panStartRef.current.px + e.clientX - panStartRef.current.mx, y: panStartRef.current.py + e.clientY - panStartRef.current.my })
      return
    }
    if (!isDrawingRef.current) return
    const pos = getImagePos(e)
    if (toolRef.current === 'lasso') { lassoRef.current = [...lassoRef.current, pos]; return }
    if (toolRef.current === 'rect') return
    const isErase = toolRef.current === 'eraser' || modeRef.current === 'erase'
    paintBrush(pos.x, pos.y, isErase); redraw()
  }

  function onMouseUp(e: React.MouseEvent) {
    isPanningRef.current = false
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const pos = getImagePos(e)
    const isErase = toolRef.current === 'eraser' || modeRef.current === 'erase'
    if (toolRef.current === 'lasso') { applyLasso(lassoRef.current, isErase); lassoRef.current = []; return }
    if (toolRef.current === 'rect' && rectStartRef.current) {
      applyRect(rectStartRef.current.x, rectStartRef.current.y, pos.x, pos.y, isErase)
      rectStartRef.current = null
    }
  }

  function onDblClick(e: React.MouseEvent) {
    if (toolRef.current === 'lasso' && lassoRef.current.length > 2) {
      isDrawingRef.current = false
      applyLasso(lassoRef.current, modeRef.current === 'erase'); lassoRef.current = []
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!e.ctrlKey) return; e.preventDefault()
    setZoom(z => Math.min(8, Math.max(0.1, +(z * (e.deltaY > 0 ? 0.9 : 1.1)).toFixed(3))))
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === 'Space') { spaceRef.current = true; e.preventDefault(); return }
      if (['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      const k = e.key.toLowerCase()
      if (k === 'b') setTool('brush')
      else if (k === 'e') setTool('eraser')
      else if (k === 'l') setTool('lasso')
      else if (k === 'w') setTool('wand')
      else if (k === 'm') setTool('rect')
      else if (k === 'x') setMode(m => m === 'erase' ? 'restore' : 'erase')
      else if (k === '[') setBrushSize(s => Math.max(1, s - 5))
      else if (k === ']') setBrushSize(s => Math.min(200, s + 5))
      else if (e.ctrlKey && k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if (e.ctrlKey && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      else if (e.ctrlKey && k === '0') { fitToScreen(); e.preventDefault() }
      else if (e.ctrlKey && k === '1') { setZoom(1); setPan({ x: 0, y: 0 }); e.preventDefault() }
    }
    function up(e: KeyboardEvent) { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [undo, redo])

  function fitToScreen() {
    const ct = containerRef.current; if (!ct || !imgSize.w) return
    const fz = Math.min(1, (ct.clientWidth - 4) / imgSize.w, (ct.clientHeight - 4) / imgSize.h)
    setZoom(fz); setPan({ x: 0, y: 0 })
  }

  // ── Actions ──────────────────────────────────────────────────────────────────
  function handleApply() {
    const mc = maskRef.current; const oi = origImgRef.current; if (!mc || !oi) return
    const res = document.createElement('canvas'); res.width = mc.width; res.height = mc.height
    const ctx = res.getContext('2d')!
    ctx.drawImage(oi, 0, 0)
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mc, 0, 0)
    onApply(res.toDataURL('image/png'))
  }

  function handleReset() {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      const mc = maskRef.current; if (!mc) return
      const mctx = mc.getContext('2d')!
      mctx.clearRect(0, 0, mc.width, mc.height); mctx.drawImage(img, 0, 0)
      const id = mctx.getImageData(0, 0, mc.width, mc.height)
      for (let i = 0; i < id.data.length; i += 4) id.data[i] = id.data[i+1] = id.data[i+2] = 255
      mctx.putImageData(id, 0, 0)
      historyRef.current = []; redoStackRef.current = []
      setCanUndo(false); setCanRedo(false); redraw()
    }
    img.src = noBgUrl
  }

  function handleInvert() {
    const mc = maskRef.current; if (!mc) return
    pushHistory()
    const mctx = mc.getContext('2d')!
    const id = mctx.getImageData(0, 0, mc.width, mc.height)
    for (let i = 0; i < id.data.length; i += 4) id.data[i + 3] = 255 - id.data[i + 3]
    mctx.putImageData(id, 0, 0); redraw()
  }

  const showBrush = tool === 'brush' || tool === 'eraser'
  const showWand  = tool === 'wand'

  return (
    <div className="flex flex-col bg-[#1A1A2E] text-white rounded-2xl overflow-hidden" style={{ height: 600 }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#111122] border-b border-gray-700 flex-shrink-0 flex-wrap">
        <button onClick={undo}        disabled={!canUndo} className="px-3 py-1 text-xs rounded border border-gray-600 disabled:opacity-40 hover:border-gray-400">↩ Undo</button>
        <button onClick={redo}        disabled={!canRedo} className="px-3 py-1 text-xs rounded border border-gray-600 disabled:opacity-40 hover:border-gray-400">↪ Redo</button>
        <button onClick={handleReset}                     className="px-3 py-1 text-xs rounded border border-gray-600 hover:border-gray-400">↺ Reset</button>
        <button onClick={handleInvert}                    className="px-3 py-1 text-xs rounded border border-gray-600 hover:border-gray-400">⇄ Invert</button>
        <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer ml-1">
          <input type="checkbox" checked={checkers} onChange={e => setCheckers(e.target.checked)} className="accent-[#FFD700]" />
          Checkerboard
        </label>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.1, +(z * 0.8).toFixed(2)))} className="px-2 py-1 text-xs rounded border border-gray-700 hover:border-gray-500">−</button>
          <span className="text-xs w-12 text-center text-gray-300">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(8,   +(z * 1.25).toFixed(2)))} className="px-2 py-1 text-xs rounded border border-gray-700 hover:border-gray-500">+</button>
          <button onClick={fitToScreen}                                                className="px-2 py-1 text-xs rounded border border-gray-700 hover:border-gray-500 ml-1">Fit</button>
        </div>
        <button onClick={onSkip}      className="px-4 py-1.5 text-xs rounded-lg border border-gray-500 hover:border-gray-300 ml-2">Skip →</button>
        <button onClick={handleApply} className="px-4 py-1.5 text-xs rounded-lg bg-[#FFD700] text-black font-bold hover:bg-yellow-400">Apply →</button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left toolbar ────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 p-2 bg-[#111122] border-r border-gray-700 flex-shrink-0">
          {TOOL_DEFS.map(t => (
            <button key={t.id} title={`${t.label} (${t.key})`} onClick={() => setTool(t.id)}
              className={`w-10 h-10 rounded text-lg flex items-center justify-center border transition-all
                ${tool === t.id ? 'border-[#FFD700] bg-yellow-900/30' : 'border-gray-700 hover:border-gray-500'}`}>
              {t.icon}
            </button>
          ))}
          <div className="w-8 border-t border-gray-700 my-1" />
          <button title="Toggle Erase/Restore (X)" onClick={() => setMode(m => m === 'erase' ? 'restore' : 'erase')}
            className={`w-10 h-10 rounded text-[10px] font-bold border transition-all
              ${mode === 'erase' ? 'border-red-500 bg-red-900/30 text-red-400' : 'border-green-500 bg-green-900/30 text-green-400'}`}>
            {mode === 'erase' ? 'ERASE' : 'REST.'}
          </button>
        </div>

        {/* ── Canvas area ─────────────────────────────────────────────────────── */}
        <div ref={containerRef} className="flex-1 overflow-hidden relative bg-gray-700"
          style={{ cursor: spaceRef.current ? 'grab' : (tool === 'brush' || tool === 'eraser') ? 'crosshair' : 'default' }}>
          <div style={{ position: 'absolute', left: pan.x, top: pan.y, transformOrigin: '0 0', transform: `scale(${zoom})` }}>
            <canvas ref={displayRef}
              onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
              onDoubleClick={onDblClick} onWheel={onWheel}
              style={{ display: 'block', imageRendering: zoom > 2 ? 'pixelated' : 'auto' }} />
          </div>
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Loading image…
            </div>
          )}
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────────── */}
        <div className="w-44 p-3 bg-[#111122] border-l border-gray-700 flex flex-col gap-3 text-xs flex-shrink-0 overflow-y-auto">
          {/* Mode */}
          <div>
            <p className="text-gray-400 uppercase tracking-wide font-bold mb-1">Mode</p>
            <div className="flex gap-1">
              {(['erase', 'restore'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-1.5 rounded font-bold text-xs transition-all capitalize
                    ${mode === m ? (m === 'erase' ? 'bg-red-600 text-white' : 'bg-green-600 text-white') : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                  {m === 'erase' ? 'Erase' : 'Restore'}
                </button>
              ))}
            </div>
          </div>

          {showBrush && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-gray-400">Size: {brushSize}px</span>
                <input type="range" min={1} max={200} value={brushSize} onChange={e => setBrushSize(+e.target.value)} className="accent-[#FFD700]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-400">Hardness: {Math.round(hardness * 100)}%</span>
                <input type="range" min={0} max={100} value={hardness * 100} onChange={e => setHardness(+e.target.value / 100)} className="accent-[#FFD700]" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-gray-400">Opacity: {Math.round(opacity * 100)}%</span>
                <input type="range" min={10} max={100} value={opacity * 100} onChange={e => setOpacity(+e.target.value / 100)} className="accent-[#FFD700]" />
              </label>
            </>
          )}

          {showWand && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-gray-400">Tolerance: {tolerance}</span>
                <input type="range" min={0} max={100} value={tolerance} onChange={e => setTolerance(+e.target.value)} className="accent-[#FFD700]" />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={contiguous} onChange={e => setContiguous(e.target.checked)} className="accent-[#FFD700]" />
                <span className="text-gray-400">Contiguous</span>
              </label>
            </>
          )}

          <div className="mt-auto text-gray-600 text-[10px] leading-relaxed">
            <p>B E L W M — tools</p>
            <p>X — toggle mode</p>
            <p>[ ] — brush size</p>
            <p>Ctrl+Z/Y — undo/redo</p>
            <p>Space+drag — pan</p>
            <p>Ctrl+scroll — zoom</p>
          </div>
        </div>
      </div>
    </div>
  )
}
