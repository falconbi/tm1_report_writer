import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer,
} from 'recharts'
import { VisualDefinition } from '../../types/report'
import { RawDataset } from '../../lib/api'

interface Props {
  definition: VisualDefinition
  dataset: RawDataset | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

function formatNumber(val: number | null, scale?: string, decimals?: number, prefix?: string, unit?: string): string {
  if (val === null) return '—'
  const s = scale === 'thousands' ? 1000 : scale === 'millions' ? 1000000 : 1
  const d = decimals ?? 0
  const scaled = val / s
  const formatted = Math.abs(scaled).toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
  const sign = val < 0 ? '-' : ''
  return `${sign}${prefix ?? ''}${formatted}${unit ? ' ' + unit : ''}`
}

function getCellValue(dataset: RawDataset, rowMember: string, colMember: string): number | null {
  const rowTuples = dataset.axes[1]?.tuples ?? []
  const colTuples = dataset.axes[0]?.tuples ?? []
  const ri = rowTuples.findIndex((t) => t.members.join(' / ') === rowMember)
  const ci = colTuples.findIndex((t) => t.members.join(' / ') === colMember)
  if (ri === -1 || ci === -1) return null
  return dataset.cells[ri]?.[ci] ?? null
}

// ─── KPI Renderer ─────────────────────────────────────────────────────────────

function KPIRenderer({ definition, dataset }: Props) {
  const cfg = definition.kpiConfig
  if (!cfg) return <div className="p-6 text-xs text-gray-400">No KPI config</div>

  const value = dataset ? getCellValue(dataset, cfg.valueRow, cfg.valueColumn) : null
  const comparison = (dataset && cfg.comparisonColumn)
    ? getCellValue(dataset, cfg.valueRow, cfg.comparisonColumn)
    : null

  const variance = (value !== null && comparison !== null) ? value - comparison : null
  const pctVar = (variance !== null && comparison !== null && comparison !== 0)
    ? (variance / Math.abs(comparison)) * 100
    : null

  const favorable = cfg.trendDirection ?? 'up-good'
  const isPositive = variance !== null ? variance > 0 : null
  const isGood = isPositive === null ? null
    : favorable === 'up-good' ? isPositive : !isPositive
  const colorClass = isGood === null ? 'text-gray-500' : isGood ? 'text-emerald-600' : 'text-red-500'

  const TrendIcon = isPositive === null ? Minus : isPositive ? TrendingUp : TrendingDown

  const scale = cfg.scale ?? definition.numberFormat.scale
  const decimals = cfg.decimals ?? definition.numberFormat.decimals

  return (
    <div className="flex flex-col items-center justify-center p-6 h-full min-h-[140px]">
      <p className="text-xs text-gray-500 mb-1 text-center truncate w-full">{definition.title}</p>
      <div className="text-3xl font-bold text-gray-900 tabular-nums">
        {formatNumber(value, scale, decimals, cfg.prefix, cfg.unit)}
      </div>
      {variance !== null && (
        <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${colorClass}`}>
          <TrendIcon className="h-4 w-4" />
          <span>{formatNumber(variance, scale, decimals, cfg.prefix)}</span>
          {pctVar !== null && (
            <span className="text-xs ml-0.5">
              ({Math.abs(pctVar).toFixed(1)}%)
            </span>
          )}
          {cfg.comparisonLabel && (
            <span className="text-xs text-gray-400 font-normal ml-1">{cfg.comparisonLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Chart Renderer ───────────────────────────────────────────────────────────

function ChartRenderer({ definition, dataset }: Props) {
  const cfg = definition.chartConfig
  if (!cfg) return <div className="p-6 text-xs text-gray-400">No chart config</div>
  if (!dataset) return <div className="p-6 text-xs text-gray-400">No data</div>

  const rowTuples = dataset.axes[1]?.tuples ?? []
  const colTuples = dataset.axes[0]?.tuples ?? []

  const allRowMembers = rowTuples.map((t) => t.members.join(' / '))
  const allColMembers = colTuples.map((t) => t.members.join(' / '))

  const selectedRows = cfg.selectedRows.length > 0
    ? cfg.selectedRows.filter((r) => allRowMembers.includes(r))
    : allRowMembers.slice(0, 10)
  const selectedCols = cfg.selectedColumns.length > 0
    ? cfg.selectedColumns.filter((c) => allColMembers.includes(c))
    : allColMembers.slice(0, 5)

  const colors = cfg.colors?.length ? cfg.colors : CHART_COLORS

  // Build chart data — rows as X axis, columns as series
  const data = selectedRows.map((row) => {
    const point: Record<string, string | number | null> = { name: row }
    selectedCols.forEach((col) => {
      point[col] = getCellValue(dataset, row, col)
    })
    return point
  })

  const showLegend = cfg.showLegend ?? selectedCols.length > 1
  const showGrid = cfg.showGrid ?? true
  const showLabels = cfg.showLabels ?? true
  const labelFs = cfg.labelFontSize ?? 10
  const legendFs = cfg.legendFontSize ?? 10

  if (cfg.chartType === 'pie') {
    // Pie uses first column, rows as slices
    const pieData = selectedRows.map((row, i) => ({
      name: row,
      value: getCellValue(dataset, row, selectedCols[0] ?? '') ?? 0,
      fill: colors[i % colors.length],
    })).filter((d) => d.value > 0)

    const RADIAN = Math.PI / 180
    const renderPieLabel = (props: { cx?: number; cy?: number; midAngle?: number; outerRadius?: number; name?: string }) => {
      const { cx = 0, cy = 0, midAngle = 0, outerRadius = 0, name = '' } = props
      const radius = outerRadius + 15
      const x = cx + radius * Math.cos(-midAngle * RADIAN)
      const y = cy + radius * Math.sin(-midAngle * RADIAN)
      return (
        <text x={x} y={y} fontSize={labelFs} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fill="#555">
          {name}
        </text>
      )
    }

    return (
      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData} dataKey="value" nameKey="name"
              cx="50%" cy="50%" outerRadius={90}
              label={showLabels ? renderPieLabel : undefined}
              labelLine={showLabels}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            {showLegend && <Legend iconSize={8} wrapperStyle={{ fontSize: legendFs }} />}
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  const ChartComponent = cfg.chartType === 'line' ? LineChart : BarChart

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={data} margin={{ top: 4, right: 8, left: 4, bottom: showLabels ? 40 : 10 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={showLabels ? { fontSize: labelFs } : false} interval={0} angle={-30} textAnchor="end" height={showLabels ? 50 : 10} />
          <YAxis tick={showLabels ? { fontSize: labelFs } : false} tickFormatter={(v: number) => formatNumber(v, definition.numberFormat.scale, definition.numberFormat.decimals)} width={showLabels ? 55 : 10} />
          {showLegend && <Legend iconSize={8} wrapperStyle={{ fontSize: legendFs }} />}
          {selectedCols.map((col, i) =>
            cfg.chartType === 'line'
              ? <Line key={col} type="monotone" dataKey={col} stroke={colors[i % colors.length]} dot={false} strokeWidth={2} />
              : <Bar key={col} dataKey={col} fill={colors[i % colors.length]} />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function VisualRenderer({ definition, dataset }: Props) {
  return (
    <div className="bg-white w-full h-full flex flex-col">
      {definition.visualType === 'kpi'
        ? <KPIRenderer definition={definition} dataset={dataset} />
        : <ChartRenderer definition={definition} dataset={dataset} />
      }
    </div>
  )
}
