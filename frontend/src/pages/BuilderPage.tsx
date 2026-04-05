import { useEffect, useState } from 'react'
import { useReportStore } from '../store/useReportStore'
import { api } from '../lib/api'
import AppBar from '../components/builder/AppBar'
import ReportListPanel from '../components/builder/ReportListPanel'
import CanvasPanel from '../components/builder/CanvasPanel'
import PropertiesPanel from '../components/builder/PropertiesPanel'

export default function BuilderPage() {
  const { newReport, loadDefinition, definition, markClean, setReportList } = useReportStore()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [focusMode, setFocusMode] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Load report list on mount
  useEffect(() => {
    api.listReports()
      .then((d) => setReportList(d.reports))
      .catch(() => {})
  }, [])

  const handleNew = () => newReport()

  const handleSelect = async (id: string) => {
    try {
      const def = await api.getDefinition(id)
      loadDefinition(def as unknown as Parameters<typeof loadDefinition>[0])
    } catch {
      showToast('Failed to load report')
    }
  }

  const handleSaveDraft = async () => {
    if (!definition.id) return
    setSaving(true)
    try {
      await api.saveDraft(definition.id, definition)
      markClean()
      const updated = await api.listReports()
      setReportList(updated.reports)
      showToast('Draft saved')
    } catch {
      showToast('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!definition.id) return
    setSaving(true)
    try {
      await api.publish(definition.id, definition)
      markClean()
      const updated = await api.listReports()
      setReportList(updated.reports)
      showToast('Published')
    } catch {
      showToast('Publish failed')
    } finally {
      setSaving(false)
    }
  }

  const handleHistoryToggle = () => {
    // TODO: history panel
  }

  const handlePreview = () => setFocusMode((v) => !v)

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <AppBar
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onHistoryToggle={handleHistoryToggle}
        onPreview={handlePreview}
        saving={saving}
        focusMode={focusMode}
      />
      <div className="flex flex-1 overflow-hidden">
        {!focusMode && <ReportListPanel onSelect={handleSelect} onNew={handleNew} />}
        <CanvasPanel />
        {!focusMode && <PropertiesPanel />}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-gray-100
                        text-xs px-4 py-2 rounded-lg shadow-lg border border-gray-700">
          {toast}
        </div>
      )}
    </div>
  )
}
