import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useReportStore } from '../store/useReportStore'
import { useVisualStore } from '../store/useVisualStore'
import { api } from '../lib/api'
import { VisualDefinition } from '../types/report'
import AppBar from '../components/builder/AppBar'
import ReportListPanel from '../components/builder/ReportListPanel'
import CanvasPanel from '../components/builder/CanvasPanel'
import PropertiesPanel from '../components/builder/PropertiesPanel'
import HistoryPanel from '../components/builder/HistoryPanel'
import VisualPropertiesPanel from '../components/builder/VisualPropertiesPanel'

export default function BuilderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { newReport, loadDefinition, definition, markClean, setReportList, setDataset, setLastDatasetAt } = useReportStore()
  const { setDefinition: loadVisualDefinition, reset: resetVisual, setDataset: setVisualDataset, definition: visualDef, markClean: markVisualClean } = useVisualStore()
  const [saving, setSaving] = useState(false)
  const [visualSaving, setVisualSaving] = useState(false)
  const [visualIsConfirmed, setVisualIsConfirmed] = useState(false)
  const [toast, setToast] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null)
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null)
  const [fromPack, setFromPack] = useState<{ id: string; name: string } | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null)
  const [artifactType, setArtifactType] = useState<'report' | 'visual'>('report')

  const activeTab = (searchParams.get('tab') as 'reports' | 'visuals' | 'packs' | 'images') || 'reports'
  const setActiveTab = (tab: 'reports' | 'visuals' | 'packs' | 'images') => {
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

  // Auto-select pack from URL param
  const packParam = searchParams.get('pack')
  const [autoSelectedPack, setAutoSelectedPack] = useState(false)
  useEffect(() => {
    if (packParam && !autoSelectedPack) {
      setActiveTab('packs')
      setSelectedPackId(packParam)
      setAutoSelectedPack(true)
    }
  }, [packParam, autoSelectedPack])

  const handleNew = () => { newReport(); setArtifactType('report') }

  // Clear visual when switching away from visuals tab
  useEffect(() => {
    if (activeTab !== 'visuals') {
      setSelectedVisualId(null)
      resetVisual()
    }
  }, [activeTab, resetVisual])

  const handleSelect = async (id: string) => {
    setShowHistory(false)
    setSelectedVisualId(null)
    setArtifactType('report')
    try {
      const def = await api.getDefinition(id)
      loadDefinition(def.definition as unknown as Parameters<typeof loadDefinition>[0])
      setDataset(def.dataset)
      setLastDatasetAt(def.lastDatasetAt ? new Date(def.lastDatasetAt) : null)
    } catch {
      showToast('Failed to load report')
    }
  }

  const handleSelectVisual = async (id: string) => {
    setShowHistory(false)
    setSelectedVisualId(id)
    setArtifactType('visual')
    try {
      const v = await api.getVisual(id)
      const stored = v.definition as unknown as VisualDefinition
      loadVisualDefinition({
        id,
        title: v.title,
        visualType: (v.visualType ?? stored.visualType) as VisualDefinition['visualType'],
        cube: stored.cube,
        view: stored.view,
        selectors: stored.selectors,
        numberFormat: stored.numberFormat,
        kpiConfig: stored.kpiConfig,
        chartConfig: stored.chartConfig,
      })
      if (stored.cube && stored.view) {
        const ds = await api.getDataset(stored.cube, stored.view)
        setVisualDataset(ds)
      }
    } catch (e) {
      console.error('handleSelectVisual error:', e)
    }
  }

  const handleOpenVisual = (id: string) => {
    setActiveTab('visuals')
    setSelectedVisualId(id)
    setArtifactType('visual')
    handleSelectVisual(id)
  }

  const handleSelectPack = (id: string) => {
    setSelectedPackId(id)
    setActiveTab('packs')
    setFromPack(null)
  }

  const handleSelectArtifactFromPack = (artifactId: string, type: 'report' | 'visual', pack: { id: string; name: string }) => {
    setFromPack(pack)
    if (type === 'visual') {
      handleOpenVisual(artifactId)
    } else {
      setActiveTab('reports')
      handleSelect(artifactId)
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

  const handleVisualSave = async () => {
    if (!selectedVisualId) return
    setVisualSaving(true)
    try {
      await api.saveVisualDraft(selectedVisualId, visualDef.title, visualDef.visualType, visualDef)
      markVisualClean()
      showToast('Draft saved')
    } catch {
      showToast('Save failed')
    } finally {
      setVisualSaving(false)
    }
  }

  const handleVisualPublish = async () => {
    if (!selectedVisualId) return
    setVisualSaving(true)
    try {
      await api.publishVisual(selectedVisualId, visualDef.title, visualDef.visualType, visualDef)
      markVisualClean()
      showToast('Published')
    } catch {
      showToast('Publish failed')
    } finally {
      setVisualSaving(false)
    }
  }

  const handleVisualDelete = async () => {
    if (!selectedVisualId) return
    if (!window.confirm('Delete this visual? This cannot be undone.')) return
    try {
      await api.deleteVisual(selectedVisualId)
      resetVisual()
      setSelectedVisualId(null)
      showToast('Visual deleted')
    } catch {
      showToast('Delete failed')
    }
  }

  const handleVisualConfirm = async () => {
    if (!selectedVisualId) return
    try {
      await api.confirmVisual(selectedVisualId)
      setVisualIsConfirmed(true)
      showToast('Visual confirmed')
    } catch {
      showToast('Confirm failed')
    }
  }

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
        activeTab={activeTab}
        artifactType={artifactType}
        visualSaving={visualSaving}
        onVisualSave={handleVisualSave}
        onVisualPublish={handleVisualPublish}
        onVisualDelete={handleVisualDelete}
        onVisualConfirm={handleVisualConfirm}
        visualIsConfirmed={visualIsConfirmed}
      />
      <div className="flex flex-1 overflow-hidden">
        {!focusMode && <ReportListPanel
          tab={activeTab}
          setTab={setActiveTab}
          onSelect={handleSelect}
          onNew={handleNew}
          onSelectVisual={handleSelectVisual}
          onOpenVisual={handleOpenVisual}
          onSelectPack={handleSelectPack}
          onSelectImage={(url, name) => { setSelectedImage({ url, name }) }}
        />}
        <CanvasPanel 
          focusMode={focusMode} 
          activeTab={activeTab} 
          selectedImage={selectedImage} 
          setSelectedImage={setSelectedImage}
          selectedPackId={selectedPackId}
          onOpenComposer={() => navigate(`/builder/packs/${selectedPackId}`)}
          onOpenViewer={() => navigate(`/viewer/${selectedPackId}`)}
          fromPack={fromPack}
          onBackToPack={() => handleSelectPack(fromPack!.id)}
          onSelectArtifact={(id, type, packName) => handleSelectArtifactFromPack(id, type, { id: selectedPackId!, name: packName ?? 'Pack' })}
        />
        {!focusMode && !showHistory && activeTab === 'reports' && <PropertiesPanel />}
        {!focusMode && activeTab === 'visuals' && (
          <VisualPropertiesPanel
            visualId={selectedVisualId}
            isConfirmed={visualIsConfirmed}
            onConfirmedChange={setVisualIsConfirmed}
          />
        )}
        {!focusMode && showHistory && activeTab === 'reports' && (
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
