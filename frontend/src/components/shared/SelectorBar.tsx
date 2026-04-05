import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { RawDataset } from '../../lib/api'

interface Props {
  dataset: RawDataset
  overrides: Record<string, string>
  onChange: (overrides: Record<string, string>) => void
}

interface DimState {
  members: string[]
  loading: boolean
}

export default function SelectorBar({ dataset, overrides, onChange }: Props) {
  const axis2 = dataset.axes[2]
  if (!axis2 || axis2.tuples.length === 0) return null

  const dims = axis2.hierarchies
  const defaults = axis2.tuples[0].members

  return (
    <div className="flex flex-wrap items-center gap-4 px-8 py-3 bg-gray-50 border-b border-gray-200">
      {dims.map((dim, i) => (
        <SelectorDropdown
          key={dim}
          dimension={dim}
          defaultMember={defaults[i]}
          selected={overrides[dim] ?? defaults[i]}
          onSelect={(val) => onChange({ ...overrides, [dim]: val })}
        />
      ))}
    </div>
  )
}

function SelectorDropdown({
  dimension,
  defaultMember,
  selected,
  onSelect,
}: {
  dimension: string
  defaultMember: string
  selected: string
  onSelect: (val: string) => void
}) {
  const [dimState, setDimState] = useState<DimState>({ members: [defaultMember], loading: false })

  useEffect(() => {
    setDimState({ members: [defaultMember], loading: true })
    api.getMembers(dimension)
      .then((d) => setDimState({ members: d.members, loading: false }))
      .catch(() => setDimState({ members: [defaultMember], loading: false }))
  }, [dimension])

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 whitespace-nowrap">{dimension}</label>
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
    </div>
  )
}
