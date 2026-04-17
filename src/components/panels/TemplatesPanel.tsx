import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useEditorStore } from '../../stores/editorStore'
import type { Template } from '../../lib/database.types'
import { Search, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import { Rect, IText, Image as FabricImage, Shadow, Group } from 'fabric'

const CATEGORIES = ['All', 'Finance', 'Health', 'Gaming', 'Productivity', 'Social', 'Shopping', 'Travel', 'Education']

export default function TemplatesPanel() {
  const { fabricCanvas, selectedDevice } = useEditorStore()
  const [templates, setTemplates] = useState<Template[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  useEffect(() => {
    supabase.from('templates').select('*').eq('is_approved', true).order('download_count', { ascending: false })
      .then(({ data }) => { setTemplates(data ?? []); setIsLoading(false) })
  }, [])

  const filtered = templates.filter(t => {
    const matchSearch = t.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === 'All' || t.category === activeCategory
    return matchSearch && matchCat
  })

  const applyTemplate = async (template: Template) => {
    if (!fabricCanvas) return
    await fabricCanvas.loadFromJSON(template.canvas_state as object)
    fabricCanvas.renderAll()
    // Increment download count
    ;(supabase as any).from('templates').update({ download_count: (template.download_count ?? 0) + 1 }).eq('id', template.id)
  }

  const applyGenerativeTemplate = async (type: 'flat' | 'angled' | 'minimal' | 'premium') => {
    if (!fabricCanvas) return
    fabricCanvas.clear()
    
    const w = fabricCanvas.getWidth()
    const h = fabricCanvas.getHeight()

    // 1. Background
    let bgColor = '#4f46e5'
    if (type === 'angled') bgColor = '#0f172a'
    if (type === 'minimal') bgColor = '#f8fafc'
    if (type === 'premium') bgColor = '#fce7f3' // Premium soft pink/peach vibe

    const bg = new Rect({
       left: 0, top: 0, width: w, height: h,
       fill: bgColor,
       selectable: true,
       lockMovementX: true, lockMovementY: true,
       lockScalingX: true, lockScalingY: true,
       lockRotation: true, hasControls: false,
       name: 'Background'
    })
    fabricCanvas.add(bg)

    // 2. Texts
    const titleText = {
      flat: "Track Your Daily Goals",
      angled: "Boost Your Workflow",
      minimal: "Simply Better Finances",
      premium: "Find Your Inner Peace"
    }[type]

    const subText = {
      flat: "Achieve More, Stay Motivated, & Feel Great.",
      angled: "Organize tasks and maximize productivity.",
      minimal: "Track. Budget. Save. Beautifully.",
      premium: "Experience calm with immersive soundscapes."
    }[type]

    const textColor = (type === 'minimal' || type === 'premium') ? '#0f172a' : '#ffffff'
    const subColor = (type === 'minimal' || type === 'premium') ? '#475569' : '#cbd5e1'

    const title = new IText(titleText, {
       left: w / 2,
       top: h * 0.1,
       originX: 'center',
       fontSize: Math.round(w * 0.08),
       fontWeight: 'bold',
       fill: textColor,
       fontFamily: 'Inter',
       textAlign: 'center'
    })
    fabricCanvas.add(title)
    
    const subTitle = new IText(subText, {
       left: w / 2,
       top: h * 0.1 + title.height! + 20,
       originX: 'center',
       fontSize: Math.round(w * 0.035),
       fill: subColor,
       fontFamily: 'Inter',
       textAlign: 'center'
    })
    fabricCanvas.add(subTitle)

    // 3. Device Frame
    // Attempt to use 3D frame for Angled style if available
    const path = selectedDevice.frameImagePath
    const { data } = supabase.storage.from('device-frames').getPublicUrl(path)
    
    let frameImg: any = null
    try {
      frameImg = await FabricImage.fromURL(data.publicUrl, { crossOrigin: 'anonymous' })
    } catch (e) {
      console.warn('Frame load failed, using vector fallback', e)
    }

    const targetHeight = h * 0.65
    
    if (frameImg) {
      const scale = targetHeight / frameImg.height!
      const screenW = frameImg.width! * 0.90
      const screenH = frameImg.height! * 0.96
      const screen = new Rect({
         width: screenW, height: screenH,
         originX: 'center', originY: 'center',
         fill: '#1e293b',
         rx: 120, ry: 120
      })
      frameImg.originX = 'center'
      frameImg.originY = 'center'

      const group = new Group([screen, frameImg], {
        left: w / 2, top: h * 0.28,
        originX: 'center', originY: 'top',
        name: `Mockup: ${selectedDevice.name}`,
        selectable: false
      } as any)
      group.scale(scale)
      if (type === 'premium') {
        group.set({ shadow: new Shadow({ color: 'rgba(0,0,0,0.3)', blur: 60, offsetX: 0, offsetY: 30 }) })
      }
      fabricCanvas.add(group)
    } else {
      // Premium Vector Fallback Engine
      const ratio = selectedDevice.width / selectedDevice.height
      const screenW = targetHeight * ratio
      const screenH = targetHeight
      
      const isTablet = selectedDevice.type === 'tablet'
      const frameBezel = new Rect({
         width: screenW + (isTablet ? 40 : 30), 
         height: screenH + (isTablet ? 40 : 30),
         originX: 'center', originY: 'center',
         fill: 'transparent',
         stroke: type === 'minimal' || type === 'flat' ? '#cbd5e1' : '#334155',
         strokeWidth: isTablet ? 15 : 20,
         rx: isTablet ? 25 : 50, ry: isTablet ? 25 : 50
      })
      
      const screen = new Rect({
         width: screenW, height: screenH,
         originX: 'center', originY: 'center',
         fill: '#1e293b',
         rx: isTablet ? 15 : 35, ry: isTablet ? 15 : 35
      })

      const group = new Group([screen, frameBezel], {
        left: w / 2, top: h * 0.28,
        originX: 'center', originY: 'top',
        name: `Mockup: ${selectedDevice.name}`,
        selectable: false
      } as any)
      
      if (type === 'premium') {
        group.set({ shadow: new Shadow({ color: 'rgba(0,0,0,0.3)', blur: 60, offsetX: 0, offsetY: 30 }) })
      }
      fabricCanvas.add(group)
    }

    fabricCanvas.renderAll()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="panel-section space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-surface-500" />
          <input
            type="text"
            placeholder="Search templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-sm pl-7"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.slice(0, 5).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                'px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-200'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 scroll-area p-2 space-y-4">
        
        {/* Quick Generative Layouts */}
        <div>
          <p className="text-xs font-semibold text-surface-200 mb-2 px-1">Quick Layouts</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => applyGenerativeTemplate('flat')}
              className="bg-brand-600/20 border border-brand-500/30 rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-brand-600/30 transition-colors"
            >
              <div className="w-8 h-10 bg-brand-500 rounded-sm opacity-80" />
              <span className="text-[10px] font-medium text-brand-200">Flat ASO</span>
            </button>
            <button
              onClick={() => applyGenerativeTemplate('angled')}
              className="bg-surface-800 border border-surface-700 rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-surface-700 transition-colors"
            >
              <div className="w-8 h-10 bg-surface-900 border border-surface-600 rounded-sm opacity-80 transform rotate-[-5deg]" />
              <span className="text-[10px] font-medium text-surface-300">Angled Style</span>
            </button>
            <button
              onClick={() => applyGenerativeTemplate('minimal')}
              className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-colors"
            >
              <div className="w-8 h-10 bg-white rounded-sm opacity-80" />
              <span className="text-[10px] font-medium text-surface-200">Minimal</span>
            </button>
            <button
              onClick={() => applyGenerativeTemplate('premium')}
              className="bg-accent-peach/10 border border-accent-peach/20 rounded-xl p-3 flex flex-col items-center justify-center gap-2 hover:bg-accent-peach/20 transition-colors"
            >
              <div className="w-8 h-10 bg-accent-peach shadow-glow-sm rounded-sm opacity-80" />
              <span className="text-[10px] font-medium text-surface-200">Premium 3D</span>
            </button>
          </div>
        </div>

        <div>
           <p className="text-xs font-semibold text-surface-200 mb-2 px-1">Community</p>
        
        {isLoading ? (
          <div className="flex items-center justify-center h-24">
            <Loader2 className="w-4 h-4 text-surface-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-surface-600 text-center py-4">No community templates found</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map(template => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="group rounded-xl overflow-hidden border border-surface-700 hover:border-brand-600/60 transition-all hover:scale-[1.02]"
                title={template.name}
              >
                {template.thumbnail_url ? (
                  <img src={template.thumbnail_url} alt={template.name} className="w-full aspect-[9/16] object-cover" />
                ) : (
                  <div className="w-full aspect-[9/16] bg-surface-800 flex items-center justify-center">
                    <span className="text-[10px] text-surface-600">{template.name}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
