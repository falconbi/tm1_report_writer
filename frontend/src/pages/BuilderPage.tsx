import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { useReportStore } from '../store/useReportStore'
import { useVisualStore } from '../store/useVisualStore'
import { api, PackComment } from '../lib/api'
import { parseDate } from '../lib/dateUtils'
import { VisualDefinition, PackPage, migrateLayout } from '../types/report'
import AppBar from '../components/builder/AppBar'
import ReportListPanel from '../components/builder/ReportListPanel'
import CanvasPanel from '../components/builder/CanvasPanel'
import PropertiesPanel from '../components/builder/PropertiesPanel'
import HistoryPanel from '../components/builder/HistoryPanel'
import VisualPropertiesPanel from '../components/builder/VisualPropertiesPanel'
import { Send, MessageSquare, Flag, CheckCircle2 } from 'lucide-react'

export default function BuilderPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { newReport, loadDefinition, definition, dataset, markClean, setReportList, setDataset, setLastDatasetAt } = useReportStore()
  const { setDefinition: loadVisualDefinition, reset: resetVisual, setDataset: setVisualDataset, definition: visualDef, markClean: markVisualClean, newVisual, visualList: _visualList, setVisualList } = useVisualStore()
  const [saving, setSaving] = useState(false)
  const [visualSaving, setVisualSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedVisualId, setSelectedVisualId] = useState<string | null>(null)
  const [selectedPackId, setSelectedPackId] = useState<string | null>(() => sessionStorage.getItem('builderSelectedPack'))
  const [fromPack, setFromPack] = useState<{ id: string; name: string } | null>(null)
  const [selectedImage, setSelectedImage] = useState<{ id: string; url: string; name: string; sizeBytes?: number; mimeType?: string; uploadedAt?: string; width?: number; height?: number; description?: string; altText?: string; tags?: string; uploadedBy?: string } | null>(null)
  const [artifactType, setArtifactType] = useState<'report' | 'visual'>('report')
  const [comments, setComments] = useState<PackComment[]>([])
  const [packPages, setPackPages] = useState<PackPage[]>([])
  const [packMeta, setPackMeta] = useState<{ status: string; hasDraft: boolean; locked: boolean } | null>(null)
  const [packRefreshKey, setPackRefreshKey] = useState(0)
  const [rollForwardOpen, setRollForwardOpen] = useState(false)
  const [rollForwardName, setRollForwardName] = useState('')
  const [rollForwardBusy, setRollForwardBusy] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [commentAuthor, setCommentAuthor] = useState(() => localStorage.getItem('packCommentAuthor') ?? '')
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const activeTab = (searchParams.get('tab') as 'reports' | 'visuals' | 'packs' | 'images') || 'reports'
  const setActiveTab = (tab: 'reports' | 'visuals' | 'packs' | 'images') => {
    setSearchParams({ tab })
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Load comments + pack layout + pack meta whenever selectedPackId changes
  useEffect(() => {
    if (!selectedPackId) { setComments([]); setPackPages([]); setPackMeta(null); return }
    setComments([])
    api.listComments(selectedPackId).then((d) => {
      setComments(d.comments)
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }).catch(() => {})
    api.getPack(selectedPackId).then((p) => {
      setPackPages(migrateLayout(p.layout ?? []))
      setPackMeta({ status: p.status, hasDraft: p.hasDraft, locked: p.locked ?? false })
    }).catch(() => {})
  }, [selectedPackId])

  // Restore packs tab when returning with a saved pack selection
  useEffect(() => {
    const savedPack = sessionStorage.getItem('builderSelectedPack')
    if (savedPack && !searchParams.get('tab')) {
      setActiveTab('packs')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { key: locationKey } = useLocation()
  useEffect(() => {
    api.listReports().then((d) => setReportList(d.reports)).catch(() => {})
  }, [locationKey])

  // Load visual list on mount
  useEffect(() => {
    api.listVisuals()
      .then((d) => setVisualList(d.visuals))
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
    setLastDatasetAt(null)
    try {
      const def = await api.getDefinition(id)
      loadDefinition(def.definition as unknown as Parameters<typeof loadDefinition>[0])
      setDataset(def.dataset)
      setLastDatasetAt(def.lastDatasetAt ? parseDate(def.lastDatasetAt) : null)
    } catch {
      showToast('Failed to load report')
    }
  }

  const handleSelectVisual = async (id: string) => {
    setShowHistory(false)
    setSelectedVisualId(id)
    setArtifactType('visual')
    if (id === 'new') {
      newVisual()
      setSelectedVisualId('new')
      setVisualDataset(null)
      return
    }
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
    sessionStorage.setItem('builderSelectedPack', id)
  }

  const handleAddComment = async () => {
    if (!selectedPackId || !commentBody.trim() || !commentAuthor.trim()) return
    setSubmittingComment(true)
    try {
      localStorage.setItem('packCommentAuthor', commentAuthor)
      const c = await api.addComment(selectedPackId, commentAuthor, commentBody)
      setComments((prev) => [...prev, c])
      setCommentBody('')
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } finally {
      setSubmittingComment(false)
    }
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
      // For CSV reports, persist the dataset snapshot so the viewer can load it
      if (definition.cube === '__csv__' && dataset) {
        await api.saveDataset(definition.id, dataset)
      }
      markClean()
      const updated = await api.listReports()
      setReportList(updated.reports)
      showToast('Draft saved')
    } catch (e) {
      showToast(`Save failed: ${e instanceof Error ? e.message : 'unknown error'}`)
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
    const idToSave = selectedVisualId === 'new' ? visualDef.id : selectedVisualId
    if (!idToSave) return
    setVisualSaving(true)
    try {
      await api.saveVisualDraft(idToSave, visualDef.title, visualDef.visualType, visualDef)
      markVisualClean()
      const d = await api.listVisuals()
      setVisualList(d.visuals)
      showToast('Visual saved')
    } catch {
      showToast('Save failed')
    } finally {
      setVisualSaving(false)
    }
  }

  const handleVisualPublish = async () => {
    const idToSave = selectedVisualId === 'new' ? visualDef.id : selectedVisualId
    if (!idToSave) return
    setVisualSaving(true)
    try {
      await api.publishVisual(idToSave, visualDef.title, visualDef.visualType, visualDef)
      markVisualClean()
      const d = await api.listVisuals()
      setVisualList(d.visuals)
      showToast('Published')
    } catch {
      showToast('Publish failed')
    } finally {
      setVisualSaving(false)
    }
  }

  const handleVisualDelete = async () => {
    const idToSave = selectedVisualId === 'new' ? visualDef.id : selectedVisualId
    if (!idToSave) return
    if (!window.confirm('Delete this visual? This cannot be undone.')) return
    try {
      await api.deleteVisual(idToSave)
      const d = await api.listVisuals()
      setVisualList(d.visuals)
      resetVisual()
      setSelectedVisualId(null)
      showToast('Visual deleted')
    } catch {
      showToast('Delete failed')
    }
  }

  const handlePackPublish = async () => {
    if (!selectedPackId) return
    try {
      await api.publishPackSaved(selectedPackId)
      const p = await api.getPack(selectedPackId)
      setPackMeta({ status: p.status, hasDraft: p.hasDraft, locked: p.locked ?? false })
      setPackPages(migrateLayout(p.layout ?? []))
      setPackRefreshKey((k) => k + 1)
      showToast('Pack published')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Publish failed')
    }
  }

  const handlePackLock = async () => {
    if (!selectedPackId) return
    if (!window.confirm('Lock this pack permanently? This cannot be undone. The pack will become read-only and a frozen snapshot will be created.')) return
    try {
      await api.lockPack(selectedPackId)
      const p = await api.getPack(selectedPackId)
      setPackMeta({ status: p.status, hasDraft: p.hasDraft, locked: p.locked ?? true })
      setPackRefreshKey((k) => k + 1)
      showToast('Pack locked')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Lock failed')
    }
  }

  const handlePackRollForward = () => {
    if (!selectedPackId) return
    setRollForwardName(`Copy of pack`)
    setRollForwardOpen(true)
  }

  const handleRollForwardConfirm = async () => {
    if (!selectedPackId || !rollForwardName.trim()) return
    setRollForwardBusy(true)
    try {
      const result = await api.rollForwardPack(selectedPackId, rollForwardName.trim())
      setRollForwardOpen(false)
      handleSelectPack(result.id)
      if (result.missingCount > 0) {
        showToast(`Roll forward created — ${result.missingCount} artifact(s) need re-linking`)
      } else {
        showToast('Roll forward created')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Roll forward failed')
    } finally {
      setRollForwardBusy(false)
    }
  }

  const handleDeleteImage = async (id: string) => {
    if (!window.confirm('Delete this image?')) return
    try {
      await api.deleteImage(id)
      setSelectedImage(null)
      // Trigger refresh of image sidebar
      setActiveTab('images')
      showToast('Image deleted')
    } catch {
      showToast('Delete failed')
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
        imageSelected={!!selectedImage}
        onDeleteImage={() => selectedImage && handleDeleteImage(selectedImage.id)}
        selectedPackId={selectedPackId}
        packPublished={packMeta?.status === 'published' && !packMeta?.hasDraft}
        packLocked={packMeta?.locked ?? false}
        onOpenComposer={() => navigate(`/builder/packs/${selectedPackId}`)}
        onOpenViewer={() => navigate(`/viewer/${selectedPackId}`)}
        onPackPublish={handlePackPublish}
        onPackLock={handlePackLock}
        onPackRollForward={handlePackRollForward}
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
          onSelectImage={(id, url, name, meta) => { setSelectedImage({ id, url, name, ...meta }) }}
        />}
        <CanvasPanel
          focusMode={focusMode}
          activeTab={activeTab}
          selectedPackId={selectedPackId}
          packRefreshKey={packRefreshKey}
          onOpenComposer={() => navigate(`/builder/packs/${selectedPackId}`)}
          onOpenViewer={() => navigate(`/viewer/${selectedPackId}`)}
          fromPack={fromPack}
          onBackToPack={() => handleSelectPack(fromPack!.id)}
          onSelectArtifact={(id, type, packName) => handleSelectArtifactFromPack(id, type, { id: selectedPackId!, name: packName ?? 'Pack' })}
          selectedImageUrl={selectedImage?.url ?? null}
          onDataRefreshed={handleSaveDraft}
        />
        {!focusMode && !showHistory && activeTab === 'reports' && <PropertiesPanel />}
        {!focusMode && activeTab === 'visuals' && (
          <VisualPropertiesPanel visualId={selectedVisualId} />
        )}
        {!focusMode && activeTab === 'packs' && selectedPackId && (
          <aside className="w-72 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-800 shrink-0 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-gray-500 shrink-0" />
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Comments</span>
              <span className="ml-auto text-xs text-gray-600">{comments.length}</span>
            </div>

            {/* Thread */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {comments.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-6">No comments yet</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="group bg-gray-800 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-blue-400 truncate">{c.author}</span>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {(parseDate(c.createdAt) ?? new Date()).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap break-words">{c.body}</p>
                </div>
              ))}
              <div ref={commentsEndRef} />
            </div>

            {/* Compose */}
            <div className="shrink-0 border-t border-gray-800 p-3 space-y-2">
              <input
                type="text"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="Your name…"
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment() }}
                  placeholder="Add a comment… (⌘↵ to send)"
                  rows={3}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!commentBody.trim() || !commentAuthor.trim() || submittingComment}
                  className="self-end p-2 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Page Notes */}
            {packPages.some((pg) => pg.pageNote) && (() => {
              const notePages = packPages.map((pg, i) => ({ pg, pageNum: i + 1 })).filter(({ pg }) => pg.pageNote)
              const openCount = notePages.filter(({ pg }) => pg.pageNotePriority && !pg.pageNoteResolved).length
              return (
                <div className="shrink-0 border-t border-gray-800">
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Page Notes</span>
                    {openCount > 0
                      ? <span className="flex items-center gap-1 text-xs font-medium text-yellow-500"><Flag className="h-3 w-3 fill-current" />{openCount} open</span>
                      : <span className="text-xs font-medium text-emerald-400">✓ All clear</span>
                    }
                  </div>
                  <div className="divide-y divide-gray-800">
                    {notePages.map(({ pg, pageNum }) => (
                      <button
                        key={pg.id}
                        className="w-full flex items-start gap-3 px-4 py-2 text-left hover:bg-gray-800/60 transition-colors"
                        onClick={() => packMeta?.locked
                          ? navigate(`/viewer/${selectedPackId}`)
                          : navigate(`/builder/packs/${selectedPackId}#page-${pg.id}`)}
                      >
                        <div className="shrink-0 mt-0.5">
                          {pg.pageNotePriority && !pg.pageNoteResolved
                            ? <Flag className="h-3.5 w-3.5 text-red-400 fill-current" />
                            : pg.pageNoteResolved
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                              : <CheckCircle2 className="h-3.5 w-3.5 text-gray-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-gray-300 block">Page {pageNum}</span>
                          <span className="text-[10px] text-gray-500 truncate block">{pg.pageNote}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

          </aside>
        )}

        {!focusMode && activeTab === 'images' && selectedImage && (
          <aside className="w-72 shrink-0 bg-gray-900 border-l border-gray-800 overflow-y-auto p-4 space-y-4 text-xs">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Image Info</p>
            <div className="space-y-2">
              <div>
                <p className="text-gray-600 mb-0.5">Name</p>
                <p className="text-gray-200 break-all">{selectedImage.name}</p>
              </div>
              {(selectedImage.width || selectedImage.height) && (
                <div>
                  <p className="text-gray-600 mb-0.5">Dimensions</p>
                  <p className="text-gray-200">{selectedImage.width} × {selectedImage.height} px</p>
                </div>
              )}
              {selectedImage.sizeBytes && (
                <div>
                  <p className="text-gray-600 mb-0.5">File size</p>
                  <p className="text-gray-200">{selectedImage.sizeBytes < 1024 * 1024 ? `${Math.round(selectedImage.sizeBytes / 1024)} KB` : `${(selectedImage.sizeBytes / 1024 / 1024).toFixed(1)} MB`}</p>
                </div>
              )}
              {selectedImage.mimeType && (
                <div>
                  <p className="text-gray-600 mb-0.5">Type</p>
                  <p className="text-gray-200">{selectedImage.mimeType}</p>
                </div>
              )}
              {selectedImage.uploadedAt && (
                <div>
                  <p className="text-gray-600 mb-0.5">Uploaded</p>
                  <p className="text-gray-200">{(parseDate(selectedImage.uploadedAt) ?? new Date()).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              )}
              <div>
                <p className="text-gray-600 mb-0.5">URL</p>
                <p className="text-gray-500 break-all font-mono text-[10px]">{selectedImage.url}</p>
              </div>
            </div>
          </aside>
        )}
        {!focusMode && showHistory && activeTab === 'reports' && (
          <HistoryPanel
            onClose={() => setShowHistory(false)}
            onRestored={() => showToast('Version restored as draft')}
          />
        )}
      </div>

      {/* Roll Forward dialog */}
      {rollForwardOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => !rollForwardBusy && setRollForwardOpen(false)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Roll Forward</h2>
              <p className="text-xs text-gray-500 mt-1">Creates a new draft pack copied from this locked pack. Page notes are cleared. Update period selectors on each report/visual after creation.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-400">New pack name</label>
              <input
                autoFocus
                type="text"
                value={rollForwardName}
                onChange={(e) => setRollForwardName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRollForwardConfirm() }}
                placeholder="e.g. Monthly Pack — May 2026"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRollForwardOpen(false)} disabled={rollForwardBusy} className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-30 transition-colors">Cancel</button>
              <button
                onClick={handleRollForwardConfirm}
                disabled={!rollForwardName.trim() || rollForwardBusy}
                className="px-3 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {rollForwardBusy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

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
