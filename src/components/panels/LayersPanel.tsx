import React from 'react'
import { Eye, EyeOff, Lock, Unlock, Trash2, Type, Square, Circle, Image, Layers, ArrowUp, ArrowDown } from 'lucide-react'
import { useEditorStore } from '../../stores/editorStore'
import clsx from 'clsx'
import type { FabricObject } from 'fabric'

const LAYER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'i-text': Type,
  'textbox': Type,
  'rect': Square,
  'circle': Circle,
  'image': Image,
}

export default function LayersPanel() {
  const { fabricCanvas, selectedObjects, setSelectedObjects } = useEditorStore()

  const objects = fabricCanvas?.getObjects() ?? []
  const reversedObjects = [...objects].reverse() // top layer first

  const selectObject = (obj: FabricObject) => {
    if (!fabricCanvas) return
    fabricCanvas.setActiveObject(obj)
    fabricCanvas.renderAll()
    setSelectedObjects([obj])
  }

  const toggleVisibility = (obj: FabricObject, e: React.MouseEvent) => {
    e.stopPropagation()
    obj.set('visible', !obj.visible)
    fabricCanvas?.renderAll()
  }

  const toggleLock = (obj: FabricObject, e: React.MouseEvent) => {
    e.stopPropagation()
    const isLocked = !obj.selectable
    obj.set({ selectable: isLocked, evented: isLocked })
    fabricCanvas?.renderAll()
  }

  const removeObject = (obj: FabricObject, e: React.MouseEvent) => {
    e.stopPropagation()
    fabricCanvas?.remove(obj)
    fabricCanvas?.renderAll()
  }

  const moveLayer = (obj: FabricObject, direction: 'up' | 'down', e: React.MouseEvent) => {
    e.stopPropagation()
    if (!fabricCanvas) return
    if (direction === 'up') obj.bringForward()
    else obj.sendBackwards()
    fabricCanvas.renderAll()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-section flex items-center justify-between">
        <span className="panel-section-title mb-0">Layers</span>
        <span className="text-xs text-surface-600">{objects.length}</span>
      </div>

      {objects.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center p-4">
          <Layers className="w-8 h-8 text-surface-700 mb-2" />
          <p className="text-xs text-surface-600">No layers yet</p>
          <p className="text-xs text-surface-700 mt-1">Use the tools to add text, shapes, or images</p>
        </div>
      ) : (
        <div className="scroll-area flex-1">
          {reversedObjects.map((obj, i) => {
            const isSelected = selectedObjects.includes(obj)
            const type = (obj as any).type ?? 'object'
            const Icon = LAYER_ICONS[type] ?? Layers
            const name = (obj as any).name || (obj as any).text?.slice(0, 20) || `${type} ${objects.length - i}`
            const isLocked = !(obj as any).selectable
            const isHidden = !obj.visible

            return (
              <div
                key={i}
                onClick={() => selectObject(obj)}
                className={clsx(
                  'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-sm',
                  isSelected
                    ? 'bg-brand-600/20 border-l-2 border-brand-500'
                    : 'hover:bg-surface-800 border-l-2 border-transparent'
                )}
              >
                <Icon className={clsx('w-3.5 h-3.5 flex-shrink-0', isSelected ? 'text-brand-400' : 'text-surface-500')} />
                <span className={clsx('flex-1 truncate text-xs', isHidden ? 'opacity-40' : isSelected ? 'text-surface-100' : 'text-surface-300')}>
                  {name}
                </span>

                {/* Actions — visible on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => moveLayer(obj, 'up', e)}
                    className="p-0.5 rounded text-surface-500 hover:text-surface-200 transition-colors"
                    title="Bring forward"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => moveLayer(obj, 'down', e)}
                    className="p-0.5 rounded text-surface-500 hover:text-surface-200 transition-colors"
                    title="Send backward"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={e => toggleVisibility(obj, e)}
                    className="p-0.5 rounded text-surface-500 hover:text-surface-200 transition-colors"
                    title={isHidden ? 'Show layer' : 'Hide layer'}
                  >
                    {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={e => toggleLock(obj, e)}
                    className="p-0.5 rounded text-surface-500 hover:text-surface-200 transition-colors"
                    title={isLocked ? 'Unlock layer' : 'Lock layer'}
                  >
                    {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={e => removeObject(obj, e)}
                    className="p-0.5 rounded text-accent-red/60 hover:text-accent-red transition-colors"
                    title="Delete layer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
