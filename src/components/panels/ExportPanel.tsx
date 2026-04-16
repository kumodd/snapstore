import { useState } from 'react'
import { Download, Loader2, CheckCircle } from 'lucide-react'
import { useEditorStore } from '../../stores/editorStore'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { DEVICES, DEVICE_MAP } from '../../data/devices'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface ExportPanelProps {
  projectId: string
}

type Format = 'png' | 'jpg' | 'webp'

export default function ExportPanel({ projectId }: ExportPanelProps) {
  const { fabricCanvas, selectedDevice, setSelectedDevice, isExporting, setIsExporting } = useEditorStore()
  const { profile, plan, canExport } = useAuthStore()

  const [format, setFormat] = useState<Format>('png')
  const [quality, setQuality] = useState(1.0)
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([selectedDevice.id])
  const [exportedUrl, setExportedUrl] = useState<string | null>(null)

  const toggleDevice = (id: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    )
  }

  const handleExport = async () => {
    if (!fabricCanvas) return

    if (!canExport()) {
      toast.error(`Free plan: ${profile?.export_count_this_month ?? 0}/10 exports used this month. Upgrade to Indie for unlimited.`)
      return
    }

    setIsExporting(true)
    setExportedUrl(null)

    try {
      // Deselect all objects for clean export
      fabricCanvas.discardActiveObject()
      fabricCanvas.renderAll()

      const originalDevice = selectedDevice
      const generatedUrls: string[] = []

      for (const deviceId of selectedDeviceIds) {
        const targetDevice = DEVICE_MAP[deviceId]
        if (!targetDevice) continue
        
        // 1. Resize canvas logically
        setSelectedDevice(targetDevice)
        
        // 2. Yield to let React and Fabric update dimensions/render
        await new Promise(resolve => setTimeout(resolve, 150))

        // 3. Export scaled snapshot
        const multiplier = targetDevice.scaleFactor
        const dataURL = fabricCanvas.toDataURL({
          format: format === 'jpg' ? 'jpeg' : format,
          quality,
          multiplier,
        })

        // 4. Upload to Storage
        const blob = await dataURLToBlob(dataURL)
        const fileName = `${profile?.id}/${projectId}/${Date.now()}-${targetDevice.id}.${format}`

        const { error: uploadError } = await supabase.storage
          .from('exports')
          .upload(fileName, blob, { contentType: `image/${format === 'jpg' ? 'jpeg' : format}`, upsert: true })

        if (uploadError) throw uploadError

        const { data: signedData } = await supabase.storage
          .from('exports')
          .createSignedUrl(fileName, 3600)

        if (signedData?.signedUrl) {
           generatedUrls.push(signedData.signedUrl)
        }

        // 5. Trigger physical download
        const link = document.createElement('a')
        link.href = dataURL
        link.download = `snapstore-${projectId}-${targetDevice.id}.${format}`
        link.click()
      }

      // Log export job
      await (supabase as any).from('export_jobs').insert({
        project_id: projectId,
        user_id: profile!.id,
        status: 'done',
        export_url: generatedUrls[0],
        format,
        devices: selectedDeviceIds,
      })

      // Increment export count
      if (plan === 'free') {
        await (supabase as any).from('profiles').update({
          export_count_this_month: (profile?.export_count_this_month ?? 0) + 1,
        }).eq('id', profile!.id)
      }

      setExportedUrl(generatedUrls[0] ?? null)
      toast.success(`Exported ${selectedDeviceIds.length} screenshots!`)

      // Restore original device
      setSelectedDevice(originalDevice)

    } catch (err: any) {
      console.error('Export failed:', err)
      toast.error(`Export failed: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-0">
      {/* Format */}
      <div className="panel-section">
        <p className="panel-section-title">Format</p>
        <div className="flex p-0.5 bg-surface-800 rounded-xl">
          {(['png', 'jpg', 'webp'] as Format[]).map(f => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={clsx(
                'flex-1 py-1.5 rounded-lg text-xs font-medium uppercase transition-colors',
                format === f ? 'bg-surface-600 text-white' : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Quality (for jpg/webp) */}
      {format !== 'png' && (
        <div className="panel-section">
          <label className="label">Quality ({Math.round(quality * 100)}%)</label>
          <input
            type="range" min={0.1} max={1} step={0.05}
            value={quality}
            onChange={e => setQuality(parseFloat(e.target.value))}
            className="w-full accent-brand-500"
          />
        </div>
      )}

      {/* Device selection */}
      <div className="panel-section">
        <p className="panel-section-title">Export for Devices</p>
        <div className="space-y-1">
          {DEVICES.slice(0, 5).map(device => (
            <label key={device.id} className="flex items-center gap-2.5 cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={selectedDeviceIds.includes(device.id)}
                onChange={() => toggleDevice(device.id)}
                className="accent-brand-500 w-3 h-3"
              />
              <span className="text-xs text-surface-300">{device.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Export button */}
      <div className="panel-section">
        {plan === 'free' && (
          <p className="text-[10px] text-surface-500 mb-2">
            {profile?.export_count_this_month ?? 0}/10 exports used this month
          </p>
        )}
        <button
          id="btn-export"
          onClick={handleExport}
          disabled={isExporting}
          className="btn-primary btn-md w-full"
        >
          {isExporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Exporting…</>
          ) : (
            <><Download className="w-4 h-4" /> Export Screenshot</>
          )}
        </button>

        {exportedUrl && (
          <a
            href={exportedUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 btn-secondary btn-sm w-full"
          >
            <CheckCircle className="w-3.5 h-3.5 text-accent-green" />
            View exported file
          </a>
        )}
      </div>
    </div>
  )
}

function dataURLToBlob(dataURL: string): Promise<Blob> {
  return new Promise(resolve => {
    const parts = dataURL.split(',')
    const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/png'
    const binary = atob(parts[1])
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i)
    resolve(new Blob([array], { type: mime }))
  })
}
