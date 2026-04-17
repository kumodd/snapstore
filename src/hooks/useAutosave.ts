import { useEffect, useRef, useCallback } from 'react'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'
import { useAuthStore } from '../stores/authStore'
import { useSlideStore } from '../stores/slideStore'

const LOCAL_DRAFT_PREFIX = 'snapstore_draft_'
const SERVER_SYNC_INTERVAL_MS = 30_000
const LOCAL_SYNC_INTERVAL_MS = 5_000

export function useAutosave() {
  const {
    fabricCanvas,
    projectId,
    isDirty,
    setSaveStatus,
    setLastSavedAt,
    setIsDirty,
  } = useEditorStore()
  const { user } = useAuthStore()
  const { activeSlideId, slides, saveActiveSlide } = useSlideStore()

  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const serverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isOnline = useRef(navigator.onLine)

  // Track online/offline state
  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true
      setSaveStatus('idle')
      // Flush local draft to server on reconnect
      flushLocalDraft()
    }
    const handleOffline = () => {
      isOnline.current = false
      setSaveStatus('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [projectId])

  const getCanvasJSON = useCallback(() => {
    if (!fabricCanvas) return null
    return fabricCanvas.toJSON()
  }, [fabricCanvas])

  // Save to IndexedDB (offline-tolerant, every 5s if dirty)
  const saveLocalDraft = useCallback(async () => {
    if (!isDirty || !projectId) return
    const json = getCanvasJSON()
    if (!json) return
    try {
      await idbSet(`${LOCAL_DRAFT_PREFIX}${projectId}`, {
        canvasState: json,
        savedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('Local draft save failed:', err)
    }
  }, [isDirty, projectId, getCanvasJSON])

  // Save to Supabase server (every 30s if dirty and online)
  const saveToServer = useCallback(async () => {
    if (!isDirty || !projectId || !user || !isOnline.current) return

    setSaveStatus('saving')
    try {
      // If project has slides, save the active slide canvas state
      if (activeSlideId && fabricCanvas) {
        await saveActiveSlide(fabricCanvas)
      }

      // Update project metadata (slide_count, updated_at)
      // For multi-slide projects canvas_state stays null (slides table is canonical)
      const { error } = await (supabase as any).from('projects').update({
        slide_count: slides.length || 1,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId)

      if (error) throw error

      const now = new Date()
      setSaveStatus('saved')
      setLastSavedAt(now)
      setIsDirty(false)
    } catch (err) {
      console.error('Server save failed:', err)
      setSaveStatus('error')
    }
  }, [isDirty, projectId, user, fabricCanvas, activeSlideId, slides, saveActiveSlide, setSaveStatus, setLastSavedAt, setIsDirty])

  // Flush local IndexedDB draft to server (called on reconnect)
  const flushLocalDraft = useCallback(async () => {
    if (!projectId || !user || !fabricCanvas || !activeSlideId) return
    try {
      const draft = await idbGet(`${LOCAL_DRAFT_PREFIX}${projectId}`)
      if (!draft) return
      // Reload canvas from local draft, then save the active slide
      await fabricCanvas.loadFromJSON(draft.canvasState)
      fabricCanvas.renderAll()
      await saveActiveSlide(fabricCanvas)
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setIsDirty(false)
    } catch (err) {
      console.warn('Flush draft failed:', err)
    }
  }, [projectId, user, fabricCanvas, activeSlideId, saveActiveSlide, setSaveStatus, setLastSavedAt, setIsDirty])

  // Load draft from IndexedDB on project open (before server response)
  const loadLocalDraft = useCallback(async (projId: string) => {
    try {
      const draft = await idbGet(`${LOCAL_DRAFT_PREFIX}${projId}`)
      return draft ?? null
    } catch {
      return null
    }
  }, [])

  // Set up intervals
  useEffect(() => {
    if (!projectId) return

    localTimerRef.current = setInterval(saveLocalDraft, LOCAL_SYNC_INTERVAL_MS)
    serverTimerRef.current = setInterval(saveToServer, SERVER_SYNC_INTERVAL_MS)

    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current)
      if (serverTimerRef.current) clearInterval(serverTimerRef.current)
      // Final save on unmount — only if there are unsaved changes
      if (useEditorStore.getState().isDirty) saveToServer()
    }
  }, [projectId, saveLocalDraft, saveToServer])

  return { saveToServer, loadLocalDraft, flushLocalDraft }
}
