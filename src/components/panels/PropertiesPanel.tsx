import { useState } from 'react'
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

export default function PropertiesPanel() {
  const { selectedObjects, fabricCanvas } = useEditorStore()
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showStrokePicker, setShowStrokePicker] = useState(false)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const [showWeightPicker, setShowWeightPicker] = useState(false)

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

  const update = (props: Record<string, unknown>) => {
    obj.set(props)
    obj.setCoords?.()
    fabricCanvas?.renderAll()
  }

  const previewProperty = (key: string, value: any) => {
    obj.set(key, value)
    fabricCanvas?.renderAll()
  }

  const revertProperty = (key: string, originalValue: any) => {
    obj.set(key, originalValue)
    fabricCanvas?.renderAll()
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
    }
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
            { label: 'W', key: 'width', value: Math.round(obj.width ?? 0) },
            { label: 'H', key: 'height', value: Math.round(obj.height ?? 0) },
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
              onClick={() => { setShowColorPicker(!showColorPicker); setShowStrokePicker(false) }}
            />
            {showColorPicker && (
              <div className="absolute top-10 left-0 z-50 p-2.5 bg-surface-800 border border-surface-700 rounded-xl shadow-xl w-[156px]">
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c}
                      onMouseEnter={() => previewProperty('fill', c)}
                      onMouseLeave={() => revertProperty('fill', obj.fill ?? '#6171f6')}
                      onClick={() => { update({ fill: c }); setShowColorPicker(false) }}
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
                    onInput={e => previewProperty('fill', (e.target as HTMLInputElement).value)}
                    onChange={e => { update({ fill: e.target.value }); setShowColorPicker(false) }}
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
              onClick={() => { setShowFontPicker(!showFontPicker); setShowWeightPicker(false) }}
            >
              <span style={{ fontFamily: obj.fontFamily ?? 'Inter' }}>{obj.fontFamily ?? 'Inter'}</span>
            </button>
            {showFontPicker && (
              <div className="absolute top-14 left-0 w-full z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-xl max-h-60 overflow-y-auto no-scrollbar py-1">
                {FONTS.map(f => (
                  <button
                    key={f}
                    onMouseEnter={() => previewProperty('fontFamily', f)}
                    onMouseLeave={() => revertProperty('fontFamily', obj.fontFamily ?? 'Inter')}
                    onClick={() => { update({ fontFamily: f }); setShowFontPicker(false) }}
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
                onClick={() => { setShowWeightPicker(!showWeightPicker); setShowFontPicker(false) }}
              >
                {WEIGHTS.find(w => w.value === (obj.fontWeight ?? 'normal'))?.label ?? 'Regular'}
              </button>
              {showWeightPicker && (
                <div className="absolute top-14 left-0 w-full z-50 bg-surface-800 border border-surface-700 rounded-xl shadow-xl py-1">
                  {WEIGHTS.map(w => (
                    <button
                      key={w.value}
                      onMouseEnter={() => previewProperty('fontWeight', w.value)}
                      onMouseLeave={() => revertProperty('fontWeight', obj.fontWeight ?? 'normal')}
                      onClick={() => { update({ fontWeight: w.value }); setShowWeightPicker(false) }}
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
                  style={{ backgroundColor: (isMockupGroup ? obj.getObjects()[1].stroke : obj.stroke) as string ?? 'transparent' }}
                  onClick={() => { setShowStrokePicker(!showStrokePicker); setShowColorPicker(false) }}
                />
                <input
                  type="text"
                  value={(isMockupGroup ? obj.getObjects()[1].stroke : obj.stroke) as string ?? ''}
                  onChange={e => {
                    if (isMockupGroup) {
                      obj.getObjects()[1].set({ stroke: e.target.value })
                      fabricCanvas?.renderAll()
                    } else {
                      update({ stroke: e.target.value })
                    }
                  }}
                  className="input-sm font-mono flex-1"
                  placeholder="none"
                />
              </div>
              {showStrokePicker && (
                <div className="absolute top-14 left-0 z-50 p-2.5 bg-surface-800 border border-surface-700 rounded-xl shadow-xl w-[156px]">
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {PREDEFINED_COLORS.map(c => {
                      const currentStroke = isMockupGroup ? obj.getObjects()[1].stroke : obj.stroke
                      const applyStroke = (val: string) => {
                        if (isMockupGroup) { obj.getObjects()[1].set({ stroke: val }); fabricCanvas?.renderAll() }
                        else update({ stroke: val })
                      }
                      return (
                        <button
                          key={c}
                          onMouseEnter={() => applyStroke(c)}
                          onMouseLeave={() => applyStroke(currentStroke ?? 'transparent')}
                          onClick={() => { applyStroke(c); setShowStrokePicker(false) }}
                          className={clsx(
                            'w-5 h-5 rounded-md hover:scale-125 transition-transform border border-surface-600/50 hover:ring-2 hover:ring-white/50',
                            c === 'transparent' && 'bg-gradient-to-br from-gray-300 to-white'
                          )}
                          style={{ backgroundColor: c !== 'transparent' ? c : undefined }}
                          title={c}
                        />
                      )
                    })}
                  </div>
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-surface-700">
                    <label className="text-[9px] text-surface-500 uppercase tracking-wider flex-shrink-0">Custom</label>
                    <input
                      type="color"
                      defaultValue={(() => {
                        const s = isMockupGroup ? obj.getObjects()[1].stroke : obj.stroke
                        return s && s !== 'transparent' ? s : '#334155'
                      })()}
                      onInput={e => {
                        const val = (e.target as HTMLInputElement).value
                        if (isMockupGroup) { obj.getObjects()[1].set({ stroke: val }); fabricCanvas?.renderAll() }
                        else update({ stroke: val })
                      }}
                      onChange={e => { setShowStrokePicker(false) }}
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
                value={(isMockupGroup ? obj.getObjects()[1].strokeWidth : obj.strokeWidth) as number ?? 0}
                onChange={e => {
                  if (isMockupGroup) {
                    obj.getObjects()[1].set({ strokeWidth: parseInt(e.target.value) || 0 })
                    fabricCanvas?.renderAll()
                  } else {
                    update({ strokeWidth: parseInt(e.target.value) || 0 })
                  }
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

      {/* Image Corner Radius (Custom via clipPath) */}
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
