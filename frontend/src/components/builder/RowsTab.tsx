import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { Row, RowType, FontSize, RowHeight } from '../../types/report'
import ColourPicker, { BACKGROUND_PALETTE, TEXT_PALETTE } from '../shared/ColourPicker'

const ROW_TYPES: { value: RowType; label: string }[] = [
  { value: 'data',     label: 'Data'     },
  { value: 'header',   label: 'Header'   },
  { value: 'subtotal', label: 'Subtotal' },
  { value: 'total',    label: 'Total'    },
  { value: 'spacer',   label: 'Spacer'   },
]

export default function RowsTab() {
  const { dataset, definition, addRow, updateRow, removeRow, setRows } = useReportStore()
  const { rows } = definition

  const usedMembers = new Set(rows.map((r) => r.member))
  const availableMembers = (dataset?.axes[1]?.tuples ?? [])
    .map((t) => t.members.join(' / '))
    .filter((m) => !usedMembers.has(m))

  const handleAdd = (member: string) => {
    const row: Row = {
      id: crypto.randomUUID(),
      member,
      label: member,
      type: 'data',
      bold: false,
      italic: false,
      underline: false,
      fontSize: 'md',
      rowHeight: 'normal',
      indent: 0,
      signFlip: false,
      borderAbove: 'none',
      borderBelow: 'none',
    }
    addRow(row)
  }

  const moveRow = (index: number, dir: -1 | 1) => {
    const next = [...rows]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setRows(next)
  }

  if (!dataset) {
    return <p className="text-xs text-gray-600 text-center mt-8">Select a cube and view first</p>
  }

  return (
    <div className="space-y-4">
      {availableMembers.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Available members</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableMembers.map((m) => (
              <button key={m} onClick={() => handleAdd(m)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs
                           text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors">
                <Plus className="h-3 w-3 shrink-0 text-blue-500" />
                <span className="truncate">{m}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {availableMembers.length > 0 && rows.length > 0 && <div className="border-t border-gray-800" />}

      {rows.length === 0 ? (
        <p className="text-xs text-gray-600 text-center mt-4">Add members above to build your report rows</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Report rows</p>
          {rows.map((row, i) => (
            <RowCard
              key={row.id}
              row={row}
              onUpdate={(patch) => updateRow(row.id, patch)}
              onRemove={() => removeRow(row.id)}
              onMoveUp={() => moveRow(i, -1)}
              onMoveDown={() => moveRow(i, 1)}
              isFirst={i === 0}
              isLast={i === rows.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface RowCardProps {
  row: Row
  onUpdate: (patch: Partial<Row>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}

function RowCard({ row, onUpdate, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: RowCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-800 rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 pt-2.5 pb-1">
        <button onClick={() => setExpanded(v => !v)} className="text-gray-600 hover:text-gray-300">
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <span className="text-xs text-gray-500 truncate flex-1">{row.member}</span>
        <button onClick={onMoveUp} disabled={isFirst} className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={isLast} className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={onRemove} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Always-visible: label + type */}
      <div className="px-2.5 pb-2.5 space-y-2">
        <input
          type="text"
          value={row.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Display label"
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs
                     text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />

        <div className="flex gap-2">
          <select value={row.type} onChange={(e) => onUpdate({ type: e.target.value as RowType })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
            {ROW_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={row.indent} onChange={(e) => onUpdate({ indent: Number(e.target.value) as Row['indent'] })}
            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
            <option value={0}>L0</option>
            <option value={1}>L1</option>
            <option value={2}>L2</option>
            <option value={3}>L3</option>
          </select>
        </div>

        {/* Quick toggles */}
        <div className="flex flex-wrap gap-1.5">
          <Toggle label="Bold"      value={row.bold}      onChange={(v) => onUpdate({ bold: v })} />
          <Toggle label="Italic"    value={row.italic ?? false}    onChange={(v) => onUpdate({ italic: v })} />
          <Toggle label="Underline" value={row.underline ?? false} onChange={(v) => onUpdate({ underline: v })} />
          <Toggle label="Sign flip" value={row.signFlip}  onChange={(v) => onUpdate({ signFlip: v })} />
        </div>

        {/* Expanded section */}
        {expanded && (
          <div className="space-y-3 pt-1 border-t border-gray-700">

            {/* Font size + Row height */}
            <div className="flex gap-2">
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Font size</p>
                <div className="flex gap-1">
                  {(['sm','md','lg'] as FontSize[]).map((s) => (
                    <button key={s} onClick={() => onUpdate({ fontSize: s })}
                      className={`flex-1 py-1 text-xs rounded transition-colors
                        ${(row.fontSize ?? 'md') === s ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 mb-1">Row height</p>
                <div className="flex gap-1">
                  {(['compact','normal','tall'] as RowHeight[]).map((h) => (
                    <button key={h} onClick={() => onUpdate({ rowHeight: h })}
                      className={`flex-1 py-1 text-xs rounded transition-colors capitalize
                        ${(row.rowHeight ?? 'normal') === h ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
                      {h[0].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Borders */}
            <div className="flex gap-2">
              {(['borderAbove','borderBelow'] as const).map((key) => (
                <div key={key} className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">{key === 'borderAbove' ? 'Border above' : 'Border below'}</p>
                  <select value={row[key]} onChange={(e) => onUpdate({ [key]: e.target.value as Row['borderAbove'] })}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-500">
                    <option value="none">None</option>
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Colours */}
            <ColourPicker
              label="Row background"
              value={row.rowBackground}
              palette={BACKGROUND_PALETTE}
              onChange={(v) => onUpdate({ rowBackground: v })}
            />
            <ColourPicker
              label="Label colour"
              value={row.labelColor}
              palette={TEXT_PALETTE}
              onChange={(v) => onUpdate({ labelColor: v })}
            />
            <ColourPicker
              label="Number colour"
              value={row.numberColor}
              palette={TEXT_PALETTE}
              onChange={(v) => onUpdate({ numberColor: v })}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`text-xs px-2 py-0.5 rounded transition-colors
        ${value ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
      {label}
    </button>
  )
}
