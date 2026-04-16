import { useEffect, useRef, useCallback } from 'react'
import { get as idbGet, set as idbSet } from 'idb-keyval'
import { supabase } from '../lib/supabase'
import { useEditorStore } from '../stores/editorStore'
import { useAuthStore } from '../stores/authStore'

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
    const json = getCanvasJSON()
    if (!json) return

    setSaveStatus('saving')
    try {
      const { error } = await (supabase as any).from('projects').update({
        canvas_state: json,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId)

      if (error) throw error

      // Insert version snapshot
      await (supabase as any).from('project_versions').insert({
        project_id: projectId,
        canvas_state: json,
        version_number: Date.now(),
      })

      const now = new Date()
      setSaveStatus('saved')
      setLastSavedAt(now)
      setIsDirty(false)
    } catch (err) {
      console.error('Server save failed:', err)
      setSaveStatus('error')
    }
  }, [isDirty, projectId, user, getCanvasJSON, setSaveStatus, setLastSavedAt, setIsDirty])

  // Flush local IndexedDB draft to server (called on reconnect)
  const flushLocalDraft = useCallback(async () => {
    if (!projectId || !user) return
    try {
      const draft = await idbGet(`${LOCAL_DRAFT_PREFIX}${projectId}`)
      if (!draft) return
      const { error } = await (supabase as any).from('projects').update({
        canvas_state: draft.canvasState,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId)
      if (!error) {
        setSaveStatus('saved')
        setLastSavedAt(new Date())
        setIsDirty(false)
      }
    } catch (err) {
      console.warn('Flush draft failed:', err)
    }
  }, [projectId, user, setSaveStatus, setLastSavedAt, setIsDirty])

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
      // Final save on unmount
      saveToServer()
    }
  }, [projectId, saveLocalDraft, saveToServer])

  return { saveToServer, loadLocalDraft, flushLocalDraft }
}
