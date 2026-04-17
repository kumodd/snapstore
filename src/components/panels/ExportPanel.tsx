import { useState } from 'react'
import { X, Download, Image as ImageIcon, FileImage, Archive, Loader2, CheckCircle2 } from 'lucide-react'
import { useEditorStore } from '../../stores/editorStore'
import { useSlideStore } from '../../stores/slideStore'
import clsx from 'clsx'

interface ExportPanelProps {
  onClose: () => void
  projectName: string
}

type Format = 'PNG' | 'JPEG' | 'SVG'
type Scale = 1 | 2 | 3
type ExportScope = 'current' | 'all'

const FORMAT_OPTIONS: { id: Format; label: string; icon: typeof ImageIcon; desc: string }[] = [
  { id: 'PNG',  label: 'PNG',  icon: ImageIcon,  desc: 'Lossless · supports transparency' },
  { id: 'JPEG', label: 'JPEG', icon: FileImage,  desc: 'Smaller file · great for photos' },
  { id: 'SVG',  label: 'SVG',  icon: Archive,    desc: 'Vector · infinite resolution' },
]

const SCALE_OPTIONS: Scale[] = [1, 2, 3]

export default function ExportPanel({ onClose, projectName }: ExportPanelProps) {
  const { fabricCanvas } = useEditorStore()
  const { slides, activeSlideId } = useSlideStore()

  const [format, setFormat] = useState<Format>('PNG')
  const [scale, setScale] = useState<Scale>(2)
  const [quality, setQuality] = useState(0.92)
  const [scope, setScope] = useState<ExportScope>('current')
  const [isExporting, setIsExporting] = useState(false)
  const [done, setDone] = useState(false)

  const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9-_]/g, '_')

  const downloadDataURL = (dataURL: string, filename: string) => {
    const a = document.createElement('a')
    a.href = dataURL
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const exportCurrentSlide = async () => {
    if (!fabricCanvas) return

    if (format === 'SVG') {
      const svg = fabricCanvas.toSVG()
      const blob = new Blob([svg], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      downloadDataURL(url, `${safeFileName(projectName)}_slide.svg`)
      URL.revokeObjectURL(url)
      return
    }

    const dataURL = fabricCanvas.toDataURL({
      format: format === 'PNG' ? 'png' : 'jpeg',
      quality: format === 'JPEG' ? quality : 1,
      multiplier: scale,
    })
    const ext = format.toLowerCase()
    const slideLabel = slides.find(s => s.id === activeSlideId)?.title ?? 'slide'
    downloadDataURL(dataURL, `${safeFileName(projectName)}_${safeFileName(slideLabel)}.${ext}`)
  }

  const exportAllSlides = async () => {
    if (!fabricCanvas) return

    let JSZip: any
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      JSZip = (await import(/* @vite-ignore */ 'jszip')).default
    } catch {
      // Fallback: download individually if JSZip unavailable
      for (const slide of slides) {
        if (slide.canvas_state && Object.keys(slide.canvas_state).length > 0) {
          await fabricCanvas.loadFromJSON(slide.canvas_state as any)
          fabricCanvas.renderAll()
        }
        const dataURL = fabricCanvas.toDataURL({
          format: format === 'PNG' ? 'png' : 'jpeg',
          quality: format === 'JPEG' ? quality : 1,
          multiplier: scale,
        })
        const num = String(slide.position + 1).padStart(2, '0')
        downloadDataURL(dataURL, `${safeFileName(projectName)}_${num}_${safeFileName(slide.title)}.${format.toLowerCase()}`)
      }
      return
    }

    const zip = new JSZip()
    const folder = zip.folder(safeFileName(projectName))

    for (const slide of slides) {
      if (slide.canvas_state && Object.keys(slide.canvas_state).length > 0) {
        await fabricCanvas.loadFromJSON(slide.canvas_state as any)
        fabricCanvas.renderAll()
      }
      const num = String(slide.position + 1).padStart(2, '0')
      const base = `${num}_${safeFileName(slide.title)}`

      if (format === 'SVG') {
        folder?.file(`${base}.svg`, fabricCanvas.toSVG())
      } else {
        const dataURL = fabricCanvas.toDataURL({
          format: format === 'PNG' ? 'png' : 'jpeg',
          quality: format === 'JPEG' ? quality : 1,
          multiplier: scale,
        })
        folder?.file(`${base}.${format.toLowerCase()}`, dataURL.split(',')[1], { base64: true })
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    downloadDataURL(url, `${safeFileName(projectName)}_all_slides.zip`)
    URL.revokeObjectURL(url)
  }

  const handleExport = async () => {
    setIsExporting(true)
    setDone(false)
    try {
      if (scope === 'current' || slides.length <= 1) {
        await exportCurrentSlide()
      } else {
        await exportAllSlides()
      }
      setDone(true)
      setTimeout(() => setDone(false), 2500)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const canvasW = fabricCanvas?.getWidth() ?? 390
  const canvasH = fabricCanvas?.getHeight() ?? 844

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      style={{ background: '#111827', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <Download className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Export</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Format */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Format</p>
          <div className="grid grid-cols-3 gap-1.5">
            {FORMAT_OPTIONS.map(f => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={clsx(
                  'flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all text-center',
                  format === f.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                    : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                )}
              >
                <f.icon className="w-4 h-4" />
                <span className="text-[11px] font-semibold">{f.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">
            {FORMAT_OPTIONS.find(f => f.id === format)?.desc}
          </p>
        </div>

        {/* Scale */}
        {format !== 'SVG' && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Resolution</p>
            <div className="grid grid-cols-3 gap-1.5">
              {SCALE_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={clsx(
                    'py-2 rounded-xl border text-xs font-semibold transition-all',
                    scale === s
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  )}
                >
                  {s}×
                  <span className="block text-[9px] font-normal text-slate-600 mt-0.5">
                    {canvasW * s}×{canvasH * s}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* JPEG Quality */}
        {format === 'JPEG' && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Quality ({Math.round(quality * 100)}%)
            </p>
            <input
              type="range"
              min={0.1} max={1} step={0.01}
              value={quality}
              onChange={e => setQuality(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
        )}

        {/* Scope */}
        {slides.length > 1 && (
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Slides</p>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { id: 'current' as const, label: 'Current slide' },
                { id: 'all' as const, label: `All ${slides.length} (ZIP)` },
              ]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setScope(opt.id)}
                  className={clsx(
                    'py-2 px-3 rounded-xl border text-xs font-medium transition-all text-left',
                    scope === opt.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                      : 'border-white/10 text-slate-400 hover:border-white/20'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Export button */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          className={clsx(
            'w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all',
            done
              ? 'bg-emerald-600 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
          )}
        >
          {isExporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
          ) : done ? (
            <><CheckCircle2 className="w-4 h-4" /> Done!</>
          ) : (
            <><Download className="w-4 h-4" /> Export {scope === 'all' && slides.length > 1 ? 'ZIP' : format}</>
          )}
        </button>

        <p className="text-[10px] text-slate-600 text-center leading-relaxed">
          {scope === 'all' && slides.length > 1
            ? 'All slides packed into a ZIP archive'
            : `Current slide · ${format} · ${scale}× (${canvasW * scale}×${canvasH * scale}px)`}
        </p>
      </div>
    </div>
  )
}
