import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ArrowLeft, Undo2, Redo2, Download,
  Wand2, MousePointer2, Type, Square, Circle as CircleIcon,
  Image as ImageIcon, Save, CheckCircle2, AlertCircle,
  WifiOff, LayoutTemplate, Shapes, AlignLeft, Palette, UploadCloud,
  Copy, Trash2, Loader2, Plus, Minus,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEditorStore } from '../../stores/editorStore'
import { useAuthStore } from '../../stores/authStore'
import { useAutosave } from '../../hooks/useAutosave'
import { useSlideStore } from '../../stores/slideStore'
import FabricCanvasComponent from '../../components/canvas/FabricCanvas'
import PropertiesPanel from '../../components/panels/PropertiesPanel'
import TemplatesPanel from '../../components/panels/TemplatesPanel'
import AssetsPanel from '../../components/panels/AssetsPanel'
import AIComposerPanel from '../../components/ai/AIComposerPanel'
import type { Project } from '../../lib/database.types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Rect, Circle, IText, Image as FabricImage } from 'fabric'

const DRAW_TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'text',   icon: Type,          label: 'Text (T)' },
  { id: 'rect',   icon: Square,        label: 'Rectangle (R)' },
  { id: 'circle', icon: CircleIcon,    label: 'Ellipse (E)' },
  { id: 'image',  icon: ImageIcon,     label: 'Add Image (I)' },
] as const

const LEFT_PANELS = [
  { id: 'templates',  icon: LayoutTemplate, label: 'Templates' },
  { id: 'elements',   icon: Shapes,         label: 'Elements' },
  { id: 'text',       icon: AlignLeft,      label: 'Text' },
  { id: 'background', icon: Palette,        label: 'Background' },
  { id: 'uploads',    icon: UploadCloud,    label: 'Uploads' },
] as const

type LeftPanelId = typeof LEFT_PANELS[number]['id']

// Thumbnail tile dimensions
const THUMB_W = 90
const THUMB_H = 160

const BG_PRESETS = [
  '#4f46e5','#0f172a','#ef4444','#f97316','#f59e0b','#22c55e',
  '#06b6d4','#8b5cf6','#d946ef','#ffffff','#f1f5f9','#1e293b',
  '#fce7f3','#ecfdf5','#eff6ff','#fefce8','#fdf4ff','#fff7ed',
  '#7c3aed','#be123c','#047857','#0369a1','#b45309','#64748b',
]

export default function EditorPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  useAuthStore()

  const {
    fabricCanvas,
    projectName, setProjectName,
    setProjectId,
    saveStatus,
    canUndo, canRedo, undo, redo,
    activeTool, setActiveTool,
    isAIOpen, setIsAIOpen,
    zoom, setZoom,
    resetEditor,
  } = useEditorStore()

  const {
    loadSlides, addSlide, switchSlide, duplicateSlide, deleteSlide,
    slides, activeSlideId, isSwitching, reset: resetSlides,
  } = useSlideStore()

  useAutosave()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)
  const [activeLeftPanel, setActiveLeftPanel] = useState<LeftPanelId | null>('templates')
  const slidesInitRef = useRef(false)

  // ── Load project metadata ─────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return
    resetEditor()
    resetSlides()
    setProjectId(projectId)
    slidesInitRef.current = false

    const loadProject = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single() as { data: Project | null; error: any }

      if (error || !data) {
        toast.error('Project not found')
        navigate('/dashboard')
        return
      }
      setProject(data as Project)
      setProjectName((data as Project).name)
      setIsLoading(false)
    }

    loadProject()
    return () => { resetEditor(); resetSlides() }
  }, [projectId])

  // ── Initialize slides once both fabricCanvas AND project are ready ──────
  useEffect(() => {
    if (!fabricCanvas || !project || slidesInitRef.current) return
    slidesInitRef.current = true

    const init = async () => {
      await loadSlides(project.id)
      const { slides: loaded } = useSlideStore.getState()

      if (loaded.length === 0) {
        // Legacy project: migrate single canvas_state → first slide
        if ((project as any).canvas_state) {
          const { data } = await (supabase as any)
            .from('slides')
            .insert({ project_id: project.id, position: 0, title: 'Main', canvas_state: (project as any).canvas_state })
            .select()
            .single()
          if (data) {
            useSlideStore.setState({ slides: [data], activeSlideId: (data as any).id })
            await fabricCanvas.loadFromJSON((project as any).canvas_state)
            fabricCanvas.renderAll()
          }
        } else {
          // Brand new project
          await addSlide(project.id, fabricCanvas)
        }
      } else {
        // Load the first slide
        const first = loaded[0]
        useSlideStore.setState({ activeSlideId: first.id })
        if (first.canvas_state && Object.keys(first.canvas_state).length > 0) {
          await fabricCanvas.loadFromJSON(first.canvas_state as any)
          fabricCanvas.renderAll()
        }
      }
    }

    init()
  }, [fabricCanvas, project])

  // ── Add objects via toolbar ───────────────────────────────────────────
  const handleCanvasToolClick = useCallback((toolId: string) => {
    if (!fabricCanvas || toolId === 'select') return
    const cx = fabricCanvas.getWidth() / 2
    const cy = fabricCanvas.getHeight() / 2

    if (toolId === 'text') {
      const t = new IText('Double-click to edit', {
        left: cx - 120, top: cy - 20,
        fontFamily: 'Inter, sans-serif', fontSize: 36,
        fill: '#ffffff', fontWeight: 'bold',
      })
      fabricCanvas.add(t); fabricCanvas.setActiveObject(t); fabricCanvas.renderAll()
      setActiveTool('select'); return
    }
    if (toolId === 'rect') {
      const r = new Rect({ left: cx - 80, top: cy - 50, width: 160, height: 100, fill: '#6171f6', rx: 12, ry: 12 })
      fabricCanvas.add(r); fabricCanvas.setActiveObject(r); fabricCanvas.renderAll()
      setActiveTool('select'); return
    }
    if (toolId === 'circle') {
      const c = new Circle({ left: cx - 50, top: cy - 50, radius: 50, fill: '#a78bfa' })
      fabricCanvas.add(c); fabricCanvas.setActiveObject(c); fabricCanvas.renderAll()
      setActiveTool('select'); return
    }
    if (toolId === 'image') {
      const input = document.createElement('input')
      input.type = 'file'; input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = async (f) => {
          const url = f.target?.result as string
          if (!url) return
          try {
            const img = await FabricImage.fromURL(url)
            const maxW = fabricCanvas.getWidth() * 0.8
            const maxH = fabricCanvas.getHeight() * 0.8
            const scale = Math.min(maxW / img.width!, maxH / img.height!, 1)
            img.scale(scale)
            img.set({ left: cx - (img.width! * scale) / 2, top: cy - (img.height! * scale) / 2 })
            fabricCanvas.add(img); fabricCanvas.setActiveObject(img); fabricCanvas.renderAll()
          } catch (err) { console.error('Image load error', err) }
        }
        reader.readAsDataURL(file)
      }
      input.click(); setActiveTool('select')
    }
  }, [fabricCanvas, setActiveTool])

  const handleRename = async (newName: string) => {
    setIsEditingName(false)
    if (!newName.trim() || newName === projectName) return
    setProjectName(newName)
    await (supabase as any).from('projects').update({ name: newName }).eq('id', projectId!)
  }

  const applyBackground = (color: string) => {
    if (!fabricCanvas) return
    const bg = fabricCanvas.getObjects().find((o: any) => o.name === 'Background') as any
    if (bg) { bg.set({ fill: color }); fabricCanvas.renderAll() }
    else { (fabricCanvas as any).backgroundColor = color; fabricCanvas.renderAll() }
  }

  const saveStatusInfo = {
    idle: null,
    saving: { icon: Save, text: 'Saving…', color: 'text-slate-400' },
    saved: { icon: CheckCircle2, text: 'Saved', color: 'text-green-400' },
    error: { icon: AlertCircle, text: 'Error', color: 'text-red-400' },
    offline: { icon: WifiOff, text: 'Offline', color: 'text-amber-400' },
  }[saveStatus]

  // ── Loading Screen ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-screen bg-[#0f1120] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading project…
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0f1120', fontFamily: 'Inter, sans-serif' }}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header className="h-12 flex-shrink-0 flex items-center px-3 gap-2 z-40" style={{ background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => navigate('/dashboard')} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>

        {/* Project name */}
        {isEditingName ? (
          <input
            autoFocus defaultValue={projectName}
            onBlur={e => handleRename(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(e.currentTarget.value) }}
            className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1 text-sm font-semibold text-white max-w-[200px] outline-none focus:ring-2 focus:ring-indigo-500"
          />
        ) : (
          <button onClick={() => setIsEditingName(true)} className="text-sm font-semibold text-slate-200 hover:text-white hover:bg-white/10 rounded-lg px-2 py-1 truncate max-w-[220px] transition-colors">
            {projectName}
          </button>
        )}

        {saveStatusInfo && (
          <div className={clsx('flex items-center gap-1.5 text-xs', saveStatusInfo.color)}>
            <saveStatusInfo.icon className="w-3 h-3" />
            <span>{saveStatusInfo.text}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Draw tool buttons */}
        <div className="flex items-center gap-0.5 rounded-xl p-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {DRAW_TOOLS.map(tool => (
            <button
              key={tool.id}
              title={tool.label}
              onClick={() => { setActiveTool(tool.id as any); handleCanvasToolClick(tool.id) }}
              className={clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                activeTool === tool.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/10'
              )}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors">
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-white/10 mx-1" />

        <button
          onClick={() => setIsAIOpen(!isAIOpen)}
          className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all', isAIOpen ? 'bg-indigo-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20')}
        >
          <Wand2 className="w-3.5 h-3.5" /> AI
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors" style={{ background: '#4f46e5' }}>
          <Download className="w-3.5 h-3.5" /> Export
        </button>
      </header>

      {/* ── Body (sidebar + canvas + props) ─────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Icon Sidebar ──────────────────────────────────────── */}
        <div className="w-[58px] flex-shrink-0 flex flex-col items-center py-3 gap-0.5 z-30" style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
          {LEFT_PANELS.map(panel => (
            <button
              key={panel.id}
              onClick={() => setActiveLeftPanel(activeLeftPanel === panel.id ? null : panel.id)}
              className="w-12 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all"
              style={activeLeftPanel === panel.id
                ? { background: 'rgba(79,70,229,0.2)', color: '#818cf8' }
                : { color: '#64748b' }
              }
            >
              <panel.icon className="w-[18px] h-[18px]" />
              <span className="text-[9px] font-medium leading-none">{panel.label}</span>
            </button>
          ))}
        </div>

        {/* ── Contextual Left Panel ─────────────────────────────── */}
        <AnimatePresence>
          {activeLeftPanel && (
            <motion.div
              key={activeLeftPanel}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 232, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
              className="flex-shrink-0 flex flex-col overflow-hidden z-20"
              style={{ background: '#111827', borderRight: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ minWidth: 232 }}>
                {activeLeftPanel === 'templates'  && <TemplatesPanel />}
                {activeLeftPanel === 'uploads'    && <AssetsPanel />}

                {activeLeftPanel === 'background' && (
                  <div className="p-3 space-y-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Solid Colors</p>
                    <div className="grid grid-cols-6 gap-1.5">
                      {BG_PRESETS.map(c => (
                        <button
                          key={c}
                          onClick={() => applyBackground(c)}
                          className="w-8 h-8 rounded-lg transition-transform hover:scale-110 border border-white/10 hover:ring-2 hover:ring-white/40"
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Custom</p>
                      <input type="color" onChange={e => applyBackground(e.target.value)}
                        className="w-full h-9 rounded-lg cursor-pointer border border-white/10 bg-transparent" />
                    </div>
                  </div>
                )}

                {activeLeftPanel === 'text' && (
                  <div className="p-3 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Add Text</p>
                    {[
                      { label: 'Heading', size: 48, weight: 'bold' },
                      { label: 'Subheading', size: 32, weight: '600' },
                      { label: 'Body', size: 20, weight: 'normal' },
                    ].map(({ label, size, weight }) => (
                      <button key={label}
                        onClick={() => {
                          if (!fabricCanvas) return
                          const t = new IText(label, {
                            left: fabricCanvas.getWidth() / 2, top: fabricCanvas.getHeight() / 2,
                            originX: 'center', originY: 'center',
                            fontFamily: 'Inter', fontSize: size, fontWeight: weight, fill: '#ffffff',
                          })
                          fabricCanvas.add(t); fabricCanvas.setActiveObject(t); fabricCanvas.renderAll()
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-white border border-white/10 hover:bg-white/10 transition-colors"
                        style={{ fontSize: `${Math.min(size * 0.3, 16)}px`, fontWeight: weight, background: 'rgba(255,255,255,0.04)' }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {activeLeftPanel === 'elements' && (
                  <div className="p-3 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Shapes</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Rect',    make: () => new Rect({ width: 160, height: 100, fill: '#6171f6', rx: 12, ry: 12 }) },
                        { label: 'Circle',  make: () => new Circle({ radius: 60, fill: '#a78bfa' }) },
                        { label: 'Pill',    make: () => new Rect({ width: 140, height: 140, fill: '#34d399', rx: 70, ry: 70 }) },
                      ].map(({ label, make }) => (
                        <button key={label}
                          onClick={() => {
                            if (!fabricCanvas) return
                            const obj = make()
                            obj.set({ left: fabricCanvas.getWidth() / 2, top: fabricCanvas.getHeight() / 2, originX: 'center', originY: 'center' })
                            fabricCanvas.add(obj); fabricCanvas.setActiveObject(obj); fabricCanvas.renderAll()
                          }}
                          className="aspect-square rounded-xl border border-white/10 flex items-center justify-center text-[10px] text-slate-400 hover:bg-white/10 transition-colors"
                          style={{ background: 'rgba(255,255,255,0.04)' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Area: canvas + slide strip ───────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, #1e2248 0%, #0d0f1e 100%)' }}>

          {/* Canvas viewport — always renders the SINGLE active Fabric canvas */}
          <div className="flex-1 relative flex items-center justify-center overflow-hidden">
            <FabricCanvasComponent />

            {/* AI overlay */}
            <AnimatePresence>
              {isAIOpen && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="absolute top-4 right-4 w-80 z-30"
                >
                  <AIComposerPanel projectId={projectId!} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-xl px-2 py-1" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button onClick={() => { if (!fabricCanvas) return; const z = Math.max(zoom * 0.85, 0.1); fabricCanvas.setZoom(z); setZoom(z) }}
                className="p-1 rounded text-slate-400 hover:text-white transition-colors"><Minus className="w-3 h-3" /></button>
              <span className="text-[11px] text-slate-400 min-w-[36px] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => { if (!fabricCanvas) return; const z = Math.min(zoom * 1.15, 5); fabricCanvas.setZoom(z); setZoom(z) }}
                className="p-1 rounded text-slate-400 hover:text-white transition-colors"><Plus className="w-3 h-3" /></button>
            </div>
          </div>

          {/* ── Slide Strip (bottom, horizontal) ──────────────── */}
          <div className="flex-shrink-0 flex items-center px-4 gap-3 overflow-x-auto no-scrollbar py-3" style={{ height: 110, background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

            {slides.map((slide, index) => {
              const isActive = slide.id === activeSlideId
              return (
                <div key={slide.id} className="flex-shrink-0 flex flex-col items-center gap-1">
                  {/* Thumbnail tile */}
                  <div
                    onClick={() => { if (!isActive && fabricCanvas && !isSwitching) switchSlide(slide.id, fabricCanvas) }}
                    className={clsx(
                      'group relative rounded-lg overflow-hidden cursor-pointer transition-all duration-150',
                      isActive
                        ? 'ring-2 ring-indigo-500'
                        : 'ring-1 ring-white/10 opacity-60 hover:opacity-100 hover:ring-white/30'
                    )}
                    style={{ width: THUMB_W, height: THUMB_H }}
                  >
                    {isSwitching && isActive ? (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: '#1a1d35' }}>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                      </div>
                    ) : slide.thumbnail_b64 ? (
                      <img src={slide.thumbnail_b64} alt={slide.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: '#1a1d35' }}>
                        <span className="text-[9px] text-slate-600 text-center px-1">{slide.title}</span>
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); fabricCanvas && duplicateSlide(slide, projectId!) }}
                        className="p-1 rounded bg-white/20 hover:bg-white/40 text-white transition-colors"
                        title="Duplicate"
                      ><Copy className="w-3 h-3" /></button>
                      <button
                        onClick={e => { e.stopPropagation(); if (fabricCanvas && slides.length > 1) deleteSlide(slide.id, projectId!, fabricCanvas) }}
                        disabled={slides.length <= 1}
                        className="p-1 rounded bg-white/20 hover:bg-red-500 text-white transition-colors disabled:opacity-30"
                        title="Delete"
                      ><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>

                  {/* Label */}
                  <span className={clsx('text-[9px] font-medium', isActive ? 'text-indigo-400' : 'text-slate-600')}>
                    #{index + 1}
                  </span>
                </div>
              )
            })}

            {/* Add slide */}
            <div className="flex-shrink-0 flex flex-col items-center gap-1">
              <button
                onClick={() => fabricCanvas && addSlide(projectId!, fabricCanvas)}
                className="rounded-lg border-2 border-dashed border-white/15 text-slate-600 hover:border-indigo-500 hover:text-indigo-400 transition-all flex items-center justify-center flex-col gap-1"
                style={{ width: THUMB_W, height: THUMB_H }}
              >
                <Plus className="w-5 h-5" />
                <span className="text-[9px]">Add</span>
              </button>
              <span className="text-[9px] text-transparent">+</span>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar — Properties ─────────────────────────── */}
        <div className="w-56 flex-shrink-0 flex flex-col overflow-y-auto" style={{ background: '#111827', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 pt-3 pb-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Properties</p>
          </div>
          <PropertiesPanel />
        </div>
      </div>
    </div>
  )
}
