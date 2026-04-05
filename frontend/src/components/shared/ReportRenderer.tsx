import { ReportDefinition, DataColumn, CalcColumn, isCalcColumn } from '../../types/report'
import { RawDataset } from '../../lib/api'

interface Props {
  definition: ReportDefinition
  dataset: RawDataset
}

export default function ReportRenderer({ definition, dataset }: Props) {
  const { rows, columns, numberFormat } = definition

  const colTuples = dataset.axes[0]?.tuples ?? []
  const rowTuples = dataset.axes[1]?.tuples ?? []

  const rowIndexMap = new Map(rowTuples.map((t, i) => [t.members.join(' / '), i]))
  const colIndexMap = new Map(colTuples.map((t, i) => [t.members.join(' / '), i]))

  const getRawValue = (rowMember: string, colMember: string): number | null => {
    const ri = rowIndexMap.get(rowMember)
    const ci = colIndexMap.get(colMember)
    if (ri === undefined || ci === undefined) return null
    return dataset.cells[ri]?.[ci] ?? null
  }

  const getCalcValue = (rowMember: string, col: CalcColumn): number | null => {
    const a = getRawValue(rowMember, col.colA)
    const b = getRawValue(rowMember, col.colB)
    if (a === null || b === null) return null
    if (col.calcType === 'variance') return a - b
    if (col.calcType === 'pctVariance') return b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null
    if (col.calcType === 'pctOfBase') return b !== 0 ? (a / b) * 100 : null
    return null
  }

  const isPct = (col: CalcColumn) => col.calcType === 'pctVariance' || col.calcType === 'pctOfBase'

  const formatValue = (raw: number | null, signFlip: boolean, pct = false): string => {
    if (raw === null) return '—'
    const val = signFlip ? raw * -1 : raw
    if (val === 0) return '—'

    if (pct) {
      const formatted = Math.abs(val).toFixed(1)
      return val < 0 ? `(${formatted}%)` : `${formatted}%`
    }

    const scale = numberFormat.scale === 'thousands' ? 1000
      : numberFormat.scale === 'millions' ? 1000000 : 1
    const scaled = val / scale
    const formatted = Math.abs(scaled).toLocaleString('en-US', {
      minimumFractionDigits: numberFormat.decimals,
      maximumFractionDigits: numberFormat.decimals,
    })
    if (val < 0 && numberFormat.negativeStyle === 'brackets') return `(${formatted})`
    if (val < 0) return `-${formatted}`
    return formatted
  }

  const isUnfavorable = (raw: number | null, col: DataColumn | CalcColumn): boolean => {
    if (raw === null) return false
    if (!isCalcColumn(col)) return raw < 0
    const favorable = col.favorable ?? 'positive'
    return favorable === 'positive' ? raw < 0 : raw > 0
  }

  // Visible columns — fall back to all TM1 columns if none configured
  const visibleCols: (DataColumn | CalcColumn)[] = columns.length > 0
    ? columns.filter((c) => c.show !== false)
    : colTuples.map((t) => ({
        id: t.members.join('/'),
        member: t.members.join(' / '),
        label: t.members.join(' / '),
        show: true,
        highlight: false,
        width: 'normal' as const,
      }))

  // Rows — fall back to all TM1 rows if none configured
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
      {definition.title && (
        <div className="px-8 pt-6 pb-2">
          <h1 className="text-lg font-semibold text-gray-900">{definition.title}</h1>
          {definition.header.subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{definition.header.subtitle}</p>
          )}
        </div>
      )}

      {dataset.context && (
        <div className="px-8 pb-3">
          <p className="text-xs text-gray-400">{dataset.context}</p>
        </div>
      )}

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300">
            <th className="px-8 py-2 text-left text-xs font-semibold text-gray-500 w-48" />
            {visibleCols.map((col, i) => {
              const w = col.width === 'narrow' ? 80 : col.width === 'wide' ? 160 : 120
              return (
                <th key={i} style={{ width: w, minWidth: w }}
                  className={`px-4 py-2 text-right text-xs font-semibold whitespace-nowrap
                    ${col.highlight ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}
                    ${isCalcColumn(col) ? 'text-gray-400 italic' : ''}`}>
                  {col.label}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {renderRows.map((row) => {
            if (row.type === 'spacer') {
              return <tr key={row.id} className="h-3"><td colSpan={visibleCols.length + 1} /></tr>
            }
            if (row.type === 'header') {
              return (
                <tr key={row.id} className="bg-gray-50">
                  <td colSpan={visibleCols.length + 1}
                    className="py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider"
                    style={{ paddingLeft: `${2 + row.indent}rem` }}>
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
              <tr key={row.id}
                className={`${borderAbove} ${borderBelow} ${isTotal ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>

                <td
                  className={`px-8 py-2 text-xs whitespace-nowrap text-gray-800
                    ${row.bold || isTotal ? 'font-semibold' : 'font-normal'}`}
                  style={{ paddingLeft: `${2 + row.indent}rem` }}>
                  {row.label}
                </td>

                {visibleCols.map((col, ci) => {
                  const raw = isCalcColumn(col)
                    ? getCalcValue(row.member, col)
                    : getRawValue(row.member, col.member)
                  const unfav = isUnfavorable(raw, col)
                  const pct = isCalcColumn(col) && isPct(col)

                  return (
                    <td key={ci}
                      className={`px-4 py-2 text-right text-xs tabular-nums whitespace-nowrap
                        ${row.bold || isTotal ? 'font-semibold' : ''}
                        ${col.highlight ? 'bg-blue-50' : ''}
                        ${unfav ? 'text-red-600' : 'text-gray-900'}`}>
                      {formatValue(raw, isCalcColumn(col) ? false : row.signFlip, pct)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Footer */}
      {(definition.header.confidentiality || definition.header.footer) && (
        <div className="px-8 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">{definition.header.confidentiality}</span>
          <span className="text-xs text-gray-400">{definition.header.footer}</span>
        </div>
      )}

      <div className="h-4" />
    </div>
  )
}
