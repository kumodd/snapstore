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
    setIsDirty,
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

    const handleModified = () => {
      captureSnapshot(canvas)
      setIsDirty(true)
    }
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
      className="w-full h-full flex items-center justify-center overflow-hidden"
      style={{ background: 'transparent' }}
    >
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
          boxShadow: '0 20px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(99,102,241,0.2)',
          borderRadius: '6px',
          flexShrink: 0,
        }}
      >
        <canvas ref={canvasElementRef} />
      </div>
    </div>
  )
}
