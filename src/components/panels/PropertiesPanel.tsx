import { useRef } from 'react'
import { useEditorStore } from '../../stores/editorStore'
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react'
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

// Tracks which color picker is open
type PickerOpen = 'fill' | 'stroke' | 'none'

export default function PropertiesPanel() {
  const { selectedObjects, fabricCanvas, setIsDirty } = useEditorStore()
  const pickerOpen = useRef<PickerOpen>('none')
  const forceUpdate = useEditorStore(s => s.setSelectedObjects)

  const origFill = useRef<string>('')
  const origStroke = useRef<string>('')
  const origFontFamily = useRef<string>('')
  const origFontWeight = useRef<string>('')


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

  /** Apply a property immediately and mark the project dirty */
  const update = (props: Record<string, unknown>) => {
    obj.set(props)
    obj.setCoords?.()
    fabricCanvas?.renderAll()
    setIsDirty(true)
  }

  /** Live preview a property WITHOUT committing or marking dirty */
  const previewProp = (key: string, value: any) => {
    obj.set(key, value)
    fabricCanvas?.renderAll()
  }

  /** Revert to original WITHOUT marking dirty */
  const revertProp = (key: string, value: any) => {
    obj.set(key, value)
    fabricCanvas?.renderAll()
  }

  // ── Scaled Width/Height handling ────────────────────────────────────
  const scaledW = Math.round(obj.getScaledWidth?.() ?? obj.width ?? 0)
  const scaledH = Math.round(obj.getScaledHeight?.() ?? obj.height ?? 0)

  const updateSize = (dim: 'w' | 'h', value: number) => {
    if (value <= 0) return
    const rawW = obj.width ?? 1
    const rawH = obj.height ?? 1
    if (dim === 'w') {
      update({ scaleX: value / rawW })
    } else {
      update({ scaleY: value / rawH })
    }
  }

  const updateCornerRadius = (radius: number) => {
    if (type === 'rect') {
      update({ rx: radius, ry: radius })
    } else if (type === 'image') {
      const clipRect = new Rect({
        width: obj.width,
        height: obj.height,
        rx: radius,
        ry: radius,
        originX: 'center',
        originY: 'center',
      })
      obj.set({ clipPath: clipRect, _customRx: radius })
      fabricCanvas?.renderAll()
      setIsDirty(true)
    }
  }

  const openPicker = (p: PickerOpen) => {
    pickerOpen.current = pickerOpen.current === p ? 'none' : p
    forceUpdate([...selectedObjects])
  }

  const currentStroke = isMockupGroup
    ? (obj.getObjects()[1]?.stroke ?? 'transparent')
    : (obj.stroke ?? 'transparent')

  const applyStrokeChange = (val: string, commit = false) => {
    if (isMockupGroup) {
      obj.getObjects()[1]?.set({ stroke: val })
    } else {
      obj.set({ stroke: val })
    }
    fabricCanvas?.renderAll()
    if (commit) setIsDirty(true)
  }

  return (
    <div className="space-y-0">
      {/* Position & size */}
      <div className="panel-section">
        <p className="panel-section-title">Transform</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'X', key: 'left', value: Math.round(obj.left ?? 0) },
            { label: 'Y', key: 'top', value: Math.round(obj.top ?? 0) },
          ].map(field => (
            <div key={field.key}>
              <label className="label">{field.label}</label>
              <input
                type="number"
                value={field.value}
                onChange={e => update({ [field.key]: parseFloat(e.target.value) })}
                className="input-sm text-right"
              />
            </div>
          ))}
          <div>
            <label className="label">W</label>
            <input
              type="number"
              value={scaledW}
              onChange={e => updateSize('w', parseFloat(e.target.value))}
              className="input-sm text-right"
            />
          </div>
          <div>
            <label className="label">H</label>
            <input
              type="number"
              value={scaledH}
              onChange={e => updateSize('h', parseFloat(e.target.value))}
              className="input-sm text-right"
            />
          </div>
        </div>
        <div className="mt-2">
          <label className="label">Rotation</label>
          <input
            type="number"
            value={Math.round(obj.angle ?? 0)}
            onChange={e => update({ angle: parseFloat(e.target.value) })}
            className="input-sm"
          />
        </div>
        <div className="mt-2">
          <label className="label">Opacity ({Math.round((obj.opacity ?? 1) * 100)}%)</label>
          <input
            type="range"
            min={0} max={1} step={0.01}
            value={obj.opacity ?? 1}
            onChange={e => update({ opacity: parseFloat(e.target.value) })}
            className="w-full accent-brand-500"
          />
        </div>
      </div>

      {/* Fill color */}
      {(type === 'rect' || type === 'circle' || type === 'i-text' || type === 'textbox') && (
        <div className="panel-section">
          <p className="panel-section-title">{type.includes('text') ? 'Text Color' : 'Fill'}</p>
          <div className="flex items-center gap-2 mb-2 relative">
            <div
              className="w-8 h-8 rounded-lg border-2 border-surface-600 cursor-pointer flex-shrink-0"
              style={{ backgroundColor: obj.fill as string ?? '#6171f6' }}
              onClick={() => openPicker('fill')}
            />
            {pickerOpen.current === 'fill' && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-surface-800 border border-surface-700 rounded-xl shadow-xl w-[156px]">
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c}
                      onMouseEnter={() => {
                        origFill.current = obj.fill ?? '#6171f6'
                        previewProp('fill', c)
                      }}
                      onMouseLeave={() => revertProp('fill', origFill.current)}
                      onClick={() => { update({ fill: c }); openPicker('none') }}
                      className={clsx(
                        'w-5 h-5 rounded-md hover:scale-125 transition-transform border border-surface-600/50 ring-0 hover:ring-2 hover:ring-white/50',
                        c === 'transparent' && 'bg-gradient-to-br from-gray-300 to-white'
                      )}
                      style={{ backgroundColor: c !== 'transparent' ? c : undefined }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-surface-700">
                  <label className="text-[9px] text-surface-500 uppercase tracking-wider flex-shrink-0">Custom</label>
                  <input
                    type="color"
                    defaultValue={typeof obj.fill === 'string' && obj.fill !== 'transparent' ? obj.fill : '#6171f6'}
                    onInput={e => previewProp('fill', (e.target as HTMLInputElement).value)}
                    onChange={e => { update({ fill: e.target.value }); openPicker('none') }}
                    className="w-full h-6 rounded cursor-pointer bg-transparent"
                  />
                </div>
              </div>
            )}
            <input
              type="text"
              value={(obj.fill as string) ?? '#6171f6'}
              onChange={e => update({ fill: e.target.value })}
              className="input-sm flex-1 font-mono"
              placeholder="#6171f6"
            />
          </div>
        </div>
      )}

      {/* Text specific */}
      {(type === 'i-text' || type === 'textbox') && (
        <div className="panel-section space-y-2">
          <p className="panel-section-title">Typography</p>
          <div className="relative">
            <label className="label">Font Family</label>
            <button
              className="input-sm w-full text-left flex items-center justify-between"
              onClick={() => openPicker(pickerOpen.current === 'fill' ? 'fill' : 'none')}
              onClickCapture={() => {
                // Toggle a custom font picker state using rerender trick
                const next = pickerOpen.current === ('font' as any) ? 'none' : 'font'
                pickerOpen.current = next as any
                forceUpdate([...selectedObjects])
              }}
            >
              <span style={{ fontFamily: obj.fontFamily ?? 'Inter' }}>{obj.fontFamily ?? 'Inter'}</span>
            </button>
            {(pickerOpen.current as any) === 'font' && (
              <div className="absolute top-14 left-0 w-full z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-xl max-h-60 overflow-y-auto no-scrollbar py-1">
                {FONTS.map(f => (
                  <button
                    key={f}
                    onMouseEnter={() => {
                      if (origFontFamily.current === '') origFontFamily.current = obj.fontFamily ?? 'Inter'
                      previewProp('fontFamily', f)
                    }}
                    onMouseLeave={() => {
                      revertProp('fontFamily', origFontFamily.current)
                    }}
                    onClick={() => {
                      update({ fontFamily: f })
                      origFontFamily.current = f
                      pickerOpen.current = 'none'
                      forceUpdate([...selectedObjects])
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Size</label>
              <input
                type="number"
                value={obj.fontSize ?? 32}
                onChange={e => update({ fontSize: parseInt(e.target.value) })}
                className="input-sm"
              />
            </div>
            <div className="relative">
              <label className="label">Weight</label>
              <button
                className="input-sm w-full text-left"
                onClick={() => {
                  pickerOpen.current = pickerOpen.current === ('weight' as any) ? 'none' : 'weight' as any
                  forceUpdate([...selectedObjects])
                }}
              >
                {WEIGHTS.find(w => w.value === (obj.fontWeight ?? 'normal'))?.label ?? 'Regular'}
              </button>
              {(pickerOpen.current as any) === 'weight' && (
                <div className="absolute top-14 left-0 w-full z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-xl py-1">
                  {WEIGHTS.map(w => (
                    <button
                      key={w.value}
                      onMouseEnter={() => {
                        if (origFontWeight.current === '') origFontWeight.current = obj.fontWeight ?? 'normal'
                        previewProp('fontWeight', w.value)
                      }}
                      onMouseLeave={() => revertProp('fontWeight', origFontWeight.current)}
                      onClick={() => {
                        update({ fontWeight: w.value })
                        origFontWeight.current = w.value
                        pickerOpen.current = 'none'
                        forceUpdate([...selectedObjects])
                      }}
                      className={clsx(
                        'w-full text-left px-3 py-1.5 text-sm hover:bg-surface-700 transition-colors',
                        obj.fontWeight === w.value ? 'text-brand-400 font-semibold' : 'text-surface-200'
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
          <div>
            <label className="label">Letter Spacing</label>
            <input
              type="number"
              value={obj.charSpacing ?? 0}
              onChange={e => update({ charSpacing: parseInt(e.target.value) })}
              className="input-sm"
            />
          </div>
          <div>
            <label className="label">Alignment</label>
            <div className="flex items-center gap-1">
              {[
                { icon: AlignLeft, value: 'left' },
                { icon: AlignCenter, value: 'center' },
                { icon: AlignRight, value: 'right' },
              ].map(align => (
                <button
                  key={align.value}
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
          <div className="flex gap-1">
            {[
              { icon: Bold, prop: 'fontWeight', value: 'bold', activeValue: 'bold' },
              { icon: Italic, prop: 'fontStyle', value: 'italic', activeValue: 'italic' },
            ].map(btn => (
              <button
                key={btn.prop}
                onClick={() => update({ [btn.prop]: obj[btn.prop] === btn.activeValue ? 'normal' : btn.value })}
                className={clsx(
                  'flex-1 py-1.5 rounded-lg flex items-center justify-center transition-colors',
                  obj[btn.prop] === btn.activeValue
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-800 text-surface-400 hover:text-surface-200'
                )}
              >
                <btn.icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Shape stroke */}
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
                  onClick={() => openPicker('stroke')}
                />
                <input
                  type="text"
                  value={currentStroke}
                  onChange={e => applyStrokeChange(e.target.value, true)}
                  className="input-sm font-mono flex-1"
                  placeholder="none"
                />
              </div>
              {pickerOpen.current === 'stroke' && (
                <div className="absolute top-14 left-0 z-50 p-2.5 bg-surface-800 border border-surface-700 rounded-xl shadow-xl w-[156px]">
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {PREDEFINED_COLORS.map(c => (
                      <button
                        key={c}
                        onMouseEnter={() => {
                          origStroke.current = currentStroke
                          applyStrokeChange(c)
                        }}
                        onMouseLeave={() => applyStrokeChange(origStroke.current)}
                        onClick={() => { applyStrokeChange(c, true); openPicker('none') }}
                        className={clsx(
                          'w-5 h-5 rounded-md hover:scale-125 transition-transform border border-surface-600/50 hover:ring-2 hover:ring-white/50',
                          c === 'transparent' && 'bg-gradient-to-br from-gray-300 to-white'
                        )}
                        style={{ backgroundColor: c !== 'transparent' ? c : undefined }}
                        title={c}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-surface-700">
                    <label className="text-[9px] text-surface-500 uppercase tracking-wider flex-shrink-0">Custom</label>
                    <input
                      type="color"
                      defaultValue={currentStroke && currentStroke !== 'transparent' ? currentStroke : '#334155'}
                      onInput={e => applyStrokeChange((e.target as HTMLInputElement).value)}
                      onChange={e => { applyStrokeChange(e.target.value, true); openPicker('none') }}
                      className="w-full h-6 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="label">Width</label>
              <input
                type="number"
                value={(isMockupGroup ? obj.getObjects()[1]?.strokeWidth : obj.strokeWidth) as number ?? 0}
                onChange={e => {
                  if (isMockupGroup) {
                    obj.getObjects()[1]?.set({ strokeWidth: parseInt(e.target.value) || 0 })
                    fabricCanvas?.renderAll()
                  } else {
                    update({ strokeWidth: parseInt(e.target.value) || 0 })
                  }
                  setIsDirty(true)
                }}
                className="input-sm"
              />
            </div>
          </div>
          {type === 'rect' && (
            <div>
              <label className="label">Corner Radius</label>
              <input
                type="number"
                value={obj.rx ?? 0}
                onChange={e => updateCornerRadius(parseInt(e.target.value) || 0)}
                className="input-sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Image Corner Radius */}
      {type === 'image' && (
        <div className="panel-section space-y-2">
          <p className="panel-section-title">Image Styling</p>
          <div>
            <label className="label">Corner Radius</label>
            <input
              type="number"
              value={obj._customRx ?? 0}
              onChange={e => updateCornerRadius(parseInt(e.target.value) || 0)}
              className="input-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}
