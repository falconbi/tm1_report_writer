import { useState } from 'react'
import { BarChart3, Save, Upload, Clock, Eye, EyeOff, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'

interface AppBarProps {
  onSaveDraft: () => void
  onPublish: () => void
  onDelete: () => void
  onHistoryToggle: () => void
  onPreview: () => void
  saving?: boolean
  focusMode?: boolean
}

export default function AppBar({ onSaveDraft, onPublish, onDelete, onHistoryToggle, onPreview, saving, focusMode }: AppBarProps) {
  const { definition, isDirty, isReadOnly, reportList } = useReportStore()
  const hasSource = !!(definition.cube && definition.view)
  const isSaved = !!(definition.id)

  // Find this report's confirmation state from the list
  const reportMeta = reportList.find((r) => r.id === definition.id)
  const isConfirmed = reportMeta?.isConfirmed ?? false
  const confirmedAt = reportMeta?.confirmedAt

  const [confirming, setConfirming] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleConfirm = async () => {
    if (!definition.id) return
    setConfirming(true)
    try {
      // Build selectors map from current definition
      const selectors: Record<string, string> = {}
      definition.selectors.forEach((s) => { selectors[s.dimension] = s.selected })
      await api.confirmData(definition.id, selectors)
      // Refresh report list to pick up new confirmed state
      const d = await api.listReports()
      useReportStore.getState().setReportList(d.reports)
    } catch (e) {
      console.error('Confirm failed', e)
      alert('Confirm failed — check the backend is running and try again')
    } finally {
      setConfirming(false)
      setShowConfirmDialog(false)
    }
  }

  const confirmedLabel = confirmedAt
    ? `Confirmed ${new Date(confirmedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : ''

  return (
    <>
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

        {/* Confirmed badge */}
        {isConfirmed && (
          <span className="flex items-center gap-1 text-xs text-emerald-400" title={confirmedLabel}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {confirmedLabel}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {!isReadOnly && (
            <>
              <button
                onClick={onSaveDraft}
                disabled={!hasSource || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                           bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40
                           disabled:cursor-not-allowed transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Save Draft'}
              </button>

              {/* Confirm Data — only shown when report has a source and is saved */}
              {isSaved && hasSource && (
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={saving || confirming}
                  title={isDirty ? 'You have unsaved changes — save draft first for confirmation to be valid' : 'Confirm data has been checked against TM1'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                    disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                    ${isConfirmed
                      ? 'bg-emerald-800 hover:bg-emerald-700 text-emerald-200'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                    }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isConfirmed ? 'Re-confirm' : 'Confirm Data'}
                </button>
              )}

              <button
                onClick={onPublish}
                disabled={!hasSource || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                           bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40
                           disabled:cursor-not-allowed transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                {saving ? 'Saving…' : 'Publish'}
              </button>

              {isSaved && (
                <button
                  onClick={onDelete}
                  disabled={saving}
                  title="Delete report"
                  className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md
                             text-gray-500 hover:text-red-400 hover:bg-gray-800 disabled:opacity-40
                             disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}

          <button
            onClick={onPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                       bg-gray-800 hover:bg-gray-700 text-gray-200 transition-colors"
          >
            {focusMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {focusMode ? 'Exit Focus' : 'Focus'}
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

      {/* Confirm Data dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[440px] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-100">Confirm Source Data</h2>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              By confirming you attest that:
            </p>
            <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>The data displayed has been reviewed and is correct</li>
              <li>The TM1 period close is complete for this report</li>
              <li>The numbers match the expected source data</li>
            </ul>

            {definition.selectors.length > 0 && (
              <div className="bg-gray-800 rounded-md px-3 py-2 space-y-1">
                <p className="text-xs text-gray-500 mb-1">Confirming for selectors:</p>
                {definition.selectors.map((s) => (
                  <div key={s.dimension} className="flex justify-between text-xs">
                    <span className="text-gray-500">{s.label || s.dimension}</span>
                    <span className="text-gray-200 font-medium">{s.selected}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-yellow-600">
              This confirmation will be recorded with your name and timestamp.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-2 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="flex-1 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white
                           rounded-md font-medium disabled:opacity-40 transition-colors"
              >
                {confirming ? 'Confirming…' : 'I confirm the data is correct'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
