import { useState } from 'react'
import { BarChart3, Save, Upload, Clock, Eye, EyeOff, Trash2, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { useVisualStore } from '../../store/useVisualStore'
import { api } from '../../lib/api'

interface AppBarProps {
  onSaveDraft: () => void
  onPublish: () => void
  onDelete: () => void
  onHistoryToggle: () => void
  onPreview: () => void
  saving?: boolean
  focusMode?: boolean
  activeTab?: 'reports' | 'visuals' | 'packs' | 'images'
  artifactType?: 'report' | 'visual'
  visualSaving?: boolean
  onVisualSave?: () => void
  onVisualPublish?: () => void
  onVisualDelete?: () => void
  onVisualConfirm?: () => void
  visualIsConfirmed?: boolean
}

export default function AppBar({ onSaveDraft, onPublish, onDelete, onHistoryToggle, onPreview, saving, focusMode, activeTab, artifactType = 'report', visualSaving = false, onVisualSave, onVisualPublish, onVisualDelete, onVisualConfirm, visualIsConfirmed = false }: AppBarProps) {
  const { definition, isDirty, isReadOnly, reportList } = useReportStore()
  const { definition: visualDef } = useVisualStore()
  const hasSource = !!(definition.cube && definition.view)
  const visualHasSource = !!(visualDef.cube && visualDef.view)
  const isSaved = !!(definition.id)
  const visualIsSaved = !!(visualDef.id)

  const reportMeta = reportList.find((r) => r.id === definition.id)
  const isConfirmed = reportMeta?.isConfirmed ?? false
  const isPublished = reportMeta?.status === 'published'

  const [confirming, setConfirming] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const handleConfirm = async () => {
    if (!definition.id) return
    setConfirming(true)
    try {
      const selectors: Record<string, string> = {}
      definition.selectors.forEach((s) => { selectors[s.dimension] = s.selected })
      await api.confirmData(definition.id, selectors)
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

  return (
    <>
      <header className="h-11 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2 text-blue-400 font-semibold shrink-0">
          <BarChart3 className="h-4 w-4 text-blue-400" />
          <span className="text-sm">Report Writer</span>
        </div>

        {/* Context label */}
        {activeTab && (
          <>
            <span className="text-gray-700 text-sm shrink-0">·</span>
            <span className="text-sm text-gray-400 shrink-0">
              {activeTab === 'reports' && 'Report Editor'}
              {activeTab === 'visuals' && 'Visual Editor'}
              {activeTab === 'packs' && 'Pack Builder'}
              {activeTab === 'images' && 'Image Library'}
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-1">
          {!isReadOnly && (
            <>
              {/* Save Draft — reports */}
              {artifactType !== 'visual' && (
                <button
                  onClick={onSaveDraft}
                  disabled={!hasSource || saving}
                  title="Save Draft"
                  className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4" />
                </button>
              )}

              {/* Save Draft — visuals */}
              {artifactType === 'visual' && onVisualSave && (
                <button
                  onClick={onVisualSave}
                  disabled={!visualHasSource || visualSaving}
                  title="Save Draft"
                  className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4" />
                </button>
              )}

              {/* Confirm — reports only */}
              {artifactType === 'report' && isSaved && hasSource && (
                <button
                  onClick={() => setShowConfirmDialog(true)}
                  disabled={saving || confirming}
                  title={isDirty ? 'Save draft first' : 'Confirm data'}
                  className={`p-2 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                    ${isConfirmed
                      ? 'text-emerald-400 hover:bg-emerald-900/50'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                    }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
              )}

              {/* Confirm — visuals */}
              {artifactType === 'visual' && visualIsSaved && visualHasSource && onVisualConfirm && (
                <button
                  onClick={onVisualConfirm}
                  title="Confirm"
                  className={`p-2 rounded transition-colors disabled:opacity-30
                    ${visualIsConfirmed
                      ? 'text-emerald-400 hover:bg-emerald-900/50'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-gray-800'
                    }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}

              {/* Publish — reports */}
              {artifactType !== 'visual' && isSaved && !isPublished && (
                <button
                  onClick={onPublish}
                  disabled={!hasSource || saving}
                  title="Publish"
                  className="p-2 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/50
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="h-4 w-4" />
                </button>
              )}

              {/* Publish — visuals */}
              {artifactType === 'visual' && visualIsSaved && onVisualPublish && (
                <button
                  onClick={onVisualPublish}
                  disabled={!visualHasSource || visualSaving}
                  title="Publish"
                  className="p-2 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/50
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="h-4 w-4" />
                </button>
              )}

              {/* Delete — reports */}
              {artifactType !== 'visual' && isSaved && (
                <button
                  onClick={onDelete}
                  disabled={saving}
                  title="Delete"
                  className="p-2 rounded text-red-400 hover:text-red-300 hover:bg-red-900/50
                             disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              {/* Delete — visuals */}
              {artifactType === 'visual' && visualIsSaved && onVisualDelete && (
                <button
                  onClick={onVisualDelete}
                  title="Delete"
                  className="p-2 rounded text-red-400 hover:text-red-300 hover:bg-red-900/50 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          <div className="w-px h-4 bg-gray-700 mx-1" />

          {/* Focus */}
          <button
            onClick={onPreview}
            title={focusMode ? 'Exit Focus' : 'Focus'}
            className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            {focusMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>

          {/* History */}
          <button
            onClick={onHistoryToggle}
            title="History"
            className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Confirm dialog */}
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

            {(definition.selectors?.length ?? 0) > 0 && (
              <div className="bg-gray-800 rounded-md px-3 py-2 space-y-1">
                <p className="text-xs text-gray-500 mb-1">Confirming for selectors:</p>
                {(definition.selectors ?? []).map((s) => (
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
