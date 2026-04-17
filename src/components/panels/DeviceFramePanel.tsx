import { useState } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { getDevicesByPlatform } from '../../data/devices'
import { Smartphone, Tablet, ToggleLeft, ToggleRight, Upload } from 'lucide-react'
import clsx from 'clsx'
import { Image as FabricImage, Group, Rect } from 'fabric'
import { supabase } from '../../lib/supabase'

export default function DeviceFramePanel() {
  const { selectedDevice, setSelectedDevice, show3DFrame, setShow3DFrame, fabricCanvas } = useEditorStore()
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios')

  const devices = getDevicesByPlatform(platform)
  const phones = devices.filter(d => d.type === 'phone')
  const tablets = devices.filter(d => d.type === 'tablet')

  const insertFrame = async () => {
    if (!fabricCanvas) return

    // Ask user for the screenshot to put INSIDE the frame
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (f) => {
        const dataUrl = f.target?.result as string
        if (!dataUrl) return

        const path = show3DFrame && selectedDevice.frameImagePath3D ? selectedDevice.frameImagePath3D : selectedDevice.frameImagePath
        const { data } = supabase.storage.from('device-frames').getPublicUrl(path)
        
        try {
          const frameImg = await FabricImage.fromURL(data.publicUrl, { crossOrigin: 'anonymous' })
          const screenImg = await FabricImage.fromURL(dataUrl)
          
          // Fit screenshot into the frame's approximate screen area (assume 5% bezel)
          frameImg.originX = 'center'
          frameImg.originY = 'center'
          
          const screenW = frameImg.width! * 0.90
          const screenH = frameImg.height! * 0.96
          
          const screenScaleX = screenW / screenImg.width!
          const screenScaleY = screenH / screenImg.height!
          
          screenImg.scaleX = screenScaleX
          screenImg.scaleY = screenScaleY
          screenImg.originX = 'center'
          screenImg.originY = 'center'

          // Clip corners so it physically stays behind bezels
          const clipRect = new Rect({
            width: screenImg.width,
            height: screenImg.height,
            originX: 'center',
            originY: 'center',
            rx: 120, // aggressive curve for modern phones
            ry: 120
          })
          screenImg.set({ clipPath: clipRect })

          // Group them with screen behind frame
          const group = new Group([screenImg, frameImg], {
             left: fabricCanvas.getWidth() / 2,
             top: fabricCanvas.getHeight() / 2,
             originX: 'center',
             originY: 'center',
             name: `Mockup: ${selectedDevice.name}`
          } as any)
          
          // Auto-scale to fit canvas
          const maxWidth = fabricCanvas.getWidth() * 0.95
          const maxHeight = fabricCanvas.getHeight() * 0.95
          let scale = 1
          if (group.width! > maxWidth || group.height! > maxHeight) {
            scale = Math.min(maxWidth / group.width!, maxHeight / group.height!)
          }
          group.scale(scale)
          
          fabricCanvas.add(group)
          fabricCanvas.setActiveObject(group)
          fabricCanvas.renderAll()
        } catch (err) {
          console.error('Failed to load frame image', err)
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  return (
    <div className="space-y-0">
      {/* Platform toggle */}
      <div className="panel-section">
        <p className="panel-section-title">Platform</p>
        <div className="flex p-0.5 bg-surface-800 rounded-xl">
          {(['ios', 'android'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={clsx(
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors',
                platform === p ? 'bg-surface-600 text-white' : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {p === 'ios' ? 'iOS / iPadOS' : 'Android'}
            </button>
          ))}
        </div>
      </div>

      {/* 3D frame toggle */}
      <div className="panel-section flex items-center justify-between">
        <span className="text-xs text-surface-400">3D Perspective Frame</span>
        <button onClick={() => setShow3DFrame(!show3DFrame)} className="text-surface-400">
          {show3DFrame ? <ToggleRight className="w-5 h-5 text-brand-400" /> : <ToggleLeft className="w-5 h-5" />}
        </button>
      </div>

      <div className="panel-section pt-0">
        <button
          onClick={insertFrame}
          className="w-full btn-secondary btn-sm gap-2"
        >
          <Upload className="w-3.5 h-3.5" />
          Create Device Mockup
        </button>
      </div>

      {/* Phones */}
      {phones.length > 0 && (
        <div className="panel-section">
          <p className="panel-section-title flex items-center gap-1.5">
            <Smartphone className="w-3 h-3" /> Phones
          </p>
          <div className="space-y-1">
            {phones.map(device => (
              <button
                key={device.id}
                onClick={() => setSelectedDevice(device)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left',
                  selectedDevice.id === device.id
                    ? 'bg-brand-600/20 border border-brand-600/40 text-brand-300'
                    : 'hover:bg-surface-800 text-surface-400 hover:text-surface-200 border border-transparent'
                )}
              >
                <div>
                  <p className="font-medium text-surface-200 text-xs">{device.name}</p>
                  <p className="text-surface-600 text-[10px]">{device.width} × {device.height}px</p>
                </div>
                <span className="text-[10px] text-surface-600">{device.aspectRatio}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tablets */}
      {tablets.length > 0 && (
        <div className="panel-section">
          <p className="panel-section-title flex items-center gap-1.5">
            <Tablet className="w-3 h-3" /> Tablets
          </p>
          <div className="space-y-1">
            {tablets.map(device => (
              <button
                key={device.id}
                onClick={() => setSelectedDevice(device)}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left',
                  selectedDevice.id === device.id
                    ? 'bg-brand-600/20 border border-brand-600/40 text-brand-300'
                    : 'hover:bg-surface-800 text-surface-400 hover:text-surface-200 border border-transparent'
                )}
              >
                <div>
                  <p className="font-medium text-surface-200 text-xs">{device.name}</p>
                  <p className="text-surface-600 text-[10px]">{device.width} × {device.height}px</p>
                </div>
                <span className="text-[10px] text-surface-600">{device.aspectRatio}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
