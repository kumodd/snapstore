import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useSlideStore } from '../../stores/slideStore'
import { useEditorStore } from '../../stores/editorStore'
import clsx from 'clsx'

interface Props {
  projectId: string
}

export default function SlideTimeline({ projectId }: Props) {
  const { fabricCanvas } = useEditorStore()
  const {
    slides, activeSlideId, isSwitching,
    switchSlide, addSlide, duplicateSlide, deleteSlide, reorderSlides
  } = useSlideStore()

  const [contextMenu, setContextMenu] = useState<{ slideId: string; x: number; y: number } | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleSlideClick = async (slideId: string) => {
    if (!fabricCanvas || isSwitching || slideId === activeSlideId) return
    await switchSlide(slideId, fabricCanvas)
  }

  const handleAdd = async () => {
    if (!fabricCanvas) return
    await addSlide(projectId, fabricCanvas)
  }

  const handleDuplicate = async (slideId: string) => {
    const slide = slides.find(s => s.id === slideId)
    if (!slide) return
    await duplicateSlide(slide, projectId)
    setContextMenu(null)
  }

  const handleDelete = async (slideId: string) => {
    if (!fabricCanvas || slides.length <= 1) return
    await deleteSlide(slideId, projectId, fabricCanvas)
    setContextMenu(null)
  }

  const handleContextMenu = (e: React.MouseEvent, slideId: string) => {
    e.preventDefault()
    setContextMenu({ slideId, x: e.clientX, y: e.clientY })
  }

  // Drag-to-reorder
  const handleDragStart = (index: number) => setDragIndex(index)
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }
  const handleDrop = async (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null); setDragOverIndex(null); return
    }
    await reorderSlides(projectId, dragIndex, index)
    setDragIndex(null); setDragOverIndex(null)
  }

  const activeIndex = slides.findIndex(s => s.id === activeSlideId)

  return (
    <>
      {/* Backdrop to close context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
      )}

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            key="ctx"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ top: contextMenu.y - 80, left: contextMenu.x }}
            className="fixed z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-xl py-1 min-w-[140px]"
          >
            <button
              onClick={() => handleDuplicate(contextMenu.slideId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-200 hover:bg-surface-700 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
            <button
              onClick={() => handleDelete(contextMenu.slideId)}
              disabled={slides.length <= 1}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-red hover:bg-surface-700 transition-colors disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline Bar */}
      <div className="h-28 bg-surface-900 border-t border-surface-800 flex items-center px-2 gap-2 flex-shrink-0 relative overflow-hidden">

        {/* Scroll left arrow */}
        {activeIndex > 2 && (
          <button
            className="flex-shrink-0 p-1 rounded-lg bg-surface-800 text-surface-400 hover:text-white"
            onClick={() => {
              const el = document.getElementById(`slide-thumb-${slides[activeIndex - 1]?.id}`)
              el?.scrollIntoView({ behavior: 'smooth', inline: 'center' })
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Slide thumbnails */}
        <div
          id="slide-timeline-scroll"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1 py-2"
        >
          <AnimatePresence initial={false}>
            {slides.map((slide, index) => {
              const isActive = slide.id === activeSlideId
              const isDraggingOver = dragOverIndex === index && dragIndex !== index

              return (
                <motion.div
                  key={slide.id}
                  id={`slide-thumb-${slide.id}`}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.15 }}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null) }}
                  onClick={() => handleSlideClick(slide.id)}
                  onContextMenu={(e) => handleContextMenu(e, slide.id)}
                  className={clsx(
                    'flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer select-none group',
                    isDraggingOver && 'translate-x-2'
                  )}
                >
                  {/* Number badge */}
                  <span className={clsx(
                    'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-brand-600 text-white' : 'text-surface-500'
                  )}>
                    {index + 1}
                  </span>

                  {/* Thumbnail */}
                  <div
                    className={clsx(
                      'relative w-14 h-[78px] rounded-lg overflow-hidden border-2 transition-all duration-150',
                      isActive
                        ? 'border-brand-500 shadow-glow-sm'
                        : 'border-surface-700 hover:border-surface-500 opacity-70 hover:opacity-100'
                    )}
                  >
                    {isSwitching && isActive ? (
                      <div className="absolute inset-0 bg-surface-800 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-surface-500" />
                      </div>
                    ) : slide.thumbnail_b64 ? (
                      <img
                        src={slide.thumbnail_b64}
                        alt={slide.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                        <span className="text-[8px] text-surface-600 text-center px-1">{slide.title}</span>
                      </div>
                    )}

                    {/* Active indicator line */}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500" />
                    )}
                  </div>

                  {/* Slide title */}
                  <span className={clsx(
                    'text-[9px] truncate w-14 text-center',
                    isActive ? 'text-brand-300 font-medium' : 'text-surface-600'
                  )}>
                    {slide.title}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Add slide button */}
          <motion.button
            layout
            onClick={handleAdd}
            className="flex-shrink-0 w-14 h-[78px] rounded-lg border-2 border-dashed border-surface-700 hover:border-brand-500 text-surface-600 hover:text-brand-400 flex flex-col items-center justify-center gap-1 transition-all duration-150 mt-4"
          >
            <Plus className="w-4 h-4" />
            <span className="text-[9px]">Add</span>
          </motion.button>
        </div>

        {/* Scroll right arrow */}
        {activeIndex < slides.length - 3 && (
          <button
            className="flex-shrink-0 p-1 rounded-lg bg-surface-800 text-surface-400 hover:text-white"
            onClick={() => {
              const el = document.getElementById(`slide-thumb-${slides[activeIndex + 1]?.id}`)
              el?.scrollIntoView({ behavior: 'smooth', inline: 'center' })
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Slide count badge */}
        <div className="absolute right-3 top-2 text-[9px] text-surface-600">
          {activeIndex + 1} / {slides.length}
        </div>
      </div>
    </>
  )
}
