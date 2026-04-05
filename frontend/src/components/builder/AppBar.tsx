import { BarChart3, Save, Upload, Clock, Eye } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'

interface AppBarProps {
  onSaveDraft: () => void
  onPublish: () => void
  onHistoryToggle: () => void
  onPreview: () => void
}

export default function AppBar({ onSaveDraft, onPublish, onHistoryToggle, onPreview }: AppBarProps) {
  const { definition, isDirty, isReadOnly } = useReportStore()
  const hasSource = !!(definition.cube && definition.view)

  return (
    <header className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 shrink-0">
      {/* Brand */}
      <div className="flex items-center gap-2 text-gray-100 font-semibold">
        <BarChart3 className="h-4 w-4 text-blue-500" />
        <span className="text-sm">Report Writer</span>
      </div>

      <div className="w-px h-5 bg-gray-700" />

      {/* Report title */}
      <span className="text-sm text-gray-400 truncate max-w-xs">
        {definition.title || 'Untitled Report'}
        {isDirty && <span className="ml-1 text-yellow-500">•</span>}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {!isReadOnly && (
          <>
            <button
              onClick={onSaveDraft}
              disabled={!hasSource}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                         bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Save Draft
            </button>

            <button
              onClick={onPublish}
              disabled={!hasSource}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                         bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Publish
            </button>
          </>
        )}

        <button
          onClick={onPreview}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>

        <button
          onClick={onHistoryToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                     bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
        >
          <Clock className="h-3.5 w-3.5" />
          History
        </button>
      </div>
    </header>
  )
}
