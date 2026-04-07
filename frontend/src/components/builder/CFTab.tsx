import { useState } from 'react'
import { Plus, Trash2, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { CFRule, CFOperator, CFScope, Column, Row } from '../../types/report'
import ColourPicker, { BACKGROUND_PALETTE, TEXT_PALETTE } from '../shared/ColourPicker'

const OPERATORS: { value: CFOperator; label: string }[] = [
  { value: '>',       label: '>'       },
  { value: '>=',      label: '>='      },
  { value: '<',       label: '<'       },
  { value: '<=',      label: '<='      },
  { value: '=',       label: '='       },
  { value: '!=',      label: '≠'       },
  { value: 'between', label: 'between' },
]

const SCOPES: { value: CFScope; label: string }[] = [
  { value: 'report', label: 'Entire report' },
  { value: 'column', label: 'Column'        },
  { value: 'row',    label: 'Row'           },
]

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`text-xs px-2 py-0.5 rounded transition-colors
        ${value ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'}`}>
      {label}
    </button>
  )
}

function ValueInputs({ operator, valueA, valueB, onChangeA, onChangeB }: {
  operator: CFOperator
  valueA: number
  valueB: number
  onChangeA: (v: number) => void
  onChangeB: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={valueA}
        onChange={(e) => onChangeA(parseFloat(e.target.value) || 0)}
        className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                   focus:outline-none focus:border-blue-500 tabular-nums"
      />
      {operator === 'between' && (
        <>
          <span className="text-xs text-gray-500">and</span>
          <input
            type="number"
            value={valueB}
            onChange={(e) => onChangeB(parseFloat(e.target.value) || 0)}
            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                       focus:outline-none focus:border-blue-500 tabular-nums"
          />
        </>
      )}
    </div>
  )
}

// ─── Scope picker (shared between card and form) ──────────────────────────────

function ScopePicker({ scope, scopeTarget, columns, rows, onChangeScope, onChangeTarget }: {
  scope: CFScope
  scopeTarget: string
  columns: Column[]
  rows: Row[]
  onChangeScope: (s: CFScope) => void
  onChangeTarget: (t: string) => void
}) {
  return (
    <div className="flex gap-2">
      <select value={scope} onChange={(e) => onChangeScope(e.target.value as CFScope)}
        className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                   focus:outline-none focus:border-blue-500">
        {SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      {scope === 'column' && (
        <select value={scopeTarget} onChange={(e) => onChangeTarget(e.target.value)}
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                     focus:outline-none focus:border-blue-500">
          <option value="">Pick column…</option>
          {columns.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
      {scope === 'row' && (
        <select value={scopeTarget} onChange={(e) => onChangeTarget(e.target.value)}
          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                     focus:outline-none focus:border-blue-500">
          <option value="">Pick row…</option>
          {rows.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      )}
    </div>
  )
}

// ─── Rule card (collapsible) ──────────────────────────────────────────────────

function RuleCard({ rule, columns, rows, isFirst, isLast, onUpdate, onRemove, onMoveUp, onMoveDown }: {
  rule: CFRule
  columns: Column[]
  rows: Row[]
  isFirst: boolean
  isLast: boolean
  onUpdate: (patch: Partial<CFRule>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  const scopeLabel = rule.scope === 'column'
    ? columns.find((c) => c.id === rule.scopeTarget)?.label ?? 'Column'
    : rule.scope === 'row'
    ? rows.find((r) => r.id === rule.scopeTarget)?.label ?? 'Row'
    : 'Report'

  const summary = `${scopeLabel} · value ${rule.operator} ${rule.valueA}${rule.operator === 'between' ? ` and ${rule.valueB ?? 0}` : ''}`

  return (
    <div className="bg-gray-800 rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1 px-2.5 pt-2.5 pb-1">
        <button onClick={() => setExpanded(v => !v)} className="text-gray-600 hover:text-gray-300">
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-300 truncate font-medium">{rule.name || 'Untitled rule'}</p>
          {!expanded && <p className="text-xs text-gray-600 truncate">{summary}</p>}
        </div>
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

      {/* Expanded body */}
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-2.5">
          {/* Name */}
          <input
            value={rule.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="Rule name…"
            className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                       placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          {/* Scope */}
          <ScopePicker
            scope={rule.scope}
            scopeTarget={rule.scopeTarget ?? ''}
            columns={columns}
            rows={rows}
            onChangeScope={(s) => onUpdate({ scope: s, scopeTarget: undefined })}
            onChangeTarget={(t) => onUpdate({ scopeTarget: t })}
          />

          {/* Operator + values */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-500">When value</span>
            <select value={rule.operator} onChange={(e) => onUpdate({ operator: e.target.value as CFOperator })}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                         focus:outline-none focus:border-blue-500">
              {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ValueInputs
              operator={rule.operator}
              valueA={rule.valueA}
              valueB={rule.valueB ?? 0}
              onChangeA={(v) => onUpdate({ valueA: v })}
              onChangeB={(v) => onUpdate({ valueB: v })}
            />
          </div>

          {/* Styles */}
          <ColourPicker label="Text colour" value={rule.color}       palette={TEXT_PALETTE}       onChange={(v) => onUpdate({ color: v })} />
          <ColourPicker label="Background"  value={rule.background}  palette={BACKGROUND_PALETTE} onChange={(v) => onUpdate({ background: v })} />
          <div className="flex gap-2">
            <Toggle label="Bold"   value={rule.bold   ?? false} onChange={(v) => onUpdate({ bold: v })} />
            <Toggle label="Italic" value={rule.italic ?? false} onChange={(v) => onUpdate({ italic: v })} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── New rule form ────────────────────────────────────────────────────────────

function RuleForm({ columns, rows, onAdd, onCancel }: {
  columns: Column[]
  rows: Row[]
  onAdd: (rule: CFRule) => void
  onCancel: () => void
}) {
  const [name, setName]               = useState('')
  const [scope, setScope]             = useState<CFScope>('report')
  const [scopeTarget, setScopeTarget] = useState('')
  const [operator, setOperator]       = useState<CFOperator>('<')
  const [valueA, setValueA]           = useState(0)
  const [valueB, setValueB]           = useState(0)
  const [color, setColor]             = useState<string | undefined>(undefined)
  const [background, setBackground]   = useState<string | undefined>(undefined)
  const [bold, setBold]               = useState(false)
  const [italic, setItalic]           = useState(false)

  const valid = !!name && (scope === 'report' || !!scopeTarget)

  const handleAdd = () => {
    onAdd({
      id: crypto.randomUUID(),
      name,
      scope,
      scopeTarget: scope !== 'report' ? scopeTarget : undefined,
      operator,
      valueA,
      valueB: operator === 'between' ? valueB : undefined,
      color,
      background,
      bold: bold || undefined,
      italic: italic || undefined,
    })
  }

  return (
    <div className="bg-gray-800 border border-blue-900 rounded-md p-3 space-y-2.5">
      <p className="text-xs font-medium text-gray-300">New rule</p>

      {/* Name */}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name…"
        className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                   placeholder-gray-500 focus:outline-none focus:border-blue-500" />

      {/* Scope */}
      <ScopePicker
        scope={scope}
        scopeTarget={scopeTarget}
        columns={columns}
        rows={rows}
        onChangeScope={(s) => { setScope(s); setScopeTarget('') }}
        onChangeTarget={setScopeTarget}
      />

      {/* Operator + values */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-gray-500">When value</span>
        <select value={operator} onChange={(e) => setOperator(e.target.value as CFOperator)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100
                     focus:outline-none focus:border-blue-500">
          {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ValueInputs
          operator={operator} valueA={valueA} valueB={valueB}
          onChangeA={setValueA} onChangeB={setValueB}
        />
      </div>

      {/* Styles */}
      <ColourPicker label="Text colour" value={color}      palette={TEXT_PALETTE}       onChange={setColor} />
      <ColourPicker label="Background"  value={background} palette={BACKGROUND_PALETTE} onChange={setBackground} />
      <div className="flex gap-2">
        <Toggle label="Bold"   value={bold}   onChange={setBold} />
        <Toggle label="Italic" value={italic} onChange={setItalic} />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button onClick={handleAdd} disabled={!valid}
          className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-40">
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

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function CFTab() {
  const { definition, addCFRule, removeCFRule, updateCFRule, setCFRules } = useReportStore()
  const { cfRules, columns, rows } = definition
  const [adding, setAdding] = useState(false)

  const moveRule = (index: number, dir: -1 | 1) => {
    const next = [...cfRules]
    const swap = index + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[index], next[swap]] = [next[swap], next[index]]
    setCFRules(next)
  }

  if (!definition.cube) {
    return <p className="text-xs text-gray-600 text-center mt-8">Select a cube and view first</p>
  }

  return (
    <div className="space-y-3">
      {cfRules.length > 0 && (
        <p className="text-xs text-gray-600">Rules apply top-down — first match wins.</p>
      )}

      {cfRules.length === 0 && !adding && (
        <p className="text-xs text-gray-600 text-center mt-4">No rules — add one below</p>
      )}

      {cfRules.map((rule, i) => (
        <RuleCard
          key={rule.id}
          rule={rule}
          columns={columns}
          rows={rows}
          isFirst={i === 0}
          isLast={i === cfRules.length - 1}
          onUpdate={(patch) => updateCFRule(rule.id, patch)}
          onRemove={() => removeCFRule(rule.id)}
          onMoveUp={() => moveRule(i, -1)}
          onMoveDown={() => moveRule(i, 1)}
        />
      ))}

      {adding ? (
        <RuleForm
          columns={columns}
          rows={rows}
          onAdd={(rule) => { addCFRule(rule); setAdding(false) }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs
                     text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors">
          <Plus className="h-3 w-3 shrink-0 text-blue-500" />
          Add rule
        </button>
      )}
    </div>
  )
}
