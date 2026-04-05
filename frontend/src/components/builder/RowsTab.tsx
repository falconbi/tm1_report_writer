import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { Row, RowType } from '../../types/report'

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

  // Available members from TM1 view that haven't been added yet
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

      {/* Available members */}
      {availableMembers.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Available members</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableMembers.map((m) => (
              <button
                key={m}
                onClick={() => handleAdd(m)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs
                           text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
              >
                <Plus className="h-3 w-3 shrink-0 text-blue-500" />
                <span className="truncate">{m}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {availableMembers.length > 0 && rows.length > 0 && (
        <div className="border-t border-gray-800" />
      )}

      {/* Configured rows */}
      {rows.length === 0 ? (
        <p className="text-xs text-gray-600 text-center mt-4">
          Add members above to build your report rows
        </p>
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
  return (
    <div className="bg-gray-800 rounded-md p-2.5 space-y-2">
      {/* Header row: member name + move + delete */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 truncate flex-1">{row.member}</span>
        <button onClick={onMoveUp} disabled={isFirst}
          className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={isLast}
          className="p-0.5 text-gray-600 hover:text-gray-300 disabled:opacity-30">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={onRemove}
          className="p-0.5 text-gray-600 hover:text-red-400 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Label */}
      <input
        type="text"
        value={row.label}
        onChange={(e) => onUpdate({ label: e.target.value })}
        placeholder="Display label"
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs
                   text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />

      {/* Type + Indent */}
      <div className="flex gap-2">
        <select
          value={row.type}
          onChange={(e) => onUpdate({ type: e.target.value as RowType })}
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs
                     text-gray-100 focus:outline-none focus:border-blue-500"
        >
          {ROW_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select
          value={row.indent}
          onChange={(e) => onUpdate({ indent: Number(e.target.value) as Row['indent'] })}
          className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs
                     text-gray-100 focus:outline-none focus:border-blue-500"
        >
          <option value={0}>No indent</option>
          <option value={1}>Indent 1</option>
          <option value={2}>Indent 2</option>
          <option value={3}>Indent 3</option>
        </select>
      </div>

      {/* Toggles */}
      <div className="flex gap-3">
        <Toggle label="Bold" value={row.bold} onChange={(v) => onUpdate({ bold: v })} />
        <Toggle label="Sign flip" value={row.signFlip} onChange={(v) => onUpdate({ signFlip: v })} />
      </div>
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`text-xs px-2 py-0.5 rounded transition-colors
        ${value ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}
    >
      {label}
    </button>
  )
}
