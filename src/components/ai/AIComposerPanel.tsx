import { useState, useRef, useCallback } from 'react'
import {
  Wand2, Sparkles, Loader2, Copy, Image as ImageIcon,
  RefreshCw, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useEditorStore } from '../../stores/editorStore'
import { supabase } from '../../lib/supabase'
import { IText } from 'fabric'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface AIComposerPanelProps {
  projectId?: string
}

interface CopySuggestion {
  text: string
  style: 'benefit' | 'feature' | 'social_proof'
  charCount: number
}

const CATEGORIES = [
  'Productivity', 'Health & Fitness', 'Finance', 'Education',
  'Social', 'Gaming', 'Travel', 'Shopping', 'Food & Drink',
  'Entertainment', 'Utilities', 'Lifestyle',
]

/** Find a free vertical position on the canvas that doesn't overlap existing objects */
function findFreeYPosition(canvas: any, objHeight = 60): number {
  const canvasH = canvas.getHeight()
  const objects = canvas.getObjects()

  // Probe every 80px from top, pick first slot with no overlap
  for (let y = 60; y < canvasH - objHeight; y += 80) {
    const occupied = objects.some((o: any) => {
      const top = o.top ?? 0
      const bot = top + (o.height ?? 0) * (o.scaleY ?? 1)
      return y < bot + 20 && y + objHeight > top - 20
    })
    if (!occupied) return y
  }
  // Fallback: center
  return canvasH / 4
}

export default function AIComposerPanel(_props: AIComposerPanelProps) {
  const { isFeatureAllowed } = useAuthStore()
  const { fabricCanvas } = useEditorStore()

  const [tab, setTab] = useState<'copy' | 'composer'>('copy')

  // Copy tab state
  const [appDescription, setAppDescription] = useState('')
  const [appCategory, setAppCategory] = useState('Productivity')
  const [copyStyle, setCopyStyle] = useState<'benefit' | 'feature' | 'social_proof'>('benefit')
  const [suggestions, setSuggestions] = useState<CopySuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<CopySuggestion[][]>([])

  // Composer tab state
  const composerFileRef = useRef<HTMLInputElement>(null)
  const [composerFiles, setComposerFiles] = useState<File[]>([])
  const [composerLoading, setComposerLoading] = useState(false)

  const canUseAI = isFeatureAllowed('ai_copy') || isFeatureAllowed('ai_composer')

  // ── Generate copy ──────────────────────────────────────────────────
  const generateCopy = useCallback(async () => {
    if (!appDescription.trim()) { toast.error('Describe your app first'); return }
    setIsLoading(true)
    setLastError(null)
    setSuggestions([])

    try {
      const { data, error } = await supabase.functions.invoke('ai-copy', {
        body: { appDescription, appCategory, copyStyle },
      })

      if (error) {
        // supabase.functions.invoke wraps HTTP errors — try to extract message
        const msg = (error as any)?.message
          || (typeof error === 'object' ? JSON.stringify(error) : String(error))
        throw new Error(msg)
      }

      // The function might return a top-level `error` field on 403/500 too
      if (data?.error) throw new Error(data.error)

      const newSuggestions: CopySuggestion[] = data?.suggestions ?? []
      if (newSuggestions.length === 0) {
        throw new Error('No suggestions returned. Please try a more specific description.')
      }

      setSuggestions(newSuggestions)
      // Push to history (keep last 3 sets)
      setHistory(prev => [newSuggestions, ...prev].slice(0, 3))
    } catch (err: any) {
      const msg = err?.message || 'AI generation failed. Please try again.'
      setLastError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [appDescription, appCategory, copyStyle])

  // ── Apply suggestion to canvas ─────────────────────────────────────
  const applyTextToCanvas = useCallback((text: string) => {
    if (!fabricCanvas) { toast.error('Canvas not ready'); return }

    const freeY = findFreeYPosition(fabricCanvas)
    const canvasW = fabricCanvas.getWidth()

    const textObj = new IText(text, {
      left: canvasW / 2,
      top: freeY,
      originX: 'center',
      fontFamily: 'Inter, sans-serif',
      fontSize: 32,
      fill: '#ffffff',
      fontWeight: 'bold',
      textAlign: 'center',
      width: Math.min(canvasW - 48, 320),
    })
    fabricCanvas.add(textObj)
    fabricCanvas.setActiveObject(textObj)
    fabricCanvas.renderAll()
    toast.success('Headline added to canvas')
  }, [fabricCanvas])

  // ── Handle composer file selection ─────────────────────────────────
  const handleComposerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const validFiles = files.filter(f => {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name} is not an image`); return false }
      if (f.size > 5 * 1024 * 1024) { toast.error(`${f.name} exceeds 5 MB`); return false }
      return true
    })

    setComposerFiles(prev => [...prev, ...validFiles].slice(0, 5))
    if (validFiles.length > 0) toast.success(`${validFiles.length} screenshot(s) added`)
  }

  const handleComposerGenerate = async () => {
    if (composerFiles.length === 0) { toast.error('Upload at least one screenshot first'); return }
    setComposerLoading(true)
    // Simulated delay — real AI composition backend is Phase 2
    await new Promise(r => setTimeout(r, 1500))
    setComposerLoading(false)
    toast('AI Composer is coming soon! Your screenshots have been queued.', { icon: '🚀' })
  }

  return (
    <div className="card-glass rounded-2xl overflow-hidden shadow-card-hover" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-white">AI Assistant</span>
          <span className="badge-brand text-[10px]">Beta</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700/50 flex-shrink-0">
        {[
          { id: 'copy',     label: '✍️ Copy' },
          { id: 'composer', label: '🎨 Composer' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={clsx(
              'flex-1 py-2 text-xs font-medium transition-colors border-b-2',
              tab === t.id
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-surface-500 hover:text-surface-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!canUseAI ? (
          <div className="text-center py-4">
            <Sparkles className="w-6 h-6 text-surface-600 mx-auto mb-2" />
            <p className="text-xs text-surface-400 mb-3">AI features require an Indie plan or higher</p>
            <button
              onClick={() => window.location.href = '/snapstore/pricing'}
              className="btn-gradient btn-sm w-full"
            >
              Upgrade to Indie — ₹9.99/mo
            </button>
          </div>

        ) : tab === 'copy' ? (
          <>
            {/* App Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label">App Description</label>
                <span className={clsx(
                  'text-[10px] tabular-nums',
                  appDescription.length > 220 ? 'text-accent-red' : 'text-surface-600'
                )}>
                  {appDescription.length}/250
                </span>
              </div>
              <textarea
                value={appDescription}
                onChange={e => setAppDescription(e.target.value.slice(0, 250))}
                placeholder="e.g. A habit tracker that helps you build healthy routines with streaks and reminders"
                className="input text-xs resize-none h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Category</label>
                <select
                  value={appCategory}
                  onChange={e => setAppCategory(e.target.value)}
                  className="input-sm"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Copy Style</label>
                <select
                  value={copyStyle}
                  onChange={e => setCopyStyle(e.target.value as any)}
                  className="input-sm"
                >
                  <option value="benefit">Benefit-led</option>
                  <option value="feature">Feature-led</option>
                  <option value="social_proof">Social proof</option>
                </select>
              </div>
            </div>

            <button
              onClick={generateCopy}
              disabled={isLoading || !appDescription.trim()}
              className="btn-gradient btn-sm w-full"
            >
              {isLoading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                : <><Sparkles className="w-3.5 h-3.5" /> Generate Headlines</>
              }
            </button>

            {/* Error display */}
            {lastError && !isLoading && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-red/10 border border-accent-red/20">
                <AlertCircle className="w-3.5 h-3.5 text-accent-red flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-300 leading-relaxed">{lastError}</p>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-surface-500 uppercase tracking-wide">
                    Suggestions — click to add to canvas
                  </p>
                  <button
                    onClick={generateCopy}
                    disabled={isLoading}
                    className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50"
                    title="Regenerate"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>

                {suggestions.map((sug, i) => (
                  <div
                    key={i}
                    className="group relative bg-surface-800/60 rounded-xl p-3 cursor-pointer hover:bg-surface-700/60 transition-colors border border-surface-700/50 hover:border-brand-600/40"
                    onClick={() => applyTextToCanvas(sug.text)}
                  >
                    <p className="text-xs text-surface-100 leading-relaxed pr-6">{sug.text}</p>
                    <p className="text-[10px] text-surface-600 mt-1">
                      {sug.charCount} chars · {sug.style.replace('_', ' ')}
                      {sug.charCount > 40 && (
                        <span className="text-accent-amber ml-1">· exceeds 40-char guideline</span>
                      )}
                    </p>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(sug.text)
                        toast.success('Copied to clipboard!')
                      }}
                      className="absolute top-2 right-2 p-1 rounded text-surface-600 hover:text-surface-300 opacity-0 group-hover:opacity-100 transition-all"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* History accordion */}
            {history.length > 1 && (
              <div className="border-t border-surface-700/50 pt-2">
                <button
                  onClick={() => setShowHistory(s => !s)}
                  className="flex items-center gap-1.5 text-[10px] text-surface-500 hover:text-surface-300 transition-colors w-full"
                >
                  {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Previous generations ({history.length - 1})
                </button>
                {showHistory && history.slice(1).map((batch, bi) => (
                  <div key={bi} className="mt-2 space-y-1.5 pl-2 border-l border-surface-700">
                    {batch.map((sug, si) => (
                      <div
                        key={si}
                        className="text-xs text-surface-400 cursor-pointer hover:text-surface-200 transition-colors py-0.5"
                        onClick={() => applyTextToCanvas(sug.text)}
                        title="Click to add to canvas"
                      >
                        {sug.text}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>

        ) : (
          /* ── Composer Tab ───────────────────────────────────── */
          <div className="space-y-3">
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-brand/20 border border-brand-500/30 flex items-center justify-center mx-auto mb-3">
                <ImageIcon className="w-6 h-6 text-brand-400" />
              </div>
              <p className="text-xs font-semibold text-surface-200 mb-1">AI Composer</p>
              <p className="text-[11px] text-surface-500 leading-relaxed">
                Upload up to 5 app screenshots and AI will compose them into polished App Store assets with frames, backgrounds, and copy.
              </p>
            </div>

            {/* File list */}
            {composerFiles.length > 0 && (
              <div className="space-y-1.5">
                {composerFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-surface-800/60 border border-surface-700/50">
                    <span className="text-surface-300 truncate flex-1">{f.name}</span>
                    <button
                      onClick={() => setComposerFiles(prev => prev.filter((_, j) => j !== i))}
                      className="text-surface-600 hover:text-red-400 ml-2 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={composerFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleComposerFileChange}
            />

            <button
              onClick={() => composerFileRef.current?.click()}
              className="btn-secondary btn-sm w-full"
              disabled={composerFiles.length >= 5}
            >
              {composerFiles.length >= 5 ? 'Maximum 5 screenshots' : '+ Upload Screenshots'}
            </button>

            {composerFiles.length > 0 && (
              <button
                onClick={handleComposerGenerate}
                disabled={composerLoading}
                className="btn-gradient btn-sm w-full"
              >
                {composerLoading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Composing…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Generate Composition</>
                }
              </button>
            )}

            <p className="text-[10px] text-surface-600 text-center">
              Full AI composition — coming in the next update 🚀
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
