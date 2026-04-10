import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Calculator } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { DataColumn, CalcColumn, CalcType, FavorableDirection, ColWidth } from '../../types/report'
import ColourPicker, { BACKGROUND_PALETTE, TEXT_PALETTE } from '../shared/ColourPicker'

const CALC_TYPES: { value: CalcType; label: string }[] = [
  { value: 'variance',    label: 'Variance (A − B)' },
  { value: 'pctVariance', label: 'Variance %'        },
  { value: 'pctOfBase',   label: '% of Base'         },
]

const WIDTHS: { value: ColWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide',   label: 'Wide'   },
]

export default function ColumnsTab() {
  const { dataset, definition, addColumn, updateColumn, removeColumn, setColumns } = useReportStore()
  const { columns } = definition
  const [showCalcForm, setShowCalcForm] = useState(false)

  const usedMembers = new Set(
    columns.filter((c) => 'member' in c).map((c) => (c as DataColumn).member)
  )

  const availableMembers = (dataset?.axes[0]?.tuples ?? [])
    .map((t) => t.members.join(' / '))
    .filter((m) => !usedMembers.has(m))

  const dataColumns = columns.filter((c) => 'member' in c) as DataColumn[]

  const handleAddData = (member: string) => {
    addColumn({
      id: crypto.randomUUID(),
      member,
      label: member,
      show: true,
      highlight: false,
      width: 'normal',
    } as DataColumn)
  }

  const moveCol = (index: number, dir: -1 | 1) => {
    const next = [...columns]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setColumns(next)
  }

  const handleAddAll = () => {
    const newCols: DataColumn[] = availableMembers.map((m) => ({
      id: crypto.randomUUID(),
      member: m,
      label: m,
      show: true,
      highlight: false,
      width: 'normal',
    }))
    setColumns([...columns, ...newCols])
  }

  if (!dataset) {
    return <p className="text-xs text-gray-600 text-center mt-8">Select a cube and view first</p>
  }

  return (
    <div className="space-y-4">

      {/* Available members */}
      {availableMembers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">Available members</p>
            <button onClick={handleAddAll}
              className="text-xs text-blue-400 hover:text-blue-400 transition-colors">
              Add all
            </button>
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {availableMembers.map((m) => (
              <button key={m} onClick={() => handleAddData(m)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs
                           text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors">
                <Plus className="h-3 w-3 shrink-0 text-blue-400" />
                <span className="truncate">{m}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add calculated column */}
      <div>
        {!showCalcForm ? (
          <button onClick={() => setShowCalcForm(true)} disabled={dataColumns.length < 2}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs
                       text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed">
            <Calculator className="h-3 w-3 shrink-0 text-emerald-500" />
            Add calculated column
          </button>
        ) : (
          <CalcColumnForm
            dataColumns={dataColumns}
            onAdd={(col) => { addColumn(col); setShowCalcForm(false) }}
            onCancel={() => setShowCalcForm(false)}
          />
        )}
      </div>

      {columns.length > 0 && <div className="border-t border-gray-800" />}

      {/* Configured columns */}
      {columns.length === 0 ? (
        <p className="text-xs text-gray-600 text-center mt-4">Add members above to build your report columns</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Report columns</p>
          {columns.map((col, i) => (
            'member' in col ? (
              <DataColCard
                key={col.id}
                col={col as DataColumn}
                onUpdate={(patch) => updateColumn(col.id, patch)}
                onRemove={() => removeColumn(col.id)}
                onMoveUp={() => moveCol(i, -1)}
                onMoveDown={() => moveCol(i, 1)}
                isFirst={i === 0}
                isLast={i === columns.length - 1}
              />
            ) : (
              <CalcColCard
                key={col.id}
                col={col as CalcColumn}
                onUpdate={(patch) => updateColumn(col.id, patch)}
                onRemove={() => removeColumn(col.id)}
                onMoveUp={() => moveCol(i, -1)}
                onMoveDown={() => moveCol(i, 1)}
                isFirst={i === 0}
                isLast={i === columns.length - 1}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Calc column form ─────────────────────────────────────────────────────────

function CalcColumnForm({ dataColumns, onAdd, onCancel }: {
  dataColumns: DataColumn[]
  onAdd: (col: CalcColumn) => void
  onCancel: () => void
}) {
  const [calcType, setCalcType] = useState<CalcType>('variance')
  const [colA, setColA] = useState(dataColumns[0]?.member ?? '')
  const [colB, setColB] = useState(dataColumns[1]?.member ?? '')
  const [label, setLabel] = useState('Variance')
  const [favorable, setFavorable] = useState<FavorableDirection>('positive')

  return (
    <div className="bg-gray-800 rounded-md p-3 space-y-2.5">
      <p className="text-xs font-medium text-gray-300">Calculated column</p>
      <select value={calcType} onChange={(e) => setCalcType(e.target.value as CalcType)}
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
        {CALC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        {(['colA', 'colB'] as const).map((key, idx) => (
          <div key={key}>
            <p className="text-xs text-gray-500 mb-1">Column {idx === 0 ? 'A' : 'B'}</p>
            <select value={key === 'colA' ? colA : colB}
              onChange={(e) => key === 'colA' ? setColA(e.target.value) : setColB(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
              {dataColumns.map((c) => <option key={c.member} value={c.member}>{c.label}</option>)}
            </select>
          </div>
        ))}
      </div>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label"
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-blue-400" />
      {(calcType === 'variance' || calcType === 'pctVariance') && (
        <div className="flex gap-2">
          {(['positive', 'negative'] as FavorableDirection[]).map((d) => (
            <button key={d} onClick={() => setFavorable(d)}
              className={`flex-1 py-1 text-xs rounded transition-colors
                ${favorable === d ? 'bg-blue-400 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
              {d === 'positive' ? 'Higher = good' : 'Lower = good'}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button onClick={() => onAdd({ id: crypto.randomUUID(), calcType, colA, colB, label, favorable, show: true, highlight: false, width: 'narrow' })}
          disabled={!colA || !colB || colA === colB}
          className="flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-40">
          Add
        </button>
        <button onClick={onCancel}
          className="flex-1 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Card base ────────────────────────────────────────────────────────────────

interface CardBaseProps {
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
}

function CardHeader({ label, onRemove, onMoveUp, onMoveDown, isFirst, isLast, expanded, onToggle }: CardBaseProps & {
  label: string; expanded: boolean; onToggle: () => void
}) {
  return (
    <div className="flex items-center gap-1 px-2.5 pt-2.5 pb-1">
      <button onClick={onToggle} className="text-gray-600 hover:text-gray-300">
        <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      <span className="text-xs text-gray-500 truncate flex-1">{label}</span>
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
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`text-xs px-2 py-0.5 rounded transition-colors
        ${value ? 'bg-blue-400 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
      {label}
    </button>
  )
}

// ─── Data column card ─────────────────────────────────────────────────────────

function DataColCard({ col, onUpdate, ...base }: CardBaseProps & {
  col: DataColumn; onUpdate: (p: Partial<DataColumn>) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-gray-800 rounded-md overflow-hidden">
      <CardHeader label={col.member} expanded={expanded} onToggle={() => setExpanded(v => !v)} {...base} />

      <div className="px-2.5 pb-2.5 space-y-2">
        <input value={col.label} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="Display label"
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-400" />

        <div className="flex gap-2">
          <select value={col.width} onChange={(e) => onUpdate({ width: e.target.value as ColWidth })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
            {WIDTHS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <Toggle label="Show"      value={col.show}      onChange={(v) => onUpdate({ show: v })} />
          <Toggle label="Highlight" value={col.highlight} onChange={(v) => onUpdate({ highlight: v })} />
        </div>

        {expanded && (
          <div className="space-y-3 pt-1 border-t border-gray-700">
            <ColourPicker label="Header background" value={col.headerBackground}
              palette={BACKGROUND_PALETTE} onChange={(v) => onUpdate({ headerBackground: v })} />
            <ColourPicker label="Header text" value={col.headerColor}
              palette={TEXT_PALETTE} onChange={(v) => onUpdate({ headerColor: v })} />
            <ColourPicker label="Column shading" value={col.columnBackground}
              palette={BACKGROUND_PALETTE} onChange={(v) => onUpdate({ columnBackground: v })} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Calc column card ─────────────────────────────────────────────────────────

function CalcColCard({ col, onUpdate, ...base }: CardBaseProps & {
  col: CalcColumn; onUpdate: (p: Partial<CalcColumn>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const typeLabel = CALC_TYPES.find((t) => t.value === col.calcType)?.label ?? col.calcType

  return (
    <div className="bg-gray-800 border border-emerald-900 rounded-md overflow-hidden">
      <CardHeader label={typeLabel} expanded={expanded} onToggle={() => setExpanded(v => !v)} {...base} />

      <div className="px-2.5 pb-2.5 space-y-2">
        <p className="text-xs text-gray-500">{col.colA} − {col.colB}</p>
        <input value={col.label} onChange={(e) => onUpdate({ label: e.target.value })} placeholder="Display label"
          className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-400" />

        <div className="flex gap-2">
          <select value={col.width} onChange={(e) => onUpdate({ width: e.target.value as ColWidth })}
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-blue-400">
            {WIDTHS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <Toggle label="Show"      value={col.show}      onChange={(v) => onUpdate({ show: v })} />
          <Toggle label="Highlight" value={col.highlight} onChange={(v) => onUpdate({ highlight: v })} />
        </div>

        {expanded && (
          <div className="space-y-3 pt-1 border-t border-gray-700">
            <ColourPicker label="Header background" value={col.headerBackground}
              palette={BACKGROUND_PALETTE} onChange={(v) => onUpdate({ headerBackground: v })} />
            <ColourPicker label="Header text" value={col.headerColor}
              palette={TEXT_PALETTE} onChange={(v) => onUpdate({ headerColor: v })} />
            <ColourPicker label="Column shading" value={col.columnBackground}
              palette={BACKGROUND_PALETTE} onChange={(v) => onUpdate({ columnBackground: v })} />
          </div>
        )}
      </div>
    </div>
  )
}
