import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Canvas as FabricCanvas } from 'fabric'

export interface Slide {
  id: string
  project_id: string
  position: number
  title: string
  canvas_state: object
  thumbnail_b64?: string
  updated_at: string
}

interface SlideState {
  slides: Slide[]
  activeSlideId: string | null
  isLoadingSlides: boolean
  isSwitching: boolean

  // Setters
  setSlides: (slides: Slide[]) => void
  setActiveSlideId: (id: string) => void

  // DB operations
  loadSlides: (projectId: string) => Promise<void>

  /**
   * Switch active slide — saves current canvas first, then loads target.
   * fabricCanvas reference is passed in so store stays framework-agnostic.
   */
  switchSlide: (targetId: string, fabricCanvas: FabricCanvas) => Promise<void>

  addSlide: (projectId: string, fabricCanvas: FabricCanvas) => Promise<void>
  duplicateSlide: (slide: Slide, projectId: string) => Promise<void>
  deleteSlide: (slideId: string, projectId: string, fabricCanvas: FabricCanvas) => Promise<void>
  reorderSlides: (projectId: string, from: number, to: number) => Promise<void>

  /** Persist active slide canvas JSON + thumbnail to Supabase */
  saveActiveSlide: (fabricCanvas: FabricCanvas) => Promise<void>

  /** Apply a global style token update across all slide canvas_states */
  applyGlobalStyle: (
    projectId: string,
    fabricCanvas: FabricCanvas,
    styleKey: string,
    styleValue: string
  ) => Promise<void>

  reset: () => void
}

const captureThumb = (canvas: FabricCanvas): string => {
  try {
    return canvas.toDataURL({ format: 'jpeg', quality: 0.4, multiplier: 0.25 }) as string
  } catch {
    return ''
  }
}

const serializeCanvas = (canvas: FabricCanvas): object => (canvas as any).toJSON([
  'name', 'selectable', 'evented', 'lockMovementX', 'lockMovementY',
  'lockScalingX', 'lockScalingY', 'lockRotation', 'hasControls', '_customRx'
])

export const useSlideStore = create<SlideState>((set, get) => ({
  slides: [],
  activeSlideId: null,
  isLoadingSlides: false,
  isSwitching: false,

  setSlides: (slides) => set({ slides }),
  setActiveSlideId: (id) => set({ activeSlideId: id }),

  // ── Load all slides for a project ────────────────────────────────────
  loadSlides: async (projectId) => {
    set({ isLoadingSlides: true })
    const { data, error } = await (supabase as any)
      .from('slides')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })

    if (error) {
      console.error('Failed to load slides', error)
      set({ isLoadingSlides: false })
      return
    }

    set({
      slides: (data ?? []) as Slide[],
      activeSlideId: data?.[0]?.id ?? null,
      isLoadingSlides: false,
    })
  },

  // ── Switch active slide ───────────────────────────────────────────────
  switchSlide: async (targetId, fabricCanvas) => {
    const { activeSlideId, slides } = get()
    if (targetId === activeSlideId || !fabricCanvas) return

    set({ isSwitching: true })

    // 1. Save current canvas state
    if (activeSlideId) {
      const json = serializeCanvas(fabricCanvas)
      const thumb = captureThumb(fabricCanvas)
      await (supabase as any).from('slides').update({
        canvas_state: json,
        thumbnail_b64: thumb,
      }).eq('id', activeSlideId)

      set(prev => ({
        slides: prev.slides.map(s =>
          s.id === activeSlideId ? { ...s, canvas_state: json, thumbnail_b64: thumb } : s
        )
      }))
    }

    // 2. Load target slide
    const target = slides.find(s => s.id === targetId)
    if (target?.canvas_state && Object.keys(target.canvas_state).length > 0) {
      await fabricCanvas.loadFromJSON(target.canvas_state)
      fabricCanvas.renderAll()
    } else {
      fabricCanvas.clear()
      fabricCanvas.renderAll()
    }

    set({ activeSlideId: targetId, isSwitching: false })
  },

  // ── Add new blank slide ───────────────────────────────────────────────
  addSlide: async (projectId, fabricCanvas) => {
    const { slides, activeSlideId, saveActiveSlide } = get()

    // Save current first
    if (activeSlideId) await saveActiveSlide(fabricCanvas)

    const newPosition = slides.length
    const { data, error } = await (supabase as any)
      .from('slides')
      .insert({
        project_id: projectId,
        position: newPosition,
        title: `Slide ${newPosition + 1}`,
        canvas_state: {},
      })
      .select()
      .single()

    if (error || !data) {
      console.error('Failed to add slide', error)
      return
    }

    const newSlide = data as Slide
    set(prev => ({
      slides: [...prev.slides, newSlide],
      activeSlideId: newSlide.id
    }))

    // Clear canvas for new slide
    fabricCanvas.clear()
    fabricCanvas.renderAll()

    // Sync slide_count on project
    await (supabase as any)
      .from('projects')
      .update({ slide_count: newPosition + 1 })
      .eq('id', projectId)
  },

  // ── Duplicate a slide ─────────────────────────────────────────────────
  duplicateSlide: async (slide, projectId) => {
    const { slides } = get()
    const newPosition = slides.length

    const { data, error } = await (supabase as any)
      .from('slides')
      .insert({
        project_id: projectId,
        position: newPosition,
        title: `${slide.title} (copy)`,
        canvas_state: slide.canvas_state,
        thumbnail_b64: slide.thumbnail_b64,
      })
      .select()
      .single()

    if (error || !data) return
    set(prev => ({ slides: [...prev.slides, data as Slide] }))
  },

  // ── Delete a slide ────────────────────────────────────────────────────
  deleteSlide: async (slideId, _projectId, fabricCanvas) => {
    const { slides, activeSlideId } = get()
    if (slides.length <= 1) return // Always keep at least 1

    const { error } = await (supabase as any).from('slides').delete().eq('id', slideId)
    if (error) return

    const remaining = slides.filter(s => s.id !== slideId)
    // Re-normalize positions
    const reordered = remaining.map((s, i) => ({ ...s, position: i }))

    // Batch update positions
    await Promise.all(reordered.map(s =>
      (supabase as any).from('slides').update({ position: s.position }).eq('id', s.id)
    ))

    let nextActiveId = activeSlideId
    if (activeSlideId === slideId) {
      nextActiveId = reordered[0]?.id ?? null
      if (nextActiveId) {
        const target = reordered.find(s => s.id === nextActiveId)
        if (target?.canvas_state) {
          await fabricCanvas.loadFromJSON(target.canvas_state)
          fabricCanvas.renderAll()
        }
      }
    }

    set({ slides: reordered, activeSlideId: nextActiveId })
  },

  // ── Reorder slides ────────────────────────────────────────────────────
  reorderSlides: async (_projectId, from, to) => {
    const { slides } = get()
    const reordered = [...slides]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    const normalized = reordered.map((s, i) => ({ ...s, position: i }))

    set({ slides: normalized })

    // Batch persist
    await Promise.all(normalized.map(s =>
      (supabase as any).from('slides').update({ position: s.position }).eq('id', s.id)
    ))
  },

  // ── Persist active slide ──────────────────────────────────────────────
  saveActiveSlide: async (fabricCanvas) => {
    const { activeSlideId } = get()
    if (!activeSlideId || !fabricCanvas) return

    const json = serializeCanvas(fabricCanvas)
    const thumb = captureThumb(fabricCanvas)

    await (supabase as any).from('slides').update({
      canvas_state: json,
      thumbnail_b64: thumb,
    }).eq('id', activeSlideId)

    set(prev => ({
      slides: prev.slides.map(s =>
        s.id === activeSlideId ? { ...s, canvas_state: json, thumbnail_b64: thumb } : s
      )
    }))
  },

  // ── Apply global style to all slides ─────────────────────────────────
  applyGlobalStyle: async (projectId, fabricCanvas, styleKey, styleValue) => {
    const { saveActiveSlide } = get()

    // Save current slide first
    await saveActiveSlide(fabricCanvas)

    // Update global_style on project
    const { data: project } = await (supabase as any)
      .from('projects')
      .select('global_style')
      .eq('id', projectId)
      .single()

    const newGlobalStyle = { ...(project?.global_style ?? {}), [styleKey]: styleValue }
    await (supabase as any).from('projects').update({ global_style: newGlobalStyle }).eq('id', projectId)

    // For now we don't destructively rewrite each slide's canvas_state —
    // the global style is stored on the project and applied at render time.
    // Phase 2 will implement full propagation across object properties.
    console.log('Global style saved:', newGlobalStyle)
  },

  reset: () => set({
    slides: [],
    activeSlideId: null,
    isLoadingSlides: false,
    isSwitching: false,
  }),
}))
