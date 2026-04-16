import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, ArrowLeft, Undo2, Redo2, Download,
  Wand2, MousePointer2, Type, Square, Circle as CircleIcon,
  Image as ImageIcon, Save, CheckCircle2, AlertCircle,
  WifiOff, Play, Layers
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useEditorStore } from '../../stores/editorStore'
import { useAuthStore } from '../../stores/authStore'
import { useAutosave } from '../../hooks/useAutosave'
import FabricCanvasComponent from '../../components/canvas/FabricCanvas'
import LayersPanel from '../../components/panels/LayersPanel'
import PropertiesPanel from '../../components/panels/PropertiesPanel'
import DeviceFramePanel from '../../components/panels/DeviceFramePanel'
import ExportPanel from '../../components/panels/ExportPanel'
import TemplatesPanel from '../../components/panels/TemplatesPanel'
import AssetsPanel from '../../components/panels/AssetsPanel'
import AIComposerPanel from '../../components/ai/AIComposerPanel'
import type { Project } from '../../lib/database.types'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { Rect, Circle, IText, Image as FabricImage, Group } from 'fabric'

const TOOLS = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'text', icon: Type, label: 'Text (T)' },
  { id: 'rect', icon: Square, label: 'Rectangle (R)' },
  { id: 'circle', icon: CircleIcon, label: 'Ellipse (E)' },
  { id: 'image', icon: ImageIcon, label: 'Image (I)' },
] as const

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
    activeLeftPanel, setActiveLeftPanel,
    activeRightPanel, setActiveRightPanel,
    isAIOpen, setIsAIOpen,
    resetEditor,
  } = useEditorStore()

  useAutosave()
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditingName, setIsEditingName] = useState(false)



  // Load project
  useEffect(() => {
    if (!projectId) return
    resetEditor()
    setProjectId(projectId)

    const loadProject = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single() as { data: Project | null, error: any }

      if (error || !data) {
        toast.error('Project not found')
        navigate('/dashboard')
        return
      }

      setProject(data as Project)
      setProjectName((data as Project).name)
      setIsLoading(false)

      // Load canvas state into Fabric if available
      // This will be done after FabricCanvas mounts via useEffect in that component
    }

    loadProject()
    return () => resetEditor()
  }, [projectId])

  // Load canvas state when both project and fabric canvas are ready
  useEffect(() => {
    if (!fabricCanvas || !project?.canvas_state) return
    fabricCanvas.loadFromJSON(project.canvas_state as any).then(() => {
      fabricCanvas.renderAll()
    })
  }, [fabricCanvas, project?.canvas_state])

  // Add objects based on active tool click
  const handleCanvasToolClick = useCallback((toolId: string) => {
    if (!fabricCanvas || toolId === 'select') return

    const centerX = fabricCanvas.getWidth() / 2
    const centerY = fabricCanvas.getHeight() / 2

    if (toolId === 'text') {
      const text = new IText('Double-click to edit', {
        left: centerX - 100,
        top: centerY - 20,
        fontFamily: 'Inter, sans-serif',
        fontSize: 32,
        fill: '#ffffff',
        fontWeight: 'bold',
      })
      fabricCanvas.add(text)
      fabricCanvas.setActiveObject(text)
      fabricCanvas.renderAll()
      setActiveTool('select')
      return
    }

    if (toolId === 'rect') {
      const rect = new Rect({
        left: centerX - 80,
        top: centerY - 50,
        width: 160,
        height: 100,
        fill: '#6171f6',
        rx: 12,
        ry: 12,
      })
      fabricCanvas.add(rect)
      fabricCanvas.setActiveObject(rect)
      fabricCanvas.renderAll()
      setActiveTool('select')
      return
    }

    if (toolId === 'circle') {
      const circle = new Circle({
        left: centerX - 50,
        top: centerY - 50,
        radius: 50,
        fill: '#a78bfa',
      })
      fabricCanvas.add(circle)
      fabricCanvas.setActiveObject(circle)
      fabricCanvas.renderAll()
      setActiveTool('select')
      return
    }

    if (toolId === 'image') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (f) => {
          const dataUrl = f.target?.result as string
          if (!dataUrl) return
          try {
            const img = await FabricImage.fromURL(dataUrl)

            // Look for a prebuilt fixed mockup
            const mockupObj = fabricCanvas.getObjects().find(o => o.name && o.name.startsWith('Mockup:'))
            
            if (mockupObj && mockupObj.type === 'group') {
              const group = mockupObj as any
              const items = group.getObjects()
              const oldScreen = items[0]
              const frameImg = items[1]
              
              const left = group.left
              const top = group.top
              const scaleX = group.scaleX
              const scaleY = group.scaleY
              const angle = group.angle || 0
              const shadow = group.shadow
              const name = group.name
              const originX = group.originX
              const originY = group.originY

              fabricCanvas.remove(group)

              // Extract exact dimensions from the placeholder screen, guarding against undefined scale keys.
              const targetW = oldScreen.width! * (oldScreen.scaleX ?? 1)
              const targetH = oldScreen.height! * (oldScreen.scaleY ?? 1)
              const baseRx = oldScreen.type === 'rect' ? (oldScreen as any).rx : 120
              const baseRy = oldScreen.type === 'rect' ? (oldScreen as any).ry : 120

              const calculatedScaleX = targetW / img.width!
              const calculatedScaleY = targetH / img.height!
              
              img.scaleX = calculatedScaleX
              img.scaleY = calculatedScaleY
              img.originX = 'center'
              img.originY = 'center'
              img.left = oldScreen.left
              img.top = oldScreen.top

              const rx = baseRx / calculatedScaleX
              const ry = baseRy / calculatedScaleY
              const clipRect = new Rect({ width: img.width, height: img.height, originX: 'center', originY: 'center', rx, ry })
              img.set({ clipPath: clipRect })

              frameImg.clone([]).then((clonedFrame: any) => {
                const newGroup = new Group([img, clonedFrame], {
                  left, top, scaleX, scaleY, angle, shadow, name,
                  originX, originY,
                  selectable: false
                })
                fabricCanvas.add(newGroup)
                fabricCanvas.renderAll()
              })
              
              return
            }

            // Fallback if no layout mockup exists on canvas
            const maxWidth = fabricCanvas.getWidth() * 0.8
            const maxHeight = fabricCanvas.getHeight() * 0.8
            let scale = 1
            if (img.width! > maxWidth || img.height! > maxHeight) {
              scale = Math.min(maxWidth / img.width!, maxHeight / img.height!)
            }
            img.scale(scale)
            img.set({
              left: centerX - (img.width! * scale) / 2,
              top: centerY - (img.height! * scale) / 2,
            })
            fabricCanvas.add(img)
            fabricCanvas.setActiveObject(img)
            fabricCanvas.renderAll()
          } catch (err) {
            console.error('Failed to load image', err)
          }
        }
        reader.readAsDataURL(file)
      }
      input.click()
      setActiveTool('select')
    }
  }, [fabricCanvas, setActiveTool])

  // Rename project
  const handleRename = async (newName: string) => {
    setIsEditingName(false)
    if (!newName.trim() || newName === projectName) return
    setProjectName(newName)
    await (supabase as any).from('projects').update({ name: newName }).eq('id', projectId!)
  }

  const saveStatusInfo = {
    idle: null,
    saving: { icon: Save, text: 'Saving…', color: 'text-surface-400' },
    saved: { icon: CheckCircle2, text: `Saved`, color: 'text-accent-green' },
    error: { icon: AlertCircle, text: 'Save failed', color: 'text-accent-red' },
    offline: { icon: WifiOff, text: 'Offline — draft saved locally', color: 'text-accent-amber' },
  }[saveStatus]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-surface-400">
          <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          Loading project…
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-surface-950 flex flex-col overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header className="h-12 bg-surface-900 border-b border-surface-800 flex items-center px-3 gap-3 flex-shrink-0 z-40">
        {/* Back + Logo */}
        <button onClick={() => navigate('/dashboard')} className="btn-ghost btn-sm p-1.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-6 h-6 rounded-lg bg-gradient-brand flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>

        {/* Project name */}
        {isEditingName ? (
          <input
            autoFocus
            defaultValue={projectName}
            onBlur={e => handleRename(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(e.currentTarget.value) }}
            className="input-sm text-sm font-semibold max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm font-semibold text-surface-200 hover:text-white truncate max-w-[200px] hover:bg-surface-800 rounded-lg px-2 py-1 transition-colors"
          >
            {projectName}
          </button>
        )}

        {/* Save status */}
        {saveStatusInfo && (
          <div className={clsx('flex items-center gap-1.5 text-xs', saveStatusInfo.color)}>
            <saveStatusInfo.icon className="w-3.5 h-3.5" />
            <span>{saveStatusInfo.text}</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5">
          <button onClick={undo} disabled={!canUndo} className="btn-ghost btn-sm p-1.5 disabled:opacity-30">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={redo} disabled={!canRedo} className="btn-ghost btn-sm p-1.5 disabled:opacity-30">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-surface-700" />

        {/* AI button */}
        <button
          onClick={() => setIsAIOpen(!isAIOpen)}
          className={clsx(
            'btn-sm flex items-center gap-1.5 px-3',
            isAIOpen ? 'btn-primary' : 'btn-ghost'
          )}
        >
          <Wand2 className="w-3.5 h-3.5" />
          AI
        </button>

        {/* Export button */}
        <button
          onClick={() => setActiveRightPanel('export')}
          className="btn-primary btn-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Tool Bar (vertical) ──────────────────────────── */}
        <div className="w-11 bg-surface-900 border-r border-surface-800 flex flex-col items-center py-2 gap-1 flex-shrink-0">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              id={`tool-${tool.id}`}
              title={tool.label}
              onClick={() => { setActiveTool(tool.id as any); handleCanvasToolClick(tool.id) }}
              className={clsx(
                'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                activeTool === tool.id
                  ? 'bg-brand-600 text-white shadow-glow-sm'
                  : 'text-surface-500 hover:text-surface-200 hover:bg-surface-800'
              )}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* ── Left Sidebar ─────────────────────────────────── */}
        <div className="w-56 bg-surface-900 border-r border-surface-800 flex flex-col flex-shrink-0">
          {/* Panel tabs */}
          <div className="flex border-b border-surface-800">
            {([
              { id: 'layers', icon: Layers, label: 'Layers' },
              { id: 'templates', icon: Play, label: 'Templates' },
              { id: 'assets', icon: ImageIcon, label: 'Assets' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveLeftPanel(tab.id)}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors border-b-2',
                  activeLeftPanel === tab.id
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-surface-500 hover:text-surface-300'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {activeLeftPanel === 'layers' && <LayersPanel />}
            {activeLeftPanel === 'templates' && <TemplatesPanel />}
            {activeLeftPanel === 'assets' && <AssetsPanel />}
          </div>
        </div>

        {/* ── Canvas Area ───────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">
          <FabricCanvasComponent />

          {/* AI Panel overlay */}
          <AnimatePresence>
            {isAIOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="absolute top-4 right-4 w-80 z-30"
              >
                <AIComposerPanel projectId={projectId!} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right Sidebar ─────────────────────────────────── */}
        <div className="w-60 bg-surface-900 border-l border-surface-800 flex flex-col flex-shrink-0">
          <div className="flex border-b border-surface-800">
            {([
              { id: 'properties', label: 'Properties' },
              { id: 'device', label: 'Device' },
              { id: 'export', label: 'Export' },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveRightPanel(tab.id)}
                className={clsx(
                  'flex-1 py-2 text-xs transition-colors border-b-2',
                  activeRightPanel === tab.id
                    ? 'border-brand-500 text-brand-400'
                    : 'border-transparent text-surface-500 hover:text-surface-300'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto scroll-area">
            {activeRightPanel === 'properties' && <PropertiesPanel />}
            {activeRightPanel === 'device' && <DeviceFramePanel />}
            {activeRightPanel === 'export' && <ExportPanel projectId={projectId!} />}
          </div>
        </div>
      </div>
    </div>
  )
}
