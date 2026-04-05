import { Plus, FileText } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'

interface ReportListPanelProps {
  onSelect: (id: string) => void
  onNew: () => void
}

export default function ReportListPanel({ onSelect, onNew }: ReportListPanelProps) {
  const { reportList, definition } = useReportStore()

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
      <div className="px-3 py-3 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Reports</span>
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                     bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Report
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        {reportList.length === 0 && (
          <p className="px-3 py-4 text-xs text-gray-600 text-center">No reports yet</p>
        )}
        {reportList.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id)}
            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors
              ${definition.id === r.id
                ? 'bg-gray-800 text-gray-100'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{r.title || 'Untitled'}</span>
            {r.status === 'draft' && (
              <span className="ml-auto text-xs text-yellow-600 shrink-0">Draft</span>
            )}
          </button>
        ))}
      </nav>
    </aside>
  )
}
