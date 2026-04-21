import { useEffect, useState } from 'react'
import { X, RotateCcw, Eye, Clock } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { api } from '../../lib/api'
import { parseDate } from '../../lib/dateUtils'
import ReportRenderer from '../shared/ReportRenderer'

interface Version {
  id: number
  publishedAt: string
  publishedBy: string | null
}

interface Props {
  onClose: () => void
  onRestored: () => void
}

function fmt(iso: string) {
  return (parseDate(iso) ?? new Date()).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function HistoryPanel({ onClose, onRestored }: Props) {
  const { definition, dataset, loadDefinition } = useReportStore()
  const reportId = definition.id

  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [previewing, setPreviewing] = useState<number | null>(null)
  const [previewDef, setPreviewDef] = useState<Record<string, unknown> | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [restoring, setRestoring] = useState<number | null>(null)

  useEffect(() => {
    if (!reportId) return
    setLoading(true)
    api.getHistory(reportId)
      .then((d) => setVersions(d.versions))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [reportId])

  const handlePreview = async (versionId: number) => {
    if (previewing === versionId) { setPreviewing(null); setPreviewDef(null); return }
    setPreviewLoading(true)
    setPreviewing(versionId)
    try {
      const def = await api.getHistoryVersion(reportId!, versionId)
      setPreviewDef(def as Record<string, unknown>)
    } catch {
      setPreviewing(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleRestore = async (versionId: number) => {
    if (!window.confirm('Restore this version as your current draft? Your unsaved changes will be replaced.')) return
    setRestoring(versionId)
    try {
      const def = await api.getHistoryVersion(reportId!, versionId)
      loadDefinition(def as unknown as Parameters<typeof loadDefinition>[0])
      useReportStore.setState({ isDirty: true })
      onRestored()
      onClose()
    } catch {
      alert('Restore failed')
    } finally {
      setRestoring(null)
    }
  }

  if (!reportId) return null

  // Determine which definition to render in preview
  const renderDef = previewDef
    ? previewDef as unknown as Parameters<typeof ReportRenderer>[0]['definition']
    : null

  return (
    <aside className="w-72 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 text-gray-200 text-sm font-medium">
          <Clock className="h-4 w-4 text-gray-500" />
          Version History
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-xs text-gray-600 text-center py-6">Loading…</p>
        )}
        {!loading && versions.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6">No published versions yet</p>
        )}
        {versions.map((v, i) => {
          const isLatest = i === 0
          const isPreviewing = previewing === v.id
          return (
            <div key={v.id} className="border-b border-gray-800 last:border-0">
              {/* Version row */}
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-200">
                      v{versions.length - i}
                    </span>
                    {isLatest && (
                      <span className="text-xs text-blue-400 font-medium">current</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{fmt(v.publishedAt)}</p>
                  {v.publishedBy && (
                    <p className="text-xs text-gray-600 mt-0.5">{v.publishedBy}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <button
                    onClick={() => handlePreview(v.id)}
                    disabled={previewLoading}
                    title={isPreviewing ? 'Close preview' : 'Preview this version'}
                    className={`p-1.5 rounded transition-colors ${
                      isPreviewing
                        ? 'text-blue-400 bg-blue-900/30'
                        : 'text-gray-600 hover:text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  {!isLatest && (
                    <button
                      onClick={() => handleRestore(v.id)}
                      disabled={restoring === v.id}
                      title="Restore as current draft"
                      className="p-1.5 rounded text-gray-600 hover:text-amber-400 hover:bg-gray-800 transition-colors"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${restoring === v.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              {/* Inline preview */}
              {isPreviewing && (
                <div className="border-t border-gray-800 bg-gray-950 p-3">
                  {previewLoading ? (
                    <p className="text-xs text-gray-600 text-center py-4">Loading preview…</p>
                  ) : renderDef && dataset ? (
                    <div className="bg-white rounded overflow-hidden" style={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: '182%' }}>
                      <ReportRenderer definition={renderDef} dataset={dataset} />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600 text-center py-4">
                      Load a dataset in the canvas to preview
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-gray-800 shrink-0">
        <p className="text-xs text-gray-600 leading-relaxed">
          Every publish creates an archived snapshot. Restore loads a previous version as your current draft — you can then review and re-publish.
        </p>
      </div>
    </aside>
  )
}
