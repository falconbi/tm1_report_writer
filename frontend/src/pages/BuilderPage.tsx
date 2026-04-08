import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useReportStore } from '../store/useReportStore'
import { api } from '../lib/api'
import AppBar from '../components/builder/AppBar'
import ReportListPanel from '../components/builder/ReportListPanel'
import CanvasPanel from '../components/builder/CanvasPanel'
import PropertiesPanel from '../components/builder/PropertiesPanel'
import HistoryPanel from '../components/builder/HistoryPanel'
import NoteEditor from '../components/builder/NoteEditor'
import VisualEditor from '../components/builder/VisualEditor'

export default function BuilderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { newReport, loadDefinition, definition, markClean, setReportList } = useReportStore()
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null)
  const [artifactType, setArtifactType] = useState<'report' | 'note' | 'visual'>('report')
  const [editorOriginTab, setEditorOriginTab] = useState<'reports' | 'notes' | 'visuals' | 'packs'>('reports')

  const activeTab = (searchParams.get('tab') as 'reports' | 'notes' | 'visuals' | 'packs') || 'reports'
  const setActiveTab = (tab: 'reports' | 'notes' | 'visuals' | 'packs') => {
    setSearchParams({ tab })
  }

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

  const handleNew = () => { newReport(); setArtifactType('report') }

  const handleSelect = async (id: string) => {
    setShowHistory(false)
    setSelectedNoteId(null)
    setSelectedVisualId(null)
    setArtifactType('report')
    try {
      const def = await api.getDefinition(id)
      loadDefinition(def as unknown as Parameters<typeof loadDefinition>[0])
    } catch {
      showToast('Failed to load report')
    }
  }

  const handleSelectNote = (id: string) => {
    setEditorOriginTab('packs')
    setSelectedNoteId(id)
    setSelectedVisualId(null)
    setArtifactType('note')
    loadDefinition({ id: '', title: '', cube: '', view: '', header: { logo: true, title: '', subtitle: '', preparedDate: 'auto', confidentiality: '', footer: '' }, numberFormat: { scale: 'units', decimals: 0, negativeStyle: 'minus', thousandsSeparator: true }, columnGroups: [], columns: [], rows: [], selectors: [], cfRules: [], pageSize: 'a4', orientation: 'portrait' })
  }

  const handleSelectVisual = (id: string) => {
    setEditorOriginTab('packs')
    setSelectedVisualId(id)
    setSelectedNoteId(null)
    setArtifactType('visual')
    loadDefinition({ id: '', title: '', cube: '', view: '', header: { logo: true, title: '', subtitle: '', preparedDate: 'auto', confidentiality: '', footer: '' }, numberFormat: { scale: 'units', decimals: 0, negativeStyle: 'minus', thousandsSeparator: true }, columnGroups: [], columns: [], rows: [], selectors: [], cfRules: [], pageSize: 'a4', orientation: 'portrait' })
  }

  const handleOpenNote = (id: string) => {
    setEditorOriginTab('notes')
    setSelectedNoteId(id)
    setSelectedVisualId(null)
    setArtifactType('note')
  }

  const handleOpenVisual = (id: string) => {
    setEditorOriginTab('visuals')
    setSelectedVisualId(id)
    setSelectedNoteId(null)
    setArtifactType('visual')
  }

  const handleEditorClose = () => {
    setActiveTab(editorOriginTab)
    setSelectedNoteId(null)
    setSelectedVisualId(null)
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

  const handleDelete = async () => {
    if (!definition.id) return
    if (!window.confirm(`Delete "${definition.title || 'Untitled Report'}"? This cannot be undone.`)) return
    try {
      await api.deleteReport(definition.id)
      newReport()
      const updated = await api.listReports()
      setReportList(updated.reports)
      showToast('Report deleted')
    } catch {
      showToast('Delete failed')
    }
  }

  const handleHistoryToggle = () => setShowHistory((v) => !v)

  const handlePreview = () => setFocusMode((v) => !v)

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <AppBar
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onDelete={handleDelete}
        onHistoryToggle={handleHistoryToggle}
        onPreview={handlePreview}
        saving={saving}
        focusMode={focusMode}
        artifactType={artifactType}
      />
      <div className="flex flex-1 overflow-hidden">
        {!focusMode && <ReportListPanel
          tab={activeTab}
          setTab={setActiveTab}
          onSelect={handleSelect}
          onNew={handleNew}
          onDelete={handleDelete}
          onSelectNote={handleSelectNote}
          onSelectVisual={handleSelectVisual}
          onOpenNote={handleOpenNote}
          onOpenVisual={handleOpenVisual}
        />}
        <CanvasPanel focusMode={focusMode} />
        {selectedNoteId && !focusMode && (
          <NoteEditor
            noteId={selectedNoteId}
            initialIsConfirmed={false}
            initialConfirmedAt={undefined}
            onClose={handleEditorClose}
            onSaved={() => { setSelectedNoteId(null); newReport() }}
            onDeleted={() => handleEditorClose()}
          />
        )}
        {selectedVisualId && !focusMode && (
          <VisualEditor
            visualId={selectedVisualId}
            initialIsConfirmed={false}
            initialConfirmedAt={undefined}
            onClose={handleEditorClose}
            onSaved={() => { setSelectedVisualId(null); newReport() }}
            onDeleted={() => handleEditorClose()}
          />
        )}
        {!focusMode && !showHistory && <PropertiesPanel />}
        {!focusMode && showHistory && (
          <HistoryPanel
            onClose={() => setShowHistory(false)}
            onRestored={() => showToast('Version restored as draft')}
          />
        )}
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
