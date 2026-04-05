import { useState, useEffect } from 'react'
import { Lock } from 'lucide-react'
import { api, RawDataset } from '../../lib/api'
import { Selector } from '../../types/report'

interface Props {
  dataset: RawDataset
  selectors: Selector[]       // from definition — controls locked state + labels
  overrides: Record<string, string>
  onChange: (overrides: Record<string, string>) => void
  viewerMode?: boolean        // if true, hide locked dims entirely
}

interface DimState {
  members: string[]
  loading: boolean
}

export default function SelectorBar({ dataset, selectors, overrides, onChange, viewerMode = false }: Props) {
  const axis2 = dataset.axes[2]
  if (!axis2 || axis2.tuples.length === 0) return null

  const dims = axis2.hierarchies
  const defaults = axis2.tuples[0].members

  // Build a lookup for selector config
  const selMap = new Map(selectors.map((s) => [s.dimension, s]))

  const visibleDims = dims.filter((dim) => {
    if (!viewerMode) return true          // builder: show all
    const sel = selMap.get(dim)
    return sel ? !sel.locked : false      // viewer: only unlocked
  })

  if (visibleDims.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-4 px-8 py-3 bg-gray-50 border-b border-gray-200">
      {dims.map((dim, i) => {
        const sel = selMap.get(dim)
        const locked = sel?.locked ?? true
        const label = sel?.label ?? dim

        if (viewerMode && locked) return null

        return (
          <SelectorDropdown
            key={dim}
            dimension={dim}
            label={label}
            defaultMember={defaults[i]}
            selected={overrides[dim] ?? defaults[i]}
            locked={locked && !viewerMode}  // show lock icon in builder only
            onSelect={(val) => onChange({ ...overrides, [dim]: val })}
          />
        )
      })}
    </div>
  )
}

function SelectorDropdown({
  dimension,
  label,
  defaultMember,
  selected,
  locked,
  onSelect,
}: {
  dimension: string
  label: string
  defaultMember: string
  selected: string
  locked: boolean
  onSelect: (val: string) => void
}) {
  const [dimState, setDimState] = useState<DimState>({ members: [defaultMember], loading: false })

  useEffect(() => {
    if (locked) return  // don't fetch members for locked dims in viewer
    setDimState((s) => ({ ...s, loading: true }))
    api.getMembers(dimension)
      .then((d) => setDimState({ members: d.members, loading: false }))
      .catch(() => setDimState({ members: [defaultMember], loading: false }))
  }, [dimension, locked])

  return (
    <div className="flex items-center gap-1.5">
      {locked && <Lock className="h-3 w-3 text-gray-400 shrink-0" />}
      <label className="text-xs text-gray-500 whitespace-nowrap">{label}</label>
      {locked ? (
        <span className="text-xs text-gray-600 font-medium">{selected}</span>
      ) : (
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          disabled={dimState.loading}
          className="bg-white border border-gray-300 rounded px-2 py-1 text-xs text-gray-800
                     focus:outline-none focus:border-blue-400 disabled:opacity-50 min-w-32"
        >
          {dimState.members.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      )}
    </div>
  )
}
