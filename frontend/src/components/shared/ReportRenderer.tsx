import { ReportDefinition } from '../../types/report'
import { RawDataset } from '../../lib/api'

interface Props {
  definition: ReportDefinition
  dataset: RawDataset
}

export default function ReportRenderer({ definition, dataset }: Props) {
  const { rows, columns, numberFormat } = definition

  // Build a lookup: rowMember → cell values by colMember
  const colTuples = dataset.axes[0]?.tuples ?? []
  const rowTuples = dataset.axes[1]?.tuples ?? []

  // Map each row member name → its index in the dataset
  const rowIndexMap = new Map(rowTuples.map((t, i) => [t.members.join(' / '), i]))

  // Map each col member name → its index in the dataset
  const colIndexMap = new Map(colTuples.map((t, i) => [t.members.join(' / '), i]))

  // Determine which columns to show
  type SimpleCol = { member: string; label: string }
  const visibleCols: SimpleCol[] = columns.length > 0
    ? columns
        .filter((c) => c.show !== false && 'member' in c)
        .map((c) => ({ member: (c as { member: string }).member, label: c.label }))
    : colTuples.map((t) => ({ member: t.members.join(' / '), label: t.members.join(' / ') }))

  const getValue = (rowMember: string, colMember: string): number | null => {
    const ri = rowIndexMap.get(rowMember)
    const ci = colIndexMap.get(colMember)
    if (ri === undefined || ci === undefined) return null
    return dataset.cells[ri]?.[ci] ?? null
  }

  const formatValue = (raw: number | null, signFlip: boolean): string => {
    if (raw === null) return '—'
    const val = signFlip ? raw * -1 : raw
    if (val === 0) return '—'

    const scale = numberFormat.scale === 'thousands' ? 1000
      : numberFormat.scale === 'millions' ? 1000000
      : 1

    const scaled = val / scale
    const formatted = scaled.toLocaleString('en-US', {
      minimumFractionDigits: numberFormat.decimals,
      maximumFractionDigits: numberFormat.decimals,
    })

    if (val < 0 && numberFormat.negativeStyle === 'brackets') {
      return `(${formatted.replace('-', '')})`
    }
    return formatted
  }

  const isNegative = (raw: number | null, signFlip: boolean): boolean => {
    if (raw === null) return false
    return signFlip ? raw > 0 : raw < 0
  }

  // Determine rows to render
  const renderRows = rows.length > 0 ? rows : rowTuples.map((t) => ({
    id: t.members.join('/'),
    member: t.members.join(' / '),
    label: t.members.join(' / '),
    type: 'data' as const,
    bold: false,
    indent: 0 as const,
    signFlip: false,
    borderAbove: 'none' as const,
    borderBelow: 'none' as const,
  }))

  return (
    <div className="bg-white font-sans text-gray-900 shadow-lg rounded overflow-auto">
      {/* Report title */}
      {definition.title && (
        <div className="px-8 pt-6 pb-2">
          <h1 className="text-lg font-semibold text-gray-900">{definition.title}</h1>
          {definition.header.subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{definition.header.subtitle}</p>
          )}
        </div>
      )}

      {/* Context */}
      {dataset.context && (
        <div className="px-8 pb-3">
          <p className="text-xs text-gray-400">{dataset.context}</p>
        </div>
      )}

      {/* Table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="px-8 py-2 text-left text-xs font-semibold text-gray-500 w-48" />
            {visibleCols.map((col, i) => (
              <th key={i} className="px-4 py-2 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {renderRows.map((row) => {
            if (row.type === 'spacer') {
              return (
                <tr key={row.id} className="h-3">
                  <td colSpan={visibleCols.length + 1} />
                </tr>
              )
            }
            if (row.type === 'header') {
              return (
                <tr key={row.id} className="bg-gray-50">
                  <td
                    colSpan={visibleCols.length + 1}
                    className="px-8 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    style={{ paddingLeft: `${2 + row.indent * 1}rem` }}
                  >
                    {row.label}
                  </td>
                </tr>
              )
            }

            const borderAbove = row.borderAbove === 'single' ? 'border-t border-gray-300'
              : row.borderAbove === 'double' ? 'border-t-2 border-gray-400' : ''
            const borderBelow = row.borderBelow === 'single' ? 'border-b border-gray-300'
              : row.borderBelow === 'double' ? 'border-b-2 border-gray-400' : ''

            const isTotal = row.type === 'total' || row.type === 'subtotal'

            return (
              <tr
                key={row.id}
                className={`${borderAbove} ${borderBelow} ${isTotal ? 'bg-gray-50' : 'hover:bg-gray-50'}`}
              >
                {/* Row label */}
                <td
                  className={`px-8 py-2 text-xs whitespace-nowrap ${row.bold || isTotal ? 'font-semibold' : 'font-normal'} text-gray-800`}
                  style={{ paddingLeft: `${2 + row.indent * 1}rem` }}
                >
                  {row.label}
                </td>

                {/* Values */}
                {visibleCols.map((col, ci) => {
                  const member = col.member
                  const raw = getValue(row.member, member)
                  const neg = isNegative(raw, row.signFlip)

                  return (
                    <td
                      key={ci}
                      className={`px-4 py-2 text-right text-xs tabular-nums whitespace-nowrap
                        ${row.bold || isTotal ? 'font-semibold' : ''}
                        ${neg ? 'text-red-600' : 'text-gray-900'}`}
                    >
                      {formatValue(raw, row.signFlip)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="h-6" />
    </div>
  )
}
