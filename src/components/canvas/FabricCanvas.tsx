import { useEffect, useRef, useCallback } from 'react'
import { Canvas as FabricCanvas, Point } from 'fabric'
import { useEditorStore } from '../../stores/editorStore'

export default function FabricCanvasComponent() {
  const canvasElementRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    setFabricCanvas,
    fabricCanvas,
    setSelectedObjects,
    pushHistory,
    undo,
    redo,
    activeTool,
    zoom,
    setZoom,
    canvasWidth,
    canvasHeight,
  } = useEditorStore()

  const isHistoryPushPending = useRef(false)

  const captureSnapshot = useCallback((canvas: FabricCanvas) => {
    if (isHistoryPushPending.current) return
    isHistoryPushPending.current = true
    requestAnimationFrame(() => {
      const json = canvas.toJSON()
      pushHistory({ json: json as object, timestamp: Date.now() })
      isHistoryPushPending.current = false
    })
  }, [pushHistory])
  useEffect(() => {
    if (!canvasElementRef.current) return

    const canvas = new FabricCanvas(canvasElementRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#1a1d35',
      selection: true,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
      renderOnAddRemove: false,
    })

    canvas.on('selection:created', () => setSelectedObjects(canvas.getActiveObjects()))
    canvas.on('selection:updated', () => setSelectedObjects(canvas.getActiveObjects()))
    canvas.on('selection:cleared', () => setSelectedObjects([]))

    const handleModified = () => captureSnapshot(canvas)
    canvas.on('object:modified', handleModified)
    canvas.on('object:added', handleModified)
    canvas.on('object:removed', handleModified)

    canvas.renderAll()
    setFabricCanvas(canvas)
    captureSnapshot(canvas)

    return () => {
      canvas.off('object:modified', handleModified)
      canvas.off('object:added', handleModified)
      canvas.off('object:removed', handleModified)
      canvas.dispose()
      setFabricCanvas(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fabricCanvas) return
    fabricCanvas.setDimensions({ width: canvasWidth, height: canvasHeight })
    fabricCanvas.renderAll()
  }, [fabricCanvas, canvasWidth, canvasHeight])

  useEffect(() => {
    if (!fabricCanvas) return
    fabricCanvas.isDrawingMode = false
    if (activeTool === 'select') {
      fabricCanvas.defaultCursor = 'default'
      fabricCanvas.selection = true
    } else {
      fabricCanvas.defaultCursor = 'crosshair'
      fabricCanvas.selection = false
    }
  }, [fabricCanvas, activeTool])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const isMod = e.metaKey || e.ctrlKey

      if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }

      if (!fabricCanvas) return

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isMod) {
        const activeObjects = fabricCanvas.getActiveObjects()
        if (activeObjects.length > 0) {
          activeObjects.forEach(obj => fabricCanvas.remove(obj))
          fabricCanvas.discardActiveObject()
          fabricCanvas.renderAll()
        }
        return
      }

      if (isMod && e.key === 'd') {
        e.preventDefault()
        const active = fabricCanvas.getActiveObject()
        if (active) {
          active.clone().then((cloned: any) => {
            cloned.set({ left: (cloned.left ?? 0) + 20, top: (cloned.top ?? 0) + 20 })
            fabricCanvas.add(cloned)
            fabricCanvas.setActiveObject(cloned)
            fabricCanvas.renderAll()
          })
        }
        return
      }

      const activeObj = fabricCanvas.getActiveObject()
      if (activeObj && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const nudge = {
          ArrowUp:    { top: (activeObj.top ?? 0) - step },
          ArrowDown:  { top: (activeObj.top ?? 0) + step },
          ArrowLeft:  { left: (activeObj.left ?? 0) - step },
          ArrowRight: { left: (activeObj.left ?? 0) + step },
        }[e.key]
        activeObj.set(nudge!)
        activeObj.setCoords()
        fabricCanvas.renderAll()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fabricCanvas, undo, redo])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !fabricCanvas) return

    const handleWheel = (e: WheelEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      e.preventDefault()

      const delta = e.deltaY
      let newZoom = fabricCanvas.getZoom() * (delta > 0 ? 0.95 : 1.05)
      newZoom = Math.min(Math.max(newZoom, 0.1), 5)
      fabricCanvas.zoomToPoint(new Point(e.offsetX, e.offsetY), newZoom)
      setZoom(newZoom)
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [fabricCanvas, setZoom])

  return (
    <div
      ref={containerRef}
      className="canvas-bg flex-1 flex items-center justify-center overflow-auto relative"
    >
      <div
        className="relative"
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          boxShadow: '0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(97,113,246,0.15)',
          borderRadius: '4px',
        }}
      >
        <canvas ref={canvasElementRef} />
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1">
        <button
          onClick={() => {
            if (!fabricCanvas) return
            const newZ = Math.max(parseFloat((fabricCanvas.getZoom() * 0.9).toFixed(2)), 0.1)
            fabricCanvas.setZoom(newZ); setZoom(newZ)
          }}
          className="w-7 h-7 bg-surface-800/80 hover:bg-surface-700 border border-surface-700 rounded-lg text-surface-300 flex items-center justify-center text-sm transition-colors"
        >−</button>
        <div className="px-2 py-1 bg-surface-800/80 border border-surface-700 rounded-lg text-xs text-surface-300 min-w-[52px] text-center">
          {Math.round(zoom * 100)}%
        </div>
        <button
          onClick={() => {
            if (!fabricCanvas) return
            const newZ = Math.min(parseFloat((fabricCanvas.getZoom() * 1.1).toFixed(2)), 5)
            fabricCanvas.setZoom(newZ); setZoom(newZ)
          }}
          className="w-7 h-7 bg-surface-800/80 hover:bg-surface-700 border border-surface-700 rounded-lg text-surface-300 flex items-center justify-center text-sm transition-colors"
        >+</button>
        <button
          onClick={() => { if (!fabricCanvas) return; fabricCanvas.setZoom(1); setZoom(1) }}
          className="px-2 py-1 bg-surface-800/80 hover:bg-surface-700 border border-surface-700 rounded-lg text-xs text-surface-400 transition-colors"
        >Reset</button>
      </div>
    </div>
  )
}
