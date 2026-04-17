import { useEffect, useRef, useCallback } from 'react'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'
import { useAuthStore } from '../stores/authStore'
import { useSlideStore } from '../stores/slideStore'

const LOCAL_DRAFT_PREFIX = 'snapstore_draft_'
const SERVER_SYNC_INTERVAL_MS = 30_000
const LOCAL_SYNC_INTERVAL_MS = 5_000
const SAVE_TIMEOUT_MS = 15_000

/**
 * Race a promise against a timeout. Rejects if the timeout fires first.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => { clearTimeout(timer); resolve(v) },
      (e) => { clearTimeout(timer); reject(e) },
    )
  })
}

export function useAutosave() {
  // Only grab STABLE setter references from stores — never mutable values.
  // Mutable values (isDirty, fabricCanvas, slides, etc.) are read eagerly
  // from getState() inside each callback to avoid the dependency-cascade
  // that was resetting the interval timer on every canvas change.
  const {
    setSaveStatus,
    setLastSavedAt,
    setIsDirty,
  } = useEditorStore()

  const projectIdRef = useRef<string | null>(null)
  const localTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const serverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isOnline = useRef(navigator.onLine)
  const isSavingRef = useRef(false)

  // Keep projectId in a ref so callbacks don't depend on it reactively
  const projectId = useEditorStore(s => s.projectId)
  useEffect(() => { projectIdRef.current = projectId }, [projectId])

  // Track online/offline state
  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true
      setSaveStatus('idle')
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save to IndexedDB (every 5s if dirty) ──────────────────────────
  const saveLocalDraft = useCallback(async () => {
    const { isDirty, fabricCanvas, projectId: pid } = useEditorStore.getState()
    if (!isDirty || !pid || !fabricCanvas) return
    try {
      const json = fabricCanvas.toJSON()
      await idbSet(`${LOCAL_DRAFT_PREFIX}${pid}`, {
        canvasState: json,
        savedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('Local draft save failed:', err)
    }
  }, []) // stable — reads everything from getState()

  // ── Save to Supabase (every 30s if dirty and online) ───────────────
  const saveToServer = useCallback(async () => {
    // Read ALL mutable state eagerly inside the callback
    const { isDirty, projectId: pid, fabricCanvas } = useEditorStore.getState()
    const { user } = useAuthStore.getState()
    const { activeSlideId, slides, saveActiveSlide } = useSlideStore.getState()

    if (!isDirty || !pid || !user || !isOnline.current) return
    if (isSavingRef.current) return // prevent overlapping saves
    isSavingRef.current = true

    setSaveStatus('saving')
    try {
      // Save active slide canvas state with timeout protection
      if (activeSlideId && fabricCanvas) {
        await withTimeout(
          saveActiveSlide(fabricCanvas),
          SAVE_TIMEOUT_MS,
          'saveActiveSlide'
        )
      }

      // Update project metadata
      const result: any = await withTimeout(
        (supabase as any).from('projects').update({
          slide_count: slides.length || 1,
          updated_at: new Date().toISOString(),
        }).eq('id', pid),
        SAVE_TIMEOUT_MS,
        'projects.update'
      )

      if (result?.error) throw result.error

      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setIsDirty(false)
    } catch (err) {
      console.error('Server save failed:', err)
      setSaveStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }, [setSaveStatus, setLastSavedAt, setIsDirty]) // only stable setters

  // ── Flush local draft to server (on reconnect) ─────────────────────
  const flushLocalDraft = useCallback(async () => {
    const { projectId: pid, fabricCanvas } = useEditorStore.getState()
    const { user } = useAuthStore.getState()
    const { activeSlideId, saveActiveSlide } = useSlideStore.getState()

    if (!pid || !user || !fabricCanvas || !activeSlideId) return
    try {
      const draft = await idbGet(`${LOCAL_DRAFT_PREFIX}${pid}`)
      if (!draft) return
      await fabricCanvas.loadFromJSON(draft.canvasState)
      fabricCanvas.renderAll()
      await saveActiveSlide(fabricCanvas)
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setIsDirty(false)
    } catch (err) {
      console.warn('Flush draft failed:', err)
    }
  }, [setSaveStatus, setLastSavedAt, setIsDirty])

  // ── Load draft from IndexedDB ──────────────────────────────────────
  const loadLocalDraft = useCallback(async (projId: string) => {
    try {
      const draft = await idbGet(`${LOCAL_DRAFT_PREFIX}${projId}`)
      return draft ?? null
    } catch {
      return null
    }
  }, [])

  // ── Set up intervals — deps are ONLY [projectId] ──────────────────
  useEffect(() => {
    if (!projectId) return

    localTimerRef.current = setInterval(saveLocalDraft, LOCAL_SYNC_INTERVAL_MS)
    serverTimerRef.current = setInterval(saveToServer, SERVER_SYNC_INTERVAL_MS)

    return () => {
      if (localTimerRef.current) clearInterval(localTimerRef.current)
      if (serverTimerRef.current) clearInterval(serverTimerRef.current)
      // Final save on unmount — only if dirty
      if (useEditorStore.getState().isDirty) saveToServer()
    }
  }, [projectId, saveLocalDraft, saveToServer])

  return { saveToServer, loadLocalDraft, flushLocalDraft }
}
