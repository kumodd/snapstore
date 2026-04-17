import { useState, useRef, useCallback } from 'react'
import {
  Wand2, Sparkles, Loader2, Copy, Image as ImageIcon,
  RefreshCw, AlertCircle, ChevronDown, ChevronUp, X, Check,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useEditorStore } from '../../stores/editorStore'
import { supabase } from '../../lib/supabase'
import { IText, Image as FabricImage } from 'fabric'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface AIComposerPanelProps { projectId?: string }

interface CopySuggestion {
  text: string
  style: 'benefit' | 'feature' | 'social_proof'
  charCount: number
}

interface ComposePalette { hex: string; label: string }
interface ComposeSlide {
  index: number
  headline: string
  subheadline: string
  layoutTip: string
  backgroundColor: string
}
interface ComposeResult {
  appInsights: string
  overallTone: string
  palette: ComposePalette[]
  slides: ComposeSlide[]
  cta: string
}

const CATEGORIES = [
  'Productivity', 'Health & Fitness', 'Finance', 'Education',
  'Social', 'Gaming', 'Travel', 'Shopping', 'Food & Drink',
  'Entertainment', 'Utilities', 'Lifestyle',
]

const COMPOSE_STEPS = [
  'Uploading screenshots…',
  "Analysing your app's visual style…",
  'Generating colour palette…',
  'Writing headlines…',
  'Finalising recommendations…',
]

/** Resize a File to maxDim px (JPEG 80%) and return a base64 data URL */
async function resizeImage(file: File, maxDim = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

/** Find the first unoccupied Y slot on the canvas */
function findFreeY(canvas: any, objH = 60): number {
  const canvasH = canvas.getHeight()
  for (let y = 60; y < canvasH - objH; y += 80) {
    const hit = canvas.getObjects().some((o: any) => {
      const top = o.top ?? 0
      const bot = top + (o.height ?? 0) * (o.scaleY ?? 1)
      return y < bot + 20 && y + objH > top - 20
    })
    if (!hit) return y
  }
  return canvasH / 4
}

export default function AIComposerPanel(_props: AIComposerPanelProps) {
  const { isFeatureAllowed } = useAuthStore()
  const { fabricCanvas } = useEditorStore()

  const [tab, setTab] = useState<'copy' | 'composer'>('copy')
  const canUseAI = isFeatureAllowed('ai_copy') || isFeatureAllowed('ai_composer')

  /* ── Copy tab state ─────────────────────────────────────────────── */
  const [appDescription, setAppDescription] = useState('')
  const [appCategory, setAppCategory]       = useState('Productivity')
  const [copyStyle, setCopyStyle]           = useState<'benefit' | 'feature' | 'social_proof'>('benefit')
  const [suggestions, setSuggestions]       = useState<CopySuggestion[]>([])
  const [copyLoading, setCopyLoading]       = useState(false)
  const [copyError, setCopyError]           = useState<string | null>(null)
  const [history, setHistory]               = useState<CopySuggestion[][]>([])
  const [showHistory, setShowHistory]       = useState(false)

  /* ── Composer tab state ─────────────────────────────────────────── */
  const composerFileRef                     = useRef<HTMLInputElement>(null)
  const [composerFiles, setComposerFiles]   = useState<File[]>([])
  const [composerDesc, setComposerDesc]     = useState('')
  const [composerCat, setComposerCat]       = useState('Productivity')
  const [composerLoading, setComposerLoading] = useState(false)
  const [composerStep, setComposerStep]     = useState('')
  const [composeResult, setComposeResult]   = useState<ComposeResult | null>(null)
  const [composerError, setComposerError]   = useState<string | null>(null)
  const [previewUrls, setPreviewUrls]       = useState<string[]>([])

  /* ── Generate copy headlines ─────────────────────────────────────── */
  const generateCopy = useCallback(async () => {
    if (!appDescription.trim()) { toast.error('Describe your app first'); return }
    setCopyLoading(true); setCopyError(null); setSuggestions([])
    try {
      const { data, error } = await supabase.functions.invoke('ai-copy', {
        body: { appDescription, appCategory, copyStyle },
      })
      if (error) throw new Error((error as any)?.message || JSON.stringify(error))
      if (data?.error) throw new Error(data.error)
      const list: CopySuggestion[] = data?.suggestions ?? []
      if (!list.length) throw new Error('No suggestions returned. Try a more specific description.')
      setSuggestions(list)
      setHistory(prev => [list, ...prev].slice(0, 3))
    } catch (err: any) {
      const msg = err?.message || 'AI generation failed. Please try again.'
      setCopyError(msg); toast.error(msg)
    } finally { setCopyLoading(false) }
  }, [appDescription, appCategory, copyStyle])

  /* ── Apply single suggestion to canvas ──────────────────────────── */
  const applyText = useCallback((text: string) => {
    if (!fabricCanvas) { toast.error('Canvas not ready'); return }
    const y = findFreeY(fabricCanvas)
    const obj = new IText(text, {
      left: fabricCanvas.getWidth() / 2, top: y,
      originX: 'center',
      fontFamily: 'Inter, sans-serif', fontSize: 32,
      fill: '#ffffff', fontWeight: 'bold', textAlign: 'center',
      width: Math.min(fabricCanvas.getWidth() - 48, 320),
    })
    fabricCanvas.add(obj)
    fabricCanvas.setActiveObject(obj)
    fabricCanvas.renderAll()
    toast.success('Headline added to canvas')
  }, [fabricCanvas])

  /* ── Apply ALL suggestions to canvas ───────────────────────────── */
  const applyAll = useCallback(() => {
    if (!fabricCanvas || !suggestions.length) return
    const canvasW = fabricCanvas.getWidth()
    suggestions.forEach((sug, i) => {
      const obj = new IText(sug.text, {
        left: canvasW / 2, top: 60 + i * 80,
        originX: 'center',
        fontFamily: 'Inter, sans-serif', fontSize: 28,
        fill: '#ffffff', fontWeight: 'bold', textAlign: 'center',
        width: Math.min(canvasW - 48, 320),
      })
      fabricCanvas.add(obj)
    })
    fabricCanvas.renderAll()
    toast.success(`${suggestions.length} headlines added to canvas`)
  }, [fabricCanvas, suggestions])

  /* ── Composer: handle file selection ────────────────────────────── */
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter(f => {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name}: not an image`); return false }
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name}: exceeds 5 MB`); return false }
      return true
    })
    const added = [...composerFiles, ...valid].slice(0, 5)
    setComposerFiles(added)
    // Build preview URLs
    setPreviewUrls(added.map(f => URL.createObjectURL(f)))
    if (valid.length) toast.success(`${valid.length} screenshot(s) added`)
  }

  const removeFile = (i: number) => {
    const updated = composerFiles.filter((_, j) => j !== i)
    setComposerFiles(updated)
    setPreviewUrls(updated.map(f => URL.createObjectURL(f)))
  }

  /* ── Composer: generate composition ─────────────────────────────── */
  const generateComposition = useCallback(async () => {
    if (!composerFiles.length) { toast.error('Upload at least one screenshot first'); return }
    setComposerLoading(true); setComposerError(null); setComposeResult(null)

    // Cycle through loading steps for UX
    let stepIdx = 0
    setComposerStep(COMPOSE_STEPS[0])
    const stepTimer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, COMPOSE_STEPS.length - 1)
      setComposerStep(COMPOSE_STEPS[stepIdx])
    }, 2000)

    try {
      // Resize images client-side before sending
      const resized = await Promise.all(composerFiles.map(f => resizeImage(f, 768)))

      const { data, error } = await supabase.functions.invoke('ai-copy', {
        body: { action: 'compose', screenshots: resized, appDescription: composerDesc, appCategory: composerCat },
      })
      if (error) throw new Error((error as any)?.message || JSON.stringify(error))
      if (data?.error) throw new Error(data.error)
      setComposeResult(data as ComposeResult)
      toast.success('Composition generated!')
    } catch (err: any) {
      const msg = err?.message || 'Composition failed. Please try again.'
      setComposerError(msg); toast.error(msg)
    } finally {
      clearInterval(stepTimer)
      setComposerLoading(false); setComposerStep('')
    }
  }, [composerFiles, composerDesc, composerCat])

  /* ── Composer: apply a slide to canvas ──────────────────────────── */
  const applySlide = useCallback(async (slide: ComposeSlide, fileIdx: number) => {
    if (!fabricCanvas) { toast.error('Canvas not ready'); return }
    const file = composerFiles[fileIdx]
    if (!file) return

    const dataUrl = await resizeImage(file, 1200)
    const canvasW = fabricCanvas.getWidth()
    const canvasH = fabricCanvas.getHeight()

    // Clear first, then set background (clear() resets backgroundColor)
    fabricCanvas.clear()
    ;(fabricCanvas as any).backgroundColor = slide.backgroundColor
    fabricCanvas.renderAll()

    // Load screenshot image
    try {
      const img = await FabricImage.fromURL(dataUrl)
      const scale = Math.min((canvasW * 0.7) / img.width!, (canvasH * 0.55) / img.height!, 1)
      img.scale(scale)
      img.set({ left: canvasW / 2, top: canvasH / 2 + 40, originX: 'center', originY: 'center' })
      fabricCanvas.add(img)
    } catch { console.warn('Image load failed') }

    // Headline
    fabricCanvas.add(new IText(slide.headline, {
      left: canvasW / 2, top: 60, originX: 'center',
      fontFamily: 'Inter, sans-serif', fontSize: 36,
      fill: '#ffffff', fontWeight: 'bold', textAlign: 'center',
      width: canvasW - 48,
    }))
    // Subheadline
    fabricCanvas.add(new IText(slide.subheadline, {
      left: canvasW / 2, top: 110, originX: 'center',
      fontFamily: 'Inter, sans-serif', fontSize: 20,
      fill: 'rgba(255,255,255,0.75)', fontWeight: 'normal', textAlign: 'center',
      width: canvasW - 48,
    }))

    fabricCanvas.renderAll()
    toast.success(`Slide ${slide.index + 1} applied to canvas`)
  }, [fabricCanvas, composerFiles])

  /* ── Render ─────────────────────────────────────────────────────── */
  return (
    <div className="card-glass rounded-2xl overflow-hidden shadow-card-hover"
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-700/50 flex-shrink-0">
        <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center">
          <Wand2 className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-semibold text-sm text-white">AI Assistant</span>
        <span className="badge-brand text-[10px]">Beta</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700/50 flex-shrink-0">
        {[{ id: 'copy', label: '✍️ Copy' }, { id: 'composer', label: '🎨 Composer' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={clsx('flex-1 py-2 text-xs font-medium transition-colors border-b-2',
              tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-surface-500 hover:text-surface-300'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* ── Upgrade gate ─────────────────────────────────────── */}
        {!canUseAI ? (
          <div className="text-center py-4">
            <Sparkles className="w-6 h-6 text-surface-600 mx-auto mb-2" />
            <p className="text-xs text-surface-400 mb-3">AI features require an Indie plan or higher</p>
            <button onClick={() => window.location.href = '/snapstore/pricing'} className="btn-gradient btn-sm w-full">
              Upgrade to Indie — ₹9.99/mo
            </button>
          </div>

        /* ── Copy Tab ─────────────────────────────────────────── */
        ) : tab === 'copy' ? (
          <>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="label">App Description</label>
                <span className={clsx('text-[10px] tabular-nums', appDescription.length > 1800 ? 'text-accent-red' : 'text-surface-600')}>
                  {appDescription.length}/2000
                </span>
              </div>
              <textarea value={appDescription} onChange={e => setAppDescription(e.target.value.slice(0, 2000))}
                placeholder="e.g. A habit tracker with streaks, reminders and analytics"
                className="input text-xs resize-none h-20" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Category</label>
                <select value={appCategory} onChange={e => setAppCategory(e.target.value)} className="input-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Copy Style</label>
                <select value={copyStyle} onChange={e => setCopyStyle(e.target.value as any)} className="input-sm">
                  <option value="benefit">Benefit-led</option>
                  <option value="feature">Feature-led</option>
                  <option value="social_proof">Social proof</option>
                </select>
              </div>
            </div>

            <button onClick={generateCopy} disabled={copyLoading || !appDescription.trim()} className="btn-gradient btn-sm w-full">
              {copyLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Generating…</> : <><Sparkles className="w-3.5 h-3.5" />Generate Headlines</>}
            </button>

            {/* Error */}
            {copyError && !copyLoading && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-red/10 border border-accent-red/20">
                <AlertCircle className="w-3.5 h-3.5 text-accent-red flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-300 leading-relaxed">{copyError}</p>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wide">Suggestions — click to add</p>
                  <button onClick={generateCopy} disabled={copyLoading}
                    className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50">
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>

                {suggestions.map((sug, i) => (
                  <div key={i} onClick={() => applyText(sug.text)}
                    className="group relative bg-surface-800/60 rounded-xl p-3 cursor-pointer hover:bg-surface-700/60 transition-colors border border-surface-700/50 hover:border-brand-600/40">
                    <p className="text-xs text-surface-100 leading-relaxed pr-6">{sug.text}</p>
                    <p className="text-[10px] text-surface-600 mt-1">
                      {sug.charCount} chars · {sug.style.replace('_', ' ')}
                      {sug.charCount > 40 && <span className="text-accent-amber ml-1">· over 40-char guideline</span>}
                    </p>
                    <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(sug.text); toast.success('Copied!') }}
                      className="absolute top-2 right-2 p-1 rounded text-surface-600 hover:text-surface-300 opacity-0 group-hover:opacity-100 transition-all" title="Copy">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Apply All */}
                <button onClick={applyAll} className="btn-secondary btn-sm w-full">
                  <Check className="w-3.5 h-3.5" /> Apply All to Canvas
                </button>
              </div>
            )}

            {/* History */}
            {history.length > 1 && (
              <div className="border-t border-surface-700/50 pt-2">
                <button onClick={() => setShowHistory(s => !s)}
                  className="flex items-center gap-1.5 text-[10px] text-surface-500 hover:text-surface-300 transition-colors w-full">
                  {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Previous generations ({history.length - 1})
                </button>
                {showHistory && history.slice(1).map((batch, bi) => (
                  <div key={bi} className="mt-2 space-y-1 pl-2 border-l border-surface-700">
                    {batch.map((sug, si) => (
                      <div key={si} onClick={() => applyText(sug.text)}
                        className="text-xs text-surface-500 cursor-pointer hover:text-surface-200 transition-colors py-0.5 truncate" title={sug.text}>
                        {sug.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>

        /* ── Composer Tab ─────────────────────────────────────── */
        ) : (
          <div className="space-y-3">
            {/* Description */}
            <div>
              <label className="label">App Description <span className="text-surface-600">(optional)</span></label>
              <textarea value={composerDesc} onChange={e => setComposerDesc(e.target.value.slice(0, 2000))}
                placeholder="Briefly describe your app to improve AI recommendations…"
                className="input text-xs resize-none h-14" />
            </div>

            <div>
              <label className="label">Category</label>
              <select value={composerCat} onChange={e => setComposerCat(e.target.value)} className="input-sm w-full">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* File previews */}
            {composerFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {composerFiles.map((f, i) => (
                  <div key={i} className="relative aspect-[9/16] rounded-lg overflow-hidden border border-surface-700/50 bg-surface-800">
                    {previewUrls[i] && <img src={previewUrls[i]} alt={f.name} className="w-full h-full object-cover" />}
                    <button onClick={() => removeFile(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] text-white bg-black/60 rounded px-1">
                      #{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* File input */}
            <input ref={composerFileRef} type="file" accept="image/png,image/jpeg,image/webp"
              multiple className="hidden" onChange={handleFiles} />

            <button onClick={() => composerFileRef.current?.click()}
              disabled={composerFiles.length >= 5}
              className="btn-secondary btn-sm w-full">
              {composerFiles.length >= 5 ? '5/5 max reached' : `+ Upload Screenshots (${composerFiles.length}/5)`}
            </button>

            {/* Generate */}
            {composerFiles.length > 0 && !composeResult && (
              <button onClick={generateComposition} disabled={composerLoading} className="btn-gradient btn-sm w-full">
                {composerLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />{composerStep || 'Analysing…'}</>
                  : <><Sparkles className="w-3.5 h-3.5" />Analyse & Generate</>}
              </button>
            )}

            {/* Composer error */}
            {composerError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-red/10 border border-accent-red/20">
                <AlertCircle className="w-3.5 h-3.5 text-accent-red flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-300 leading-relaxed">{composerError}</p>
              </div>
            )}

            {/* Results */}
            {composeResult && (
              <div className="space-y-4 pt-1">
                {/* Regenerate button */}
                <button onClick={() => { setComposeResult(null); generateComposition() }}
                  disabled={composerLoading}
                  className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50 w-full justify-end">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>

                {/* App insights */}
                <div className="p-3 rounded-xl bg-surface-800/60 border border-surface-700/50">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">App Insights</p>
                  <p className="text-[11px] text-surface-300 leading-relaxed">{composeResult.appInsights}</p>
                  <p className="text-[10px] text-surface-600 mt-1">Tone: {composeResult.overallTone}</p>
                </div>

                {/* Colour palette */}
                <div>
                  <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-2">Colour Palette — click to apply</p>
                  <div className="flex gap-2">
                    {(composeResult.palette ?? []).map((c, i) => (
                      <button key={i} title={`${c.label} ${c.hex}`}
                        onClick={() => {
                          if (!fabricCanvas) return
                          ;(fabricCanvas as any).backgroundColor = c.hex
                          fabricCanvas.renderAll()
                          toast.success(`Background: ${c.label}`)
                        }}
                        className="flex-1 flex flex-col items-center gap-1 group">
                        <div className="w-full h-8 rounded-lg border border-white/10 group-hover:ring-2 group-hover:ring-white/40 transition-all"
                          style={{ backgroundColor: c.hex }} />
                        <span className="text-[9px] text-surface-600 truncate w-full text-center">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Per-slide suggestions */}
                <div>
                  <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-2">Screenshot Recommendations</p>
                  <div className="space-y-3">
                    {(composeResult.slides ?? []).map((slide, i) => (
                      <div key={i} className="rounded-xl border border-surface-700/50 bg-surface-800/60 overflow-hidden">
                        {/* Slide header */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-700/40"
                          style={{ background: `${slide.backgroundColor}22` }}>
                          <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: slide.backgroundColor }} />
                          <span className="text-[10px] font-semibold text-surface-300">Screenshot {i + 1}</span>
                        </div>
                        <div className="p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-surface-100">{slide.headline}</p>
                          <p className="text-[11px] text-surface-400">{slide.subheadline}</p>
                          <p className="text-[10px] text-surface-600 italic">{slide.layoutTip}</p>
                          <button onClick={() => applySlide(slide, i)}
                            className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-semibold text-white transition-colors"
                            style={{ background: slide.backgroundColor || '#4f46e5' }}>
                            Apply to Canvas
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div className="p-3 rounded-xl bg-gradient-brand/10 border border-brand-500/20">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wide mb-1">Suggested CTA</p>
                  <p className="text-xs font-bold text-brand-300">{composeResult.cta}</p>
                  <button onClick={() => applyText(composeResult.cta)}
                    className="mt-2 text-[10px] text-brand-400 hover:text-brand-300 transition-colors">
                    + Add to canvas
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
