import { useState, useRef, useCallback } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { Rect } from 'fabric'

const PREDEFINED_COLORS = [
  '#ffffff', '#0f172a', '#1e293b', '#334155', '#475569',
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#4f46e5', '#8b5cf6',
  '#d946ef', '#fce7f3', '#fef3c7', '#e0e7ff', 'transparent'
]

const FONTS = ['Inter', 'Outfit', 'Georgia', 'Arial', 'Helvetica', 'Montserrat', 'Roboto', 'Playfair Display', 'Poppins', 'Lato', 'Oswald', 'Merriweather']
const WEIGHTS = [
  { label: 'Light', value: '300' },
  { label: 'Regular', value: 'normal' },
  { label: 'Medium', value: '500' },
  { label: 'Semibold', value: '600' },
  { label: 'Bold', value: 'bold' },
  { label: 'Extrabold', value: '800' }
]

// Use a proper union type for all dropdown states
type DropdownId = 'fill' | 'stroke' | 'font' | 'weight' | null

export default function PropertiesPanel() {
  const { selectedObjects, fabricCanvas, setIsDirty } = useEditorStore()

  // Use React state for dropdown visibility — no more ref hacks
  const [openDropdown, setOpenDropdown] = useState<DropdownId>(null)

  // Refs to track the "true original" value before any hover preview started
  const origFill = useRef<string | null>(null)
  const origStroke = useRef<string | null>(null)
  const origFontFamily = useRef<string | null>(null)
  const origFontWeight = useRef<string | null>(null)

  // Counter to force re-reads of object props after mutations
  const [, setTick] = useState(0)
  const refresh = useCallback(() => setTick(t => t + 1), [])

  if (selectedObjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <p className="text-xs text-surface-500">Select a layer to edit its properties</p>
      </div>
    )
  }

  const obj = selectedObjects[0] as any
  const type = obj.type
  const isMockupGroup = type === 'group' && obj.name?.startsWith('Mockup:')

  // ── Helpers ─────────────────────────────────────────────────────────

  /** Apply a property, render, mark dirty, and refresh the panel */
  const update = (props: Record<string, unknown>) => {
    obj.set(props)
    obj.setCoords?.()
    fabricCanvas?.renderAll()
    setIsDirty(true)
    refresh()
  }

  /** Preview a property on canvas WITHOUT marking dirty */
  const preview = (key: string, value: any) => {
    obj.set(key, value)
    fabricCanvas?.renderAll()
  }

  /** Revert a previewed property back to its original */
  const revert = (key: string, value: any) => {
    obj.set(key, value)
    fabricCanvas?.renderAll()
  }

  const toggleDropdown = (id: DropdownId) => {
    setOpenDropdown(prev => prev === id ? null : id)
  }

  // ── Scaled W/H ──────────────────────────────────────────────────────
  const scaledW = Math.round(obj.getScaledWidth?.() ?? obj.width ?? 0)
  const scaledH = Math.round(obj.getScaledHeight?.() ?? obj.height ?? 0)

  const updateSize = (dim: 'w' | 'h', value: number) => {
    if (value <= 0) return
    const rawW = obj.width ?? 1
    const rawH = obj.height ?? 1
    if (dim === 'w') update({ scaleX: value / rawW })
    else update({ scaleY: value / rawH })
  }

  const updateCornerRadius = (radius: number) => {
    if (type === 'rect') {
      update({ rx: radius, ry: radius })
    } else if (type === 'image') {
      const clipRect = new Rect({
        width: obj.width, height: obj.height,
        rx: radius, ry: radius,
        originX: 'center', originY: 'center',
      })
      obj.set({ clipPath: clipRect, _customRx: radius })
      fabricCanvas?.renderAll()
      setIsDirty(true)
      refresh()
    }
  }

  // ── Stroke helpers ──────────────────────────────────────────────────
  const currentStroke = isMockupGroup
    ? (obj.getObjects()[1]?.stroke ?? 'transparent')
    : (obj.stroke ?? 'transparent')

  const applyStroke = (val: string, commit = false) => {
    if (isMockupGroup) obj.getObjects()[1]?.set({ stroke: val })
    else obj.set({ stroke: val })
    fabricCanvas?.renderAll()
    if (commit) { setIsDirty(true); refresh() }
  }

  // ── Color swatch grid (reusable for fill and stroke) ────────────────
  const ColorGrid = ({
    onSelect,
    onHoverStart,
    onHoverEnd,
    currentColor,
    customDefault,
  }: {
    onSelect: (c: string) => void
    onHoverStart: (c: string) => void
    onHoverEnd: () => void
    currentColor: string
    customDefault: string
  }) => (
    <div
      className="absolute top-10 left-0 z-50 p-2.5 bg-surface-800 border border-surface-700 rounded-xl shadow-xl w-[180px]"
      onMouseDown={e => e.stopPropagation()} // prevent dropdown close
    >
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {PREDEFINED_COLORS.map(c => (
          <button
            key={c}
            onMouseEnter={() => onHoverStart(c)}
            onMouseLeave={onHoverEnd}
            onClick={() => onSelect(c)}
            className={clsx(
              'w-6 h-6 rounded-md hover:scale-125 transition-transform border border-surface-600/50 hover:ring-2 hover:ring-white/50',
              c === 'transparent' && 'bg-gradient-to-br from-gray-300 to-white'
            )}
            style={{ backgroundColor: c !== 'transparent' ? c : undefined }}
            title={c}
          />
        ))}
      </div>
      <div className="pt-1.5 border-t border-surface-700">
        <label className="text-[9px] text-surface-500 uppercase tracking-wider block mb-1">Custom Color</label>
        <input
          type="color"
          defaultValue={currentColor && currentColor !== 'transparent' ? currentColor : customDefault}
          onInput={e => {
            // Live preview as the user drags the pointer — do NOT close the picker
            const val = (e.target as HTMLInputElement).value
            onHoverStart(val)
          }}
          onChange={e => {
            // Final commit when the native picker is closed
            onSelect(e.target.value)
          }}
          className="w-full h-8 rounded-lg cursor-pointer bg-transparent border border-surface-600"
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-0" onMouseDown={() => {
      // Close all dropdowns when clicking outside them
      // (the dropdown containers use stopPropagation to prevent this)
    }}>
      {/* ── Transform ──────────────────────────────────────────────── */}
      <div className="panel-section">
        <p className="panel-section-title">Transform</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'X', key: 'left', value: Math.round(obj.left ?? 0) },
            { label: 'Y', key: 'top', value: Math.round(obj.top ?? 0) },
          ].map(field => (
            <div key={field.key}>
              <label className="label">{field.label}</label>
              <input type="number" value={field.value}
                onChange={e => update({ [field.key]: parseFloat(e.target.value) })}
                className="input-sm text-right" />
            </div>
          ))}
          <div>
            <label className="label">W</label>
            <input type="number" value={scaledW}
              onChange={e => updateSize('w', parseFloat(e.target.value))}
              className="input-sm text-right" />
          </div>
          <div>
            <label className="label">H</label>
            <input type="number" value={scaledH}
              onChange={e => updateSize('h', parseFloat(e.target.value))}
              className="input-sm text-right" />
          </div>
        </div>
        <div className="mt-2">
          <label className="label">Rotation</label>
          <input type="number" value={Math.round(obj.angle ?? 0)}
            onChange={e => update({ angle: parseFloat(e.target.value) })}
            className="input-sm" />
        </div>
        <div className="mt-2">
          <label className="label">Opacity ({Math.round((obj.opacity ?? 1) * 100)}%)</label>
          <input type="range" min={0} max={1} step={0.01}
            value={obj.opacity ?? 1}
            onChange={e => update({ opacity: parseFloat(e.target.value) })}
            className="w-full accent-brand-500" />
        </div>
      </div>

      {/* ── Fill / Text Color ──────────────────────────────────────── */}
      {(type === 'rect' || type === 'circle' || type === 'i-text' || type === 'textbox') && (
        <div className="panel-section">
          <p className="panel-section-title">{type.includes('text') ? 'Text Color' : 'Fill'}</p>
          <div className="flex items-center gap-2 mb-2 relative">
            <div
              className="w-8 h-8 rounded-lg border-2 border-surface-600 cursor-pointer flex-shrink-0"
              style={{ backgroundColor: obj.fill as string ?? '#6171f6' }}
              onClick={() => toggleDropdown('fill')}
            />
            {openDropdown === 'fill' && (
              <ColorGrid
                currentColor={obj.fill as string ?? '#6171f6'}
                customDefault="#6171f6"
                onHoverStart={c => {
                  if (origFill.current === null) origFill.current = obj.fill ?? '#6171f6'
                  preview('fill', c)
                }}
                onHoverEnd={() => {
                  if (origFill.current !== null) revert('fill', origFill.current)
                }}
                onSelect={c => {
                  update({ fill: c })
                  origFill.current = null
                  setOpenDropdown(null)
                }}
              />
            )}
            <input type="text"
              value={(obj.fill as string) ?? '#6171f6'}
              onChange={e => update({ fill: e.target.value })}
              className="input-sm flex-1 font-mono"
              placeholder="#6171f6" />
          </div>
        </div>
      )}

      {/* ── Typography ─────────────────────────────────────────────── */}
      {(type === 'i-text' || type === 'textbox') && (
        <div className="panel-section space-y-2">
          <p className="panel-section-title">Typography</p>

          {/* Font Family */}
          <div className="relative">
            <label className="label">Font Family</label>
            <button
              className="input-sm w-full text-left flex items-center justify-between"
              onClick={() => toggleDropdown('font')}
            >
              <span style={{ fontFamily: obj.fontFamily ?? 'Inter' }}>{obj.fontFamily ?? 'Inter'}</span>
              <ChevronDown className="w-3 h-3 text-surface-500" />
            </button>
            {openDropdown === 'font' && (
              <div
                className="absolute top-14 left-0 w-full z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-xl max-h-60 overflow-y-auto no-scrollbar py-1"
                onMouseDown={e => e.stopPropagation()}
              >
                {FONTS.map(f => (
                  <button
                    key={f}
                    onMouseEnter={() => {
                      if (origFontFamily.current === null) origFontFamily.current = obj.fontFamily ?? 'Inter'
                      preview('fontFamily', f)
                    }}
                    onMouseLeave={() => {
                      if (origFontFamily.current !== null) revert('fontFamily', origFontFamily.current)
                    }}
                    onClick={() => {
                      update({ fontFamily: f })
                      origFontFamily.current = null
                      setOpenDropdown(null)
                    }}
                    className={clsx(
                      'w-full text-left px-3 py-1.5 text-sm hover:bg-surface-700 transition-colors',
                      obj.fontFamily === f ? 'text-brand-400 font-semibold' : 'text-surface-200'
                    )}
                    style={{ fontFamily: f }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Font Size + Weight */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Size</label>
              <input type="number" value={obj.fontSize ?? 32}
                onChange={e => update({ fontSize: parseInt(e.target.value) || 16 })}
                className="input-sm" />
            </div>
            <div className="relative">
              <label className="label">Weight</label>
              <button className="input-sm w-full text-left flex items-center justify-between"
                onClick={() => toggleDropdown('weight')}
              >
                <span>{WEIGHTS.find(w => w.value === String(obj.fontWeight ?? 'normal'))?.label ?? 'Regular'}</span>
                <ChevronDown className="w-3 h-3 text-surface-500" />
              </button>
              {openDropdown === 'weight' && (
                <div
                  className="absolute top-14 left-0 w-full z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-xl py-1"
                  onMouseDown={e => e.stopPropagation()}
                >
                  {WEIGHTS.map(w => (
                    <button
                      key={w.value}
                      onMouseEnter={() => {
                        if (origFontWeight.current === null) origFontWeight.current = String(obj.fontWeight ?? 'normal')
                        preview('fontWeight', w.value)
                      }}
                      onMouseLeave={() => {
                        if (origFontWeight.current !== null) revert('fontWeight', origFontWeight.current)
                      }}
                      onClick={() => {
                        update({ fontWeight: w.value })
                        origFontWeight.current = null
                        setOpenDropdown(null)
                      }}
                      className={clsx(
                        'w-full text-left px-3 py-1.5 text-sm hover:bg-surface-700 transition-colors',
                        String(obj.fontWeight) === w.value ? 'text-brand-400 font-semibold' : 'text-surface-200'
                      )}
                      style={{ fontWeight: w.value }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Line Height */}
          <div>
            <label className="label">Line Height</label>
            <input type="number" step={0.1} min={0.5} max={4}
              value={obj.lineHeight ?? 1.2}
              onChange={e => update({ lineHeight: parseFloat(e.target.value) || 1.2 })}
              className="input-sm" />
          </div>

          {/* Letter Spacing */}
          <div>
            <label className="label">Letter Spacing</label>
            <input type="number"
              value={obj.charSpacing ?? 0}
              onChange={e => update({ charSpacing: parseInt(e.target.value) || 0 })}
              className="input-sm" />
          </div>

          {/* Alignment */}
          <div>
            <label className="label">Alignment</label>
            <div className="flex items-center gap-1">
              {[
                { icon: AlignLeft, value: 'left' },
                { icon: AlignCenter, value: 'center' },
                { icon: AlignRight, value: 'right' },
              ].map(align => (
                <button key={align.value}
                  onClick={() => update({ textAlign: align.value })}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg flex items-center justify-center transition-colors',
                    obj.textAlign === align.value
                      ? 'bg-brand-600 text-white'
                      : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                  )}
                >
                  <align.icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Bold / Italic toggles */}
          <div className="flex gap-1">
            <button
              onClick={() => update({ fontWeight: obj.fontWeight === 'bold' ? 'normal' : 'bold' })}
              className={clsx(
                'flex-1 py-1.5 rounded-lg flex items-center justify-center transition-colors',
                obj.fontWeight === 'bold'
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-200'
              )}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => update({ fontStyle: obj.fontStyle === 'italic' ? 'normal' : 'italic' })}
              className={clsx(
                'flex-1 py-1.5 rounded-lg flex items-center justify-center transition-colors',
                obj.fontStyle === 'italic'
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-surface-200'
              )}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Stroke ─────────────────────────────────────────────────── */}
      {(type === 'rect' || type === 'circle' || isMockupGroup) && (
        <div className="panel-section space-y-2">
          <p className="panel-section-title">{isMockupGroup ? 'Mockup Frame Color' : 'Stroke'}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <label className="label">Color</label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg border-2 border-surface-600 cursor-pointer flex-shrink-0"
                  style={{ backgroundColor: currentStroke }}
                  onClick={() => toggleDropdown('stroke')}
                />
                <input type="text" value={currentStroke}
                  onChange={e => applyStroke(e.target.value, true)}
                  className="input-sm font-mono flex-1" placeholder="none" />
              </div>
              {openDropdown === 'stroke' && (
                <ColorGrid
                  currentColor={currentStroke}
                  customDefault="#334155"
                  onHoverStart={c => {
                    if (origStroke.current === null) origStroke.current = currentStroke
                    applyStroke(c)
                  }}
                  onHoverEnd={() => {
                    if (origStroke.current !== null) applyStroke(origStroke.current)
                  }}
                  onSelect={c => {
                    applyStroke(c, true)
                    origStroke.current = null
                    setOpenDropdown(null)
                  }}
                />
              )}
            </div>
            <div>
              <label className="label">Width</label>
              <input type="number"
                value={(isMockupGroup ? obj.getObjects()[1]?.strokeWidth : obj.strokeWidth) as number ?? 0}
                onChange={e => {
                  if (isMockupGroup) {
                    obj.getObjects()[1]?.set({ strokeWidth: parseInt(e.target.value) || 0 })
                    fabricCanvas?.renderAll()
                  } else {
                    update({ strokeWidth: parseInt(e.target.value) || 0 })
                  }
                  setIsDirty(true)
                  refresh()
                }}
                className="input-sm" />
            </div>
          </div>
          {type === 'rect' && (
            <div>
              <label className="label">Corner Radius</label>
              <input type="number" value={obj.rx ?? 0}
                onChange={e => updateCornerRadius(parseInt(e.target.value) || 0)}
                className="input-sm" />
            </div>
          )}
        </div>
      )}

      {/* ── Image Corner Radius ────────────────────────────────────── */}
      {type === 'image' && (
        <div className="panel-section space-y-2">
          <p className="panel-section-title">Image Styling</p>
          <div>
            <label className="label">Corner Radius</label>
            <input type="number" value={obj._customRx ?? 0}
              onChange={e => updateCornerRadius(parseInt(e.target.value) || 0)}
              className="input-sm" />
          </div>
        </div>
      )}
    </div>
  )
}
