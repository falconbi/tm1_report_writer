import { useReportStore } from '../../store/useReportStore'
import { Scale, NegativeStyle, PageSize, PageOrientation, TableScale } from '../../types/report'

const SCALES: { value: Scale; label: string; hint: string }[] = [
  { value: 'units',     label: 'Units',     hint: '1,234,567'  },
  { value: 'thousands', label: 'Thousands', hint: '1,235'      },
  { value: 'millions',  label: 'Millions',  hint: '1.2'        },
]

const NEGATIVES: { value: NegativeStyle; label: string; hint: string }[] = [
  { value: 'brackets', label: 'Brackets', hint: '(1,234)' },
  { value: 'minus',    label: 'Minus',    hint: '-1,234'  },
]

const PAGE_SIZES: { value: PageSize; label: string }[] = [
  { value: 'a4',     label: 'A4'     },
  { value: 'letter', label: 'Letter' },
]

const ORIENTATIONS: { value: PageOrientation; label: string; hint: string }[] = [
  { value: 'portrait',  label: 'Portrait',  hint: '794px'  },
  { value: 'landscape', label: 'Landscape', hint: '1123px' },
]

const TABLE_SCALES: { value: TableScale; label: string; hint: string }[] = [
  { value: 'md', label: 'Normal',  hint: 'Default column widths' },
  { value: 'sm', label: 'Dense',   hint: 'Narrower cols, smaller text' },
  { value: 'xs', label: 'Compact', hint: 'Minimum — fits wide reports' },
]

export default function FormatTab() {
  const { definition, setNumberFormat, setHeader, setPageLayout, setTableScale } = useReportStore()
  const { numberFormat, header } = definition

  return (
    <div className="space-y-5">

      {/* Scale */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Scale</p>
        <div className="space-y-1">
          {SCALES.map((s) => (
            <button
              key={s.value}
              onClick={() => setNumberFormat({ scale: s.value })}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors
                ${numberFormat.scale === s.value
                  ? 'bg-blue-400 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              <span>{s.label}</span>
              <span className={`tabular-nums ${numberFormat.scale === s.value ? 'text-blue-200' : 'text-gray-500'}`}>
                {s.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Decimals */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Decimal places</p>
        <div className="flex gap-2">
          {([0, 1, 2] as const).map((d) => (
            <button
              key={d}
              onClick={() => setNumberFormat({ decimals: d })}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors
                ${numberFormat.decimals === d
                  ? 'bg-blue-400 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Negative style */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Negative numbers</p>
        <div className="space-y-1">
          {NEGATIVES.map((n) => (
            <button
              key={n.value}
              onClick={() => setNumberFormat({ negativeStyle: n.value })}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors
                ${numberFormat.negativeStyle === n.value
                  ? 'bg-blue-400 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              <span>{n.label}</span>
              <span className={`tabular-nums ${numberFormat.negativeStyle === n.value ? 'text-blue-200' : 'text-gray-500'}`}>
                {n.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Page size + orientation */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Page size</p>
        <div className="flex gap-2 mb-3">
          {PAGE_SIZES.map((s) => (
            <button key={s.value} onClick={() => setPageLayout({ pageSize: s.value })}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors
                ${definition.pageSize === s.value
                  ? 'bg-blue-400 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="space-y-1">
          {ORIENTATIONS.map((o) => (
            <button key={o.value} onClick={() => setPageLayout({ orientation: o.value })}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors
                ${definition.orientation === o.value
                  ? 'bg-blue-400 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
              <span>{o.label}</span>
              <span className={definition.orientation === o.value ? 'text-blue-200' : 'text-gray-500'}>
                {o.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table density */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Table density</p>
        <div className="space-y-1">
          {TABLE_SCALES.map((s) => {
            const active = (definition.tableScale ?? 'md') === s.value
            return (
              <button
                key={s.value}
                onClick={() => setTableScale(s.value)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors
                  ${active ? 'bg-blue-400 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                <span>{s.label}</span>
                <span className={active ? 'text-blue-200' : 'text-gray-500'}>{s.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-gray-800" />

      {/* Header fields */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Report header</p>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Subtitle</label>
            <input
              type="text"
              value={header.subtitle}
              onChange={(e) => setHeader({ subtitle: e.target.value })}
              placeholder="e.g. For the period ended March 2026"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-xs
                         text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Confidentiality</label>
            <input
              type="text"
              value={header.confidentiality}
              onChange={(e) => setHeader({ confidentiality: e.target.value })}
              placeholder="Confidential — Internal Use Only"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-xs
                         text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Footer</label>
            <input
              type="text"
              value={header.footer}
              onChange={(e) => setHeader({ footer: e.target.value })}
              placeholder="Notes, disclaimers…"
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-xs
                         text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      </div>

    </div>
  )
}
