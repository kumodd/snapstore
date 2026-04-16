import { create } from 'zustand'
import type { Canvas as FabricCanvas, FabricObject } from 'fabric'
import type { DeviceConfig } from '../data/devices'
import { DEFAULT_DEVICE } from '../data/devices'

export interface CanvasSnapshot {
  json: object
  timestamp: number
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'offline'

interface EditorState {
  // Canvas instance (not serialized)
  fabricCanvas: FabricCanvas | null
  setFabricCanvas: (canvas: FabricCanvas | null) => void

  // Selection
  selectedObjects: FabricObject[]
  setSelectedObjects: (objects: FabricObject[]) => void

  // Canvas dimensions
  canvasWidth: number
  canvasHeight: number
  zoom: number
  setZoom: (zoom: number) => void

  // History
  history: CanvasSnapshot[]
  historyIndex: number
  pushHistory: (snapshot: CanvasSnapshot) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean

  // Project metadata
  projectId: string | null
  projectName: string
  isDirty: boolean
  lastSavedAt: Date | null
  saveStatus: SaveStatus

  setProjectId: (id: string) => void
  setProjectName: (name: string) => void
  setIsDirty: (dirty: boolean) => void
  setLastSavedAt: (date: Date) => void
  setSaveStatus: (status: SaveStatus) => void

  // Device
  selectedDevice: DeviceConfig
  show3DFrame: boolean
  setSelectedDevice: (device: DeviceConfig) => void
  setShow3DFrame: (show: boolean) => void

  // UI panels
  activeLeftPanel: 'layers' | 'templates' | 'assets'
  activeRightPanel: 'properties' | 'device' | 'export'
  setActiveLeftPanel: (panel: EditorState['activeLeftPanel']) => void
  setActiveRightPanel: (panel: EditorState['activeRightPanel']) => void

  // Export
  isExporting: boolean
  setIsExporting: (exporting: boolean) => void

  // AI
  isAIOpen: boolean
  setIsAIOpen: (open: boolean) => void
  activeTool: 'select' | 'text' | 'rect' | 'circle' | 'image'
  setActiveTool: (tool: EditorState['activeTool']) => void

  // Reset for new project
  resetEditor: () => void
}

const MAX_HISTORY = 50

export const useEditorStore = create<EditorState>((set, get) => ({
  fabricCanvas: null,
  setFabricCanvas: (canvas) => set({ fabricCanvas: canvas }),

  selectedObjects: [],
  setSelectedObjects: (objects) => set({ selectedObjects: objects }),

  canvasWidth: 390,
  canvasHeight: 844,
  zoom: 1,
  setZoom: (zoom) => set({ zoom }),

  history: [],
  historyIndex: -1,
  canUndo: false,
  canRedo: false,

  pushHistory: (snapshot) => {
    const { history, historyIndex } = get()
    // Truncate forward history (remove any "redos" after current point)
    const newHistory = [...history.slice(0, historyIndex + 1), snapshot]
    const trimmed = newHistory.slice(-MAX_HISTORY)
    const newIndex = trimmed.length - 1
    set({
      history: trimmed,
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: false,
      isDirty: true,
    })
  },

  undo: () => {
    const { history, historyIndex, fabricCanvas } = get()
    if (historyIndex <= 0 || !fabricCanvas) return
    const newIndex = historyIndex - 1
    const snapshot = history[newIndex]
    fabricCanvas.loadFromJSON(snapshot.json).then(() => {
      fabricCanvas.renderAll()
    })
    set({
      historyIndex: newIndex,
      canUndo: newIndex > 0,
      canRedo: true,
    })
  },

  redo: () => {
    const { history, historyIndex, fabricCanvas } = get()
    if (historyIndex >= history.length - 1 || !fabricCanvas) return
    const newIndex = historyIndex + 1
    const snapshot = history[newIndex]
    fabricCanvas.loadFromJSON(snapshot.json).then(() => {
      fabricCanvas.renderAll()
    })
    set({
      historyIndex: newIndex,
      canUndo: true,
      canRedo: newIndex < history.length - 1,
    })
  },

  projectId: null,
  projectName: 'Untitled Project',
  isDirty: false,
  lastSavedAt: null,
  saveStatus: 'idle',

  setProjectId: (id) => set({ projectId: id }),
  setProjectName: (name) => set({ projectName: name }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setLastSavedAt: (date) => set({ lastSavedAt: date }),
  setSaveStatus: (status) => set({ saveStatus: status }),

  selectedDevice: DEFAULT_DEVICE,
  show3DFrame: false,
  setSelectedDevice: (device) => {
    const { fabricCanvas, canvasWidth: oldW, canvasHeight: oldH } = get()
    const newW = device.width / device.scaleFactor
    const newH = device.height / device.scaleFactor

    if (fabricCanvas && oldW > 0 && oldH > 0 && (oldW !== newW || oldH !== newH)) {
      const scaleX = newW / oldW
      const scaleY = newH / oldH
      const minScale = Math.min(scaleX, scaleY)

      fabricCanvas.getObjects().forEach(obj => {
        obj.set({
          left: (obj.left ?? 0) * scaleX,
          top: (obj.top ?? 0) * scaleY,
          scaleX: (obj.scaleX ?? 1) * minScale,
          scaleY: (obj.scaleY ?? 1) * minScale
        })
        obj.setCoords()
      })
      fabricCanvas.renderAll()
    }

    set({ selectedDevice: device, canvasWidth: newW, canvasHeight: newH })
  },
  setShow3DFrame: (show) => set({ show3DFrame: show }),

  activeLeftPanel: 'layers',
  activeRightPanel: 'properties',
  setActiveLeftPanel: (panel) => set({ activeLeftPanel: panel }),
  setActiveRightPanel: (panel) => set({ activeRightPanel: panel }),

  isExporting: false,
  setIsExporting: (exporting) => set({ isExporting: exporting }),

  isAIOpen: false,
  setIsAIOpen: (open) => set({ isAIOpen: open }),

  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),

  resetEditor: () => set({
    fabricCanvas: null,
    selectedObjects: [],
    history: [],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,
    projectId: null,
    projectName: 'Untitled Project',
    isDirty: false,
    lastSavedAt: null,
    saveStatus: 'idle',
    zoom: 1,
    activeTool: 'select',
  }),
}))
