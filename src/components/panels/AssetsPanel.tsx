import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useEditorStore } from '../../stores/editorStore'
import { useAuthStore } from '../../stores/authStore'
import { UploadCloud, Image as ImageIcon, Loader2, Trash2, X, Check } from 'lucide-react'
import { Image as FabricImage } from 'fabric'
import toast from 'react-hot-toast'

type Asset = {
  name: string
  signedUrl: string
}

export default function AssetsPanel() {
  const { user } = useAuthStore()
  const { fabricCanvas } = useEditorStore()
  
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isLoadingRef = useRef(false) // guard against concurrent loads

  // Depend on user.id (string) not user (object ref) to prevent
  // redundant calls when auth token refreshes
  const userId = user?.id
  useEffect(() => {
    if (userId) loadAssets()
    else setIsLoading(false)
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadAssets = async () => {
    if (!user) return
    if (isLoadingRef.current) return // prevent concurrent loads
    isLoadingRef.current = true
    setIsLoading(true)

    // 10-second hard timeout — spinner can never hang forever
    const timeout = setTimeout(() => {
      console.warn('Asset load timed out')
      isLoadingRef.current = false
      setIsLoading(false)
    }, 10_000)

    try {
      const { data: fileList, error } = await supabase.storage
        .from('project-assets')
        .list(user.id, { sortBy: { column: 'created_at', order: 'desc' } })

      if (error) throw error

      if (fileList && fileList.length > 0) {
        const filtered = fileList.filter(f => f.name !== '.emptyFolderPlaceholder')

        // Use allSettled so one failed URL can't block the entire load
        const results = await Promise.allSettled(
          filtered.map(async (file) => {
            const { data, error } = await supabase.storage
              .from('project-assets')
              .createSignedUrl(`${user.id}/${file.name}`, 3600)
            if (error || !data?.signedUrl) return null
            return { name: file.name, signedUrl: data.signedUrl }
          })
        )
        const signed = results
          .filter((r): r is PromiseFulfilledResult<Asset | null> => r.status === 'fulfilled')
          .map(r => r.value)
          .filter((a): a is Asset => a !== null && !!a.signedUrl)
        setAssets(signed)
      } else {
        setAssets([])
      }
    } catch (err: any) {
      console.error('Failed to load assets', err)
      toast.error('Could not load your assets')
      setAssets([])
    } finally {
      clearTimeout(timeout)
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    if (!user) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast.error('Only PNG, JPG, and WEBP images are supported')
      return
    }

    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 10)}_${Date.now()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error } = await supabase.storage
        .from('project-assets')
        .upload(filePath, file)

      if (error) throw error

      toast.success('Asset uploaded!')
      await loadAssets()
    } catch (err: any) {
      console.error('Upload failed:', err)
      toast.error(err.message ?? 'Failed to upload asset')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const handleDelete = async (fileName: string) => {
    if (!user) return
    try {
      const { error } = await supabase.storage
        .from('project-assets')
        .remove([`${user.id}/${fileName}`])

      if (error) throw error
      setAssets(prev => prev.filter(a => a.name !== fileName))
      setConfirmDelete(null)
      toast.success('Asset deleted')
    } catch (err) {
      toast.error('Failed to delete asset')
    }
  }

  const addToCanvas = async (signedUrl: string) => {
    if (!fabricCanvas) return
    try {
      const img = await FabricImage.fromURL(signedUrl, { crossOrigin: 'anonymous' })
      
      const maxWidth = fabricCanvas.getWidth() * 0.5
      const maxHeight = fabricCanvas.getHeight() * 0.5
      let scale = 1
      if (img.width! > maxWidth || img.height! > maxHeight) {
        scale = Math.min(maxWidth / img.width!, maxHeight / img.height!)
      }
      
      img.scale(scale)
      img.set({
        left: fabricCanvas.getWidth() / 2,
        top: fabricCanvas.getHeight() / 2,
        originX: 'center',
        originY: 'center'
      })
      
      fabricCanvas.add(img)
      fabricCanvas.setActiveObject(img)
      fabricCanvas.renderAll()
      toast.success('Added to canvas')
    } catch (err) {
      console.error(err)
      toast.error('Failed to insert image')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-section space-y-2">
        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl py-4 flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
            isDragOver
              ? 'border-brand-400 bg-brand-600/10 text-brand-300'
              : 'border-surface-700 bg-surface-800/50 text-surface-400 hover:border-brand-500 hover:text-brand-400'
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[10px] font-medium">Uploading…</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-6 h-6" />
              <span className="text-[10px] font-medium">
                {isDragOver ? 'Drop image here' : 'Click or drag to upload'}
              </span>
              <span className="text-[9px] opacity-60">PNG · JPG · WEBP — up to 5MB</span>
            </>
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInputChange}
          accept="image/png, image/jpeg, image/webp"
          className="hidden"
        />
      </div>

      <div className="flex-1 scroll-area p-2">
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-xs font-semibold text-surface-200">Your Library</p>
          {assets.length > 0 && (
            <span className="text-[10px] text-surface-600">{assets.length} file{assets.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-surface-500" />
            <span className="text-xs text-surface-600">Loading assets…</span>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2 opacity-50">
            <ImageIcon className="w-8 h-8" />
            <span className="text-xs">No assets yet</span>
            <span className="text-[10px] leading-relaxed">Upload images to use them<br/>across your projects</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {assets.map(asset => (
              <div
                key={asset.name}
                className="relative group aspect-square rounded-xl overflow-hidden border border-surface-700 hover:border-brand-500 bg-surface-800 transition-all cursor-pointer"
                onClick={() => confirmDelete === asset.name ? undefined : addToCanvas(asset.signedUrl)}
              >
                <img
                  src={asset.signedUrl}
                  alt={asset.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  crossOrigin="anonymous"
                />
                
                {/* Hover overlay with actions */}
                {confirmDelete === asset.name ? (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2">
                    <p className="text-[10px] text-white text-center px-2">Delete this asset?</p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(asset.name) }}
                        className="flex items-center gap-1 px-2 py-1 bg-red-500 rounded-lg text-white text-[10px] hover:bg-red-400"
                      >
                        <Check className="w-3 h-3" /> Yes
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(null) }}
                        className="flex items-center gap-1 px-2 py-1 bg-surface-600 rounded-lg text-white text-[10px] hover:bg-surface-500"
                      >
                        <X className="w-3 h-3" /> No
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setConfirmDelete(asset.name) }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

