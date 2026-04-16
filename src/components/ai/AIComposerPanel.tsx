import { useState } from 'react'
import { Wand2, Sparkles, Loader2, Copy, Image as ImageIcon } from 'lucide-react'
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

export default function AIComposerPanel(_props: AIComposerPanelProps) {
  const { isFeatureAllowed } = useAuthStore()
  const { fabricCanvas } = useEditorStore()

  const [tab, setTab] = useState<'composer' | 'copy'>('copy')
  const [appDescription, setAppDescription] = useState('')
  const [appCategory, setAppCategory] = useState('Productivity')
  const [copyStyle, setCopyStyle] = useState<'benefit' | 'feature' | 'social_proof'>('benefit')
  const [suggestions, setSuggestions] = useState<CopySuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const canUseAI = isFeatureAllowed('ai_copy') || isFeatureAllowed('ai_composer')

  const generateCopy = async () => {
    if (!appDescription.trim()) { toast.error('Describe your app first'); return }
    setIsLoading(true)
    setSuggestions([])
    try {
      const { data, error } = await supabase.functions.invoke('ai-copy', {
        body: { appDescription, appCategory, copyStyle },
      })
      if (error) throw error
      setSuggestions(data?.suggestions ?? [])
    } catch (err: any) {
      toast.error(err.message || 'AI generation failed')
    } finally {
      setIsLoading(false)
    }
  }

  const applyTextToCanvas = (text: string) => {
    if (!fabricCanvas) return
    const textObj = new IText(text, {
      left: fabricCanvas.getWidth() / 2 - 150,
      top: fabricCanvas.getHeight() / 4,
      fontFamily: 'Inter, sans-serif',
      fontSize: 36,
      fill: '#ffffff',
      fontWeight: 'bold',
      textAlign: 'center',
      width: 300,
    })
    fabricCanvas.add(textObj)
    fabricCanvas.setActiveObject(textObj)
    fabricCanvas.renderAll()
    toast.success('Text added to canvas')
  }

  return (
    <div className="card-glass rounded-2xl overflow-hidden shadow-card-hover">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-700/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center">
            <Wand2 className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm text-white">AI Assistant</span>
          <span className="badge-brand text-[10px]">Beta</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-700/50">
        {[
          { id: 'copy', label: '✍️ Copy' },
          { id: 'composer', label: '🎨 Composer' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={clsx(
              'flex-1 py-2 text-xs font-medium transition-colors border-b-2',
              tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-surface-500 hover:text-surface-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {!canUseAI ? (
          <div className="text-center py-4">
            <Sparkles className="w-6 h-6 text-surface-600 mx-auto mb-2" />
            <p className="text-xs text-surface-400 mb-3">AI features require an Indie plan or higher</p>
            <button onClick={() => window.location.href = '/pricing'} className="btn-gradient btn-sm w-full">
              Upgrade to Indie — $9/mo
            </button>
          </div>
        ) : tab === 'copy' ? (
          <>
            <div>
              <label className="label">App Description</label>
              <textarea
                value={appDescription}
                onChange={e => setAppDescription(e.target.value)}
                placeholder="e.g. A habit tracker that helps you build healthy routines with streaks and reminders"
                className="input text-xs resize-none h-20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Category</label>
                <select value={appCategory} onChange={e => setAppCategory(e.target.value)} className="input-sm">
                  {['Productivity', 'Health', 'Finance', 'Education', 'Social', 'Gaming', 'Travel', 'Shopping'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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

            <button
              onClick={generateCopy}
              disabled={isLoading || !appDescription.trim()}
              className="btn-gradient btn-sm w-full"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Generate Headlines
            </button>

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2 mt-1">
                <p className="text-[10px] text-surface-500 uppercase tracking-wide">Suggestions — click to add to canvas</p>
                {suggestions.map((sug, i) => (
                  <div
                    key={i}
                    className="group relative bg-surface-800/60 rounded-xl p-3 cursor-pointer hover:bg-surface-700/60 transition-colors border border-surface-700/50 hover:border-brand-600/40"
                    onClick={() => applyTextToCanvas(sug.text)}
                  >
                    <p className="text-xs text-surface-100 leading-relaxed pr-6">{sug.text}</p>
                    <p className="text-[10px] text-surface-600 mt-1">{sug.charCount} chars · {sug.style}</p>
                    <button
                      onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(sug.text); toast.success('Copied!') }}
                      className="absolute top-2 right-2 p-1 rounded text-surface-600 hover:text-surface-300 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <ImageIcon className="w-8 h-8 text-surface-600 mx-auto mb-2" />
            <p className="text-xs text-surface-400 mb-1">AI Composer</p>
            <p className="text-[10px] text-surface-600">Upload your app screenshots to generate complete screenshot compositions</p>
            <button className="btn-secondary btn-sm mt-3 w-full">Upload Screenshots</button>
          </div>
        )}
      </div>
    </div>
  )
}
