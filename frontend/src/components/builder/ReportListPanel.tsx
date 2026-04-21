import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Plus, FileText, Layers, Pencil, Trash2, ShieldAlert, ChevronRight, ChevronDown, BarChart3, Image as ImageIcon, Upload, Search, X, Folder, MoreVertical } from 'lucide-react'
import { useReportStore } from '../../store/useReportStore'
import { useVisualStore } from '../../store/useVisualStore'
import { api, PackListItem, ImageItem, FolderListItem } from '../../lib/api'
import PackEditor from './PackEditor'
import ArtifactTab from './ArtifactTab'

interface ReportListPanelProps {
  tab: 'reports' | 'visuals' | 'packs' | 'images'
  setTab: (tab: 'reports' | 'visuals' | 'packs' | 'images') => void
  onSelect: (id: string) => void
  onNew: () => void
  onSelectVisual?: (id: string) => void
  onOpenVisual: (id: string) => void
  onSelectPack?: (id: string) => void
  onSelectImage?: (id: string, url: string, name: string, meta?: { sizeBytes?: number; mimeType?: string; uploadedAt?: string; width?: number; height?: number; description?: string; altText?: string; tags?: string; uploadedBy?: string }, refreshImages?: () => void) => void
}

export default function ReportListPanel({ tab, setTab, onSelect, onNew, onOpenVisual, onSelectPack, onSelectImage }: ReportListPanelProps) {
  const { reportList, definition } = useReportStore()
  const { visualList } = useVisualStore()
  const navigate = useNavigate()
  const [packs, setPacks] = useState<PackListItem[]>([])
  const [editingPack, setEditingPack] = useState<PackListItem | null | 'new'>(null)
  const [images, setImages] = useState<ImageItem[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [renamingImageId, setRenamingImageId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [tabSearch, setTabSearch] = useState('')
  const [folders, setFolders] = useState<FolderListItem[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [editingPackId, setEditingPackId] = useState<string | null>(null)
  const [editingPackName, setEditingPackName] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; type: string; x: number; y: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const normalize = (s: string) => s.trim().toLowerCase()
  const matchesGlobal = (text: string) => normalize(text).includes(normalize(globalSearch))
  const matchesTab = (text: string) => normalize(text).includes(normalize(tabSearch))

  const filteredReports = useMemo(() => tabSearch ? reportList.filter(r => matchesTab(r.title || 'Untitled')) : reportList, [tabSearch, reportList])
  const filteredVisuals = useMemo(() => tabSearch ? visualList.filter(v => matchesTab(v.title || 'Untitled')) : visualList, [tabSearch, visualList])
  const filteredPacks = useMemo(() => tabSearch ? packs.filter(p => matchesTab(p.name)) : packs, [tabSearch, packs])
  const filteredImages = useMemo(() => tabSearch ? images.filter(i => matchesTab(i.name)) : images, [tabSearch, images])

  const folderTree = useMemo(() => {
    const map = new Map<string | null, FolderListItem[]>()
    folders.forEach(f => {
      const parentId = f.parentId
      if (!map.has(parentId)) map.set(parentId, [])
      map.get(parentId)!.push(f)
    })
    return map
  }, [folders])

  const getFolderDepth = (folderId: string | null): number => {
    let depth = 0
    let current = folders.find(f => f.id === folderId)
    while (current?.parentId) {
      depth++
      current = folders.find(f => f.id === current?.parentId)
    }
    return depth + 1
  }

  const MAX_FOLDER_DEPTH = 3

  const renderFolderWithChildren = (
    folder: FolderListItem,
    childFolders: FolderListItem[],
    artifacts: any[],
    renderItem: (item: any) => React.ReactNode,
    depth: number
  ) => {
    const indent = depth * 4 + 2
    return (
      <div key={folder.id}>
        <div className="flex items-center gap-1 py-1.5 group hover:bg-gray-800 transition-colors" style={{ paddingLeft: `${indent}px`, paddingRight: '8px' }}>
          <button onClick={() => toggleFolder(folder.id)} className="text-gray-500 hover:text-gray-300 shrink-0">
            {expandedFolders.has(folder.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <Folder className="h-3.5 w-3.5 shrink-0 text-gray-500 cursor-pointer" onClick={() => toggleFolder(folder.id)} />
          {editingFolderId === folder.id ? (
            <input autoFocus value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingFolderId(null) }}
              onBlur={() => handleRenameFolder(folder.id)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500" />
          ) : (
            <span onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="flex-1 text-xs text-gray-300 truncate cursor-pointer hover:text-blue-400">{folder.name}</span>
          )}
          <span className="shrink-0 flex items-center gap-0.5">
            {depth < MAX_FOLDER_DEPTH && (
              <button onClick={() => { const name = window.prompt('Subfolder name:'); if (name?.trim()) { const at = tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image'; api.createFolder(at, name.trim(), folder.id).then(() => loadFolders(at)) } }} className="p-0.5 text-gray-600 hover:text-blue-400" title="Add subfolder"><Plus className="h-3 w-3" /></button>
            )}
            <button onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="p-0.5 text-gray-600 hover:text-blue-400" title="Rename"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => handleDeleteFolder(folder.id)} className="p-0.5 text-gray-600 hover:text-red-400" title="Delete"><Trash2 className="h-3 w-3" /></button>
            <button onClick={(e) => { e.stopPropagation(); setContextMenu({ id: folder.id, type: 'folder', x: e.clientX, y: e.clientY }) }} className="p-0.5 text-gray-600 hover:text-gray-300"><MoreVertical className="h-3 w-3" /></button>
          </span>
        </div>
        {expandedFolders.has(folder.id) && (
          <>
            {childFolders.map(f => {
              const subChildFolders = (folderTree.get(f.id) || []).filter(sf => sf.id !== folder.id)
              const subArtifacts = artifacts.filter(a => a.folderId === f.id)
              return renderFolderWithChildren(f, subChildFolders, subArtifacts, renderItem, depth + 1)
            })}
            {artifacts.filter(a => a.folderId === folder.id).map(a => (
              <div key={a.id} style={{ paddingLeft: `${indent + 24}px` }}>{renderItem(a)}</div>
            ))}
          </>
        )}
      </div>
    )
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      next.has(folderId) ? next.delete(folderId) : next.add(folderId)
      return next
    })
  }

  const loadPacks = () => {
    api.listPacks().then((d) => setPacks(d.packs)).catch(() => {})
  }

  const loadVisuals = () => {
    api.listVisuals().then((d) => { useVisualStore.getState().setVisualList(d.visuals) }).catch(() => {})
  }

  const loadImages = () => {
    api.listImages().then((d) => setImages(d.images)).catch(() => {})
  }

  const loadFolders = (artifactType: string) => {
    api.listFolders(artifactType).then((d) => setFolders(d.folders)).catch(() => {})
  }

  const handleCreateFolder = async () => {
    const typeMap: Record<string, string> = { reports: 'report', visuals: 'visual', packs: 'pack', images: 'image' }
    const artifactType = typeMap[tab] || 'report'
    const name = window.prompt('Folder name:')
    if (!name?.trim()) return
    try {
      await api.createFolder(artifactType, name.trim())
      loadFolders(artifactType)
    } catch {}
  }

  const handleRenameFolder = async (folderId: string) => {
    const trimmed = editingFolderName.trim()
    const folder = folders.find(f => f.id === folderId)
    if (!trimmed || !folder || trimmed === folder.name) {
      setEditingFolderId(null)
      return
    }
    try {
      await api.renameFolder(folderId, trimmed)
      loadFolders(tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image')
    } catch {}
    setEditingFolderId(null)
  }

  const handleRenamePack = async (packId: string) => {
    const trimmed = editingPackName.trim()
    setEditingPackId(null)
    if (!trimmed) return
    try {
      await api.renamePack(packId, trimmed)
      setPacks((prev) => prev.map((p) => p.id === packId ? { ...p, name: trimmed } : p))
    } catch {}
  }

  const handleDeleteFolder = async (folderId: string) => {
    if (!window.confirm('Delete this folder? Artifacts will be moved to Uncategorized.')) return
    try {
      await api.deleteFolder(folderId)
      loadFolders(tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image')
    } catch {}
  }

  const { key: locationKey } = useLocation()
  useEffect(() => { loadPacks(); loadVisuals(); loadImages(); loadFolders('report') }, [locationKey])
  useEffect(() => {
    const typeMap: Record<string, string> = { reports: 'report', visuals: 'visual', packs: 'pack', images: 'image' }
    loadFolders(typeMap[tab] || 'report')
    setTabSearch('')
  }, [tab])
  useEffect(() => {
    if (contextMenu) {
      const typeMap: Record<string, string> = { report: 'report', note: 'note', visual: 'visual', pack: 'pack', image: 'image', folder: 'folder' }
      const artifactType = contextMenu.type === 'folder' 
        ? (tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image')
        : (typeMap[contextMenu.type] || contextMenu.type)
      if (artifactType) loadFolders(artifactType)
    }
  }, [contextMenu, tab])
  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.context-menu')) return
      setContextMenu(null)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])
  useEffect(() => { if (tab === 'packs') loadPacks() }, [tab])
  useEffect(() => { if (tab === 'visuals') loadVisuals() }, [tab])
  useEffect(() => { if (tab === 'images') loadImages() }, [tab])
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      await api.uploadImage(file, file.name.replace(/\.[^.]+$/, ''))
      loadImages()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRenameImage = async (id: string) => {
    const trimmed = renameValue.trim()
    if (!trimmed) return
    try {
      await api.renameImage(id, trimmed)
      setRenamingImageId(null)
      loadImages()
    } catch {}
  }

  const handlePackSaved = (packId: string) => {
    setEditingPack(null)
    loadPacks()
    // After creating a new pack, go straight to the composer
    if (editingPack === 'new') navigate(`/builder/packs/${packId}`)
  }

  const handleNewVisual = () => { onOpenVisual('new') }

  return (
    <>
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 h-full">

        {/* Global search */}
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search all…"
              className="w-full bg-gray-800 border border-gray-700 rounded pl-8 pr-7 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            {globalSearch && (
              <button onClick={() => setGlobalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setTab('reports')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'reports' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Reports"
          >
            <FileText className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTab('visuals')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'visuals' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Visuals"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTab('images')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'images' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Image Library"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTab('packs')}
            className={`flex-1 flex items-center justify-center py-2.5 transition-colors
              ${tab === 'packs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            title="Packs"
          >
            <Layers className="h-4 w-4" />
          </button>
        </div>

        {/* Global search results */}
        {globalSearch && (
          <nav className="flex-1 overflow-y-auto py-1">
            {(() => {
              const rr = reportList.filter(r => matchesGlobal(r.title || 'Untitled'))
              const vr = visualList.filter(v => matchesGlobal(v.title || 'Untitled'))
              const ir = images.filter(i => matchesGlobal(i.name))
              const pr = packs.filter(p => matchesGlobal(p.name))
              const total = rr.length + vr.length + ir.length + pr.length
              if (total === 0) return <p className="px-3 py-4 text-xs text-gray-600 text-center">No results for "{globalSearch}"</p>
              return (
                <div>
                  {rr.length > 0 && <div>
                    <p className="px-3 pt-2 pb-1 text-xs text-gray-600 uppercase tracking-wide">Reports</p>
                    {rr.map(r => <div key={r.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer" onClick={() => { setTab('reports'); onSelect(r.id); setGlobalSearch('') }}>
                      <FileText className="h-3.5 w-3.5 shrink-0 text-gray-600" />
                      <span className="text-xs text-gray-300 truncate" title={r.title || 'Untitled'}>{r.title || 'Untitled'}</span>
                    </div>)}
                  </div>}
                  {vr.length > 0 && <div>
                    <p className="px-3 pt-2 pb-1 text-xs text-gray-600 uppercase tracking-wide">Visuals</p>
                    {vr.map(v => <div key={v.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer" onClick={() => { setTab('visuals'); onOpenVisual(v.id); setGlobalSearch('') }}>
                    <BarChart3 className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <span className="text-xs text-gray-300 truncate" title={v.title || 'Untitled'}>{v.title || 'Untitled'}</span>
                    </div>)}
                  </div>}
                  {pr.length > 0 && <div>
                    <p className="px-3 pt-2 pb-1 text-xs text-gray-600 uppercase tracking-wide">Packs</p>
                    {pr.map(p => <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer" onClick={() => { onSelectPack ? onSelectPack(p.id) : navigate(`/builder/packs/${p.id}`); setGlobalSearch('') }}>
                      <Layers className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                      <span className="text-xs text-gray-300 truncate">{p.name}</span>
                    </div>)}
                  </div>}
                  {ir.length > 0 && <div>
                    <p className="px-3 pt-2 pb-1 text-xs text-gray-600 uppercase tracking-wide">Images</p>
                    {ir.map(i => <div key={i.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 cursor-pointer" onClick={() => setTab('images')}>
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                      <span className="text-xs text-gray-300 truncate" title={i.name}>{i.name}</span>
                    </div>)}
                  </div>}
                </div>
              )
            })()}
          </nav>
        )}

        {/* Reports tab */}
        {!globalSearch && tab === 'reports' && (
          <ArtifactTab
            items={filteredReports}
            tabSearch={tabSearch}
            setTabSearch={setTabSearch}
            folderTree={folderTree}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            editingFolderId={editingFolderId}
            editingFolderName={editingFolderName}
            setEditingFolderId={setEditingFolderId}
            setEditingFolderName={setEditingFolderName}
            handleCreateFolder={handleCreateFolder}
            handleRenameFolder={handleRenameFolder}
            handleDeleteFolder={handleDeleteFolder}
            setContextMenu={setContextMenu}
            newButtonLabel="New Report"
            newButtonOnClick={onNew}
            searchPlaceholder="Filter reports…"
            emptyMessage="No reports yet"
            selectedId={definition.id}
            renderItem={(r, isSelected) => (
              <div key={r.id} className={`flex items-center gap-2 py-2 group transition-colors cursor-pointer ${isSelected ? 'bg-gray-800' : 'hover:bg-gray-800'}`} onClick={() => onSelect(r.id)} style={{ paddingLeft: '12px', paddingRight: '8px' }}>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${isSelected ? 'text-gray-100' : 'text-gray-400 group-hover:text-gray-200'}`} title={r.title || 'Untitled'}>{r.title || 'Untitled'}</p>
                </div>
                <span className="shrink-0 flex items-center gap-1">
                  {renderStatusDot(r.status, r.hasDraft)}
                  <button onClick={(e) => { e.stopPropagation(); loadFolders('report'); setContextMenu({ id: r.id, type: 'report', x: e.clientX, y: e.clientY }) }} className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-3 w-3" /></button>
                </span>
              </div>
            )}
          />
        )}

        {/* Visuals tab */}
        {!globalSearch && tab === 'visuals' && (
          <ArtifactTab
            items={filteredVisuals}
            tabSearch={tabSearch}
            setTabSearch={setTabSearch}
            folderTree={folderTree}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            editingFolderId={editingFolderId}
            editingFolderName={editingFolderName}
            setEditingFolderId={setEditingFolderId}
            setEditingFolderName={setEditingFolderName}
            handleCreateFolder={handleCreateFolder}
            handleRenameFolder={handleRenameFolder}
            handleDeleteFolder={handleDeleteFolder}
            setContextMenu={setContextMenu}
            newButtonLabel="New Visual"
            newButtonOnClick={handleNewVisual}
            searchPlaceholder="Filter visuals…"
            emptyMessage="No visuals yet"
            renderItem={(v) => (
              <div key={v.id} className="flex items-center gap-2 py-2 group hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => onOpenVisual(v.id)} style={{ paddingLeft: '12px', paddingRight: '8px' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 group-hover:text-gray-200 truncate" title={v.title || 'Untitled Visual'}>{v.title || 'Untitled Visual'}</p>
                  <p className="text-xs text-gray-600 capitalize">{v.visualType}</p>
                </div>
                <span className="shrink-0 flex items-center gap-1">
                  {renderStatusDot(v.status, v.hasDraft)}
                  <button onClick={(e) => { e.stopPropagation(); loadFolders('visual'); setContextMenu({ id: v.id, type: 'visual', x: e.clientX, y: e.clientY }) }} className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-3 w-3" /></button>
                </span>
              </div>
            )}
          />
        )}

        {/* Packs tab */}
        {!globalSearch && tab === 'packs' && (
          <>
            <div className="px-3 py-2 border-b border-gray-800 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingPack('new')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                             bg-blue-400 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Pack
                </button>
                <button onClick={handleCreateFolder} className="px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 transition-colors" title="New Folder">
                  <Folder className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
                <input type="text" value={tabSearch} onChange={(e) => setTabSearch(e.target.value)}
                  placeholder="Filter packs…"
                  className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-6 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                {tabSearch && <button onClick={() => setTabSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-2.5 w-2.5" /></button>}
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-1">
              {(() => {
                const uncategorized = filteredPacks.filter(p => !p.folderId)
                const foldered = filteredPacks.filter(p => p.folderId)
                const byFolder: Record<string, typeof filteredPacks> = {}
                foldered.forEach(p => {
                  if (p.folderId) {
                    if (!byFolder[p.folderId]) byFolder[p.folderId] = []
                    byFolder[p.folderId].push(p)
                  }
                })
                const renderPack = (p: PackListItem) => {
                  return (
                    <div key={p.id}>
                      <div className="flex items-center gap-1.5 px-2 py-2 group hover:bg-gray-800 transition-colors cursor-pointer"
                        onClick={() => { if (editingPackId !== p.id) { onSelectPack ? onSelectPack(p.id) : navigate(`/builder/packs/${p.id}`) } }}>
                        <Layers className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                        {editingPackId === p.id ? (
                          <input
                            autoFocus
                            value={editingPackName}
                            onChange={(e) => setEditingPackName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePack(p.id); if (e.key === 'Escape') setEditingPackId(null) }}
                            onBlur={() => handleRenamePack(p.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span
                            className="flex-1 text-xs text-gray-200 truncate font-medium"
                            onDoubleClick={(e) => { e.stopPropagation(); setEditingPackId(p.id); setEditingPackName(p.name) }}
                          >{p.name}</span>
                        )}
                        <span className="shrink-0 flex items-center gap-1">
                          {p.status === 'draft' && <span className="text-xs text-yellow-500">draft</span>}

                          {(p.layout ?? []).some((pg: { pageNotePriority?: boolean; pageNoteResolved?: boolean }) => pg.pageNotePriority && !pg.pageNoteResolved) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Has open priority notes" />
                          )}
                          <button onClick={(e) => { e.stopPropagation(); loadFolders('pack'); setContextMenu({ id: p.id, type: 'pack', x: e.clientX, y: e.clientY }) }} className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"><MoreVertical className="h-3 w-3" /></button>
                        </span>
                      </div>
                    </div>
                  )
                }
                const renderFolder = (folder: FolderListItem) => (
                  <div key={folder.id}>
                    <div className="flex items-center gap-1 px-2 py-1.5 group hover:bg-gray-800 transition-colors">
                      <button onClick={() => toggleFolder(folder.id)} className="text-gray-500 hover:text-gray-300 shrink-0">
                        {expandedFolders.has(folder.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <Folder className="h-3.5 w-3.5 shrink-0 text-gray-500 cursor-pointer" onClick={() => toggleFolder(folder.id)} />
                      {editingFolderId === folder.id ? (
                        <input autoFocus value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingFolderId(null) }}
                          onBlur={() => handleRenameFolder(folder.id)}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500" />
                      ) : (
                        <span onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="flex-1 text-xs text-gray-300 truncate cursor-pointer hover:text-blue-400">{folder.name}</span>
                      )}
                      <span className="shrink-0 flex items-center gap-0.5">
                        <button onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="p-0.5 text-gray-600 hover:text-blue-400" title="Rename"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteFolder(folder.id)} className="p-0.5 text-gray-600 hover:text-red-400" title="Delete"><Trash2 className="h-3 w-3" /></button>
                      </span>
                    </div>
                    {expandedFolders.has(folder.id) && byFolder[folder.id]?.map(item => (
                      <div key={item.id} className="pl-6">{renderPack(item)}</div>
                    ))}
                  </div>
                )
                if (filteredPacks.length === 0) return <p className="px-3 py-4 text-xs text-gray-600 text-center">{tabSearch ? 'No results' : 'No packs yet'}</p>
                return (
                  <>
                    {uncategorized.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-3 py-1">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Uncategorized</span>
                          <button onClick={handleCreateFolder} className="p-1 text-gray-500 hover:text-gray-300"><Plus className="h-4 w-4" /></button>
                        </div>
                        {uncategorized.map(renderPack)}
                      </div>
                    )}
                    {folders.map(renderFolder)}
                    {uncategorized.length === 0 && folders.length === 0 && (
                      <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">No folders yet</span>
                        <button onClick={handleCreateFolder} className="text-xs text-blue-400 hover:text-blue-300">Create Folder</button>
                      </div>
                    )}
                  </>
                )
              })()}
            </nav>
          </>
        )}
        {/* Images tab */}
        {!globalSearch && tab === 'images' && (
          <>
            <div className="px-3 py-2 border-b border-gray-800 space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleUploadImage}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md
                             bg-blue-400 hover:bg-blue-700 text-white text-xs font-medium
                             disabled:opacity-50 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingImage ? 'Uploading…' : 'Upload Image'}
                </button>
                <button onClick={handleCreateFolder} className="px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 transition-colors" title="New Folder">
                  <Folder className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
                <input type="text" value={tabSearch} onChange={(e) => setTabSearch(e.target.value)}
                  placeholder="Filter images…"
                  className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-6 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
                {tabSearch && <button onClick={() => setTabSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-2.5 w-2.5" /></button>}
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-1">
              {(() => {
                const uncategorized = filteredImages.filter(img => !img.folderId)
                const foldered = filteredImages.filter(img => img.folderId)
                const byFolder: Record<string, typeof filteredImages> = {}
                foldered.forEach(img => {
                  if (img.folderId) {
                    if (!byFolder[img.folderId]) byFolder[img.folderId] = []
                    byFolder[img.folderId].push(img)
                  }
                })
                const renderImage = (img: ImageItem) => (
                  <div key={img.id} className="group px-2 py-2 hover:bg-gray-800 transition-colors cursor-pointer" onClick={() => onSelectImage?.(img.id, `http://${window.location.hostname}:8080${img.url}`, img.name, { sizeBytes: img.sizeBytes, mimeType: img.mimeType, uploadedAt: img.uploadedAt, width: img.width, height: img.height, description: img.description, altText: img.altText, tags: img.tags, uploadedBy: img.uploadedBy })}>
                    {renamingImageId === img.id ? (
                      <div className="flex items-center gap-1">
                        <input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameImage(img.id); if (e.key === 'Escape') setRenamingImageId(null) }}
                          className="flex-1 min-w-0 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500" />
                        <button onClick={() => handleRenameImage(img.id)} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">✓</button>
                        <button onClick={() => setRenamingImageId(null)} className="text-xs text-gray-500 hover:text-gray-300 shrink-0">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <img src={`http://${window.location.hostname}:8080${img.url}`} alt={img.name} className="w-8 h-8 object-cover rounded shrink-0 bg-gray-700" />
                        <span className="flex-1 min-w-0 text-xs text-gray-300 truncate" title={img.name}>{img.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); setRenamingImageId(img.id); setRenameValue(img.name) }} className="p-0.5 text-gray-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Rename"><Pencil className="h-3 w-3" /></button>
                        <button onClick={(e) => { e.stopPropagation(); loadFolders('image'); setContextMenu({ id: img.id, type: 'image', x: e.clientX, y: e.clientY }) }} className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"><MoreVertical className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                )
                const renderFolder = (folder: FolderListItem) => (
                  <div key={folder.id}>
                    <div className="flex items-center gap-1 px-2 py-1.5 group hover:bg-gray-800 transition-colors">
                      <button onClick={() => toggleFolder(folder.id)} className="text-gray-500 hover:text-gray-300 shrink-0">
                        {expandedFolders.has(folder.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                      <Folder className="h-3.5 w-3.5 shrink-0 text-gray-500 cursor-pointer" onClick={() => toggleFolder(folder.id)} />
                      {editingFolderId === folder.id ? (
                        <input autoFocus value={editingFolderName} onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(folder.id); if (e.key === 'Escape') setEditingFolderId(null) }}
                          onBlur={() => handleRenameFolder(folder.id)}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-xs text-gray-100 focus:outline-none focus:border-blue-500" />
                      ) : (
                        <span onClick={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="flex-1 text-xs text-gray-300 truncate cursor-pointer hover:text-blue-400">{folder.name}</span>
                      )}
                      <span className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onMouseDown={() => { setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="p-0.5 text-gray-600 hover:text-gray-300" title="Rename"><Pencil className="h-3 w-3" /></button>
                        <button onClick={() => handleDeleteFolder(folder.id)} className="p-0.5 text-gray-600 hover:text-red-400" title="Delete"><Trash2 className="h-3 w-3" /></button>
                      </span>
                    </div>
                    {expandedFolders.has(folder.id) && byFolder[folder.id]?.map(item => (
                      <div key={item.id} className="pl-6">{renderImage(item)}</div>
                    ))}
                  </div>
                )
                if (filteredImages.length === 0) return <p className="px-3 py-4 text-xs text-gray-600 text-center">{tabSearch ? 'No results' : 'No images uploaded yet'}</p>
                return (
                  <>
                    {uncategorized.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between px-3 py-1">
                          <span className="text-xs text-gray-500 uppercase tracking-wide">Uncategorized</span>
                          <button onClick={handleCreateFolder} className="p-1 text-gray-500 hover:text-gray-300"><Plus className="h-4 w-4" /></button>
                        </div>
                        {uncategorized.map(renderImage)}
                      </div>
                    )}
                    {folders.map(renderFolder)}
                    {uncategorized.length === 0 && folders.length === 0 && (
                      <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">No folders yet</span>
                        <button onClick={handleCreateFolder} className="text-xs text-blue-400 hover:text-blue-300">Create Folder</button>
                      </div>
                    )}
                  </>
                )
              })()}
            </nav>
          </>
        )}

      <div className="px-3 py-3 border-t border-gray-800 shrink-0">
        <Link to="/admin"
          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-medium
                     text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          Admin Portal
        </Link>
      </div>

      {contextMenu && (
        <div className="context-menu fixed z-50 bg-gray-800 border border-gray-700 rounded shadow-lg py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="px-3 py-1.5">
            <input
              autoFocus
              id="newFolderInput"
              placeholder="Folder name..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              onKeyDown={async (e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget
                  const name = input.value.trim()
                  if (name) {
                    const at = contextMenu.type === 'folder' ? (tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image') : contextMenu.type
                    await api.createFolder(at, name)
                    loadFolders(at)
                  }
                  setContextMenu(null)
                }
                if (e.key === 'Escape') setContextMenu(null)
              }}
              onBlur={async (e) => {
                const name = e.currentTarget.value.trim()
                if (name) {
                  const at = contextMenu.type === 'folder' ? (tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image') : contextMenu.type
                  await api.createFolder(at, name)
                  loadFolders(at)
                }
                setContextMenu(null)
              }}
            />
          </div>
          {contextMenu.type !== 'folder' && folders.length > 0 && (
            <>
              <div className="border-t border-gray-700 my-1" />
              <p className="px-3 py-1 text-xs text-gray-500 uppercase">Move to Folder ({folders.length})</p>
              {folders.map(f => (
                <button key={f.id} onMouseDown={(e) => { 
                  e.preventDefault()
                  e.stopPropagation()
                  api.moveToFolder(contextMenu.type, contextMenu.id, f.id).then(() => { loadFolders(contextMenu.type); if (tab === 'reports') api.listReports().then(d => d.reports).then(r => useReportStore.getState().setReportList(r)); else if (tab === 'visuals') api.listVisuals().then(d => useVisualStore.getState().setVisualList(d.visuals)); else if (tab === 'packs') api.listPacks().then(d => setPacks(d.packs)); else if (tab === 'images') api.listImages().then(d => setImages(d.images)) }); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
                  <Folder className="h-3.5 w-3.5" />{f.name}
                </button>
              ))}
              <button onMouseDown={() => { api.moveToFolder(contextMenu.type, contextMenu.id, null).then(() => { loadFolders(contextMenu.type); if (tab === 'reports') api.listReports().then(d => d.reports).then(r => useReportStore.getState().setReportList(r)); else if (tab === 'visuals') api.listVisuals().then(d => useVisualStore.getState().setVisualList(d.visuals)); else if (tab === 'packs') api.listPacks().then(d => setPacks(d.packs)); else if (tab === 'images') api.listImages().then(d => setImages(d.images)) }); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
                Remove from folder
              </button>
            </>
          )}
          {contextMenu.type === 'folder' && (
            <>
              <div className="border-t border-gray-700 my-1" />
              <p className="px-3 py-1 text-xs text-gray-500 uppercase">Move to</p>
              <button onClick={() => { api.moveFolder(contextMenu.id, null).then(() => { loadFolders(tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image') }); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
                Root (No parent)
              </button>
              {folders.filter(f => f.id !== contextMenu.id && getFolderDepth(f.parentId) < 2).map(f => (
                <button key={f.id} onClick={() => { api.moveFolder(contextMenu.id, f.id).then(() => { loadFolders(tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image') }); setContextMenu(null) }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700">
                  <Folder className="h-3.5 w-3.5" />{f.name}
                </button>
              ))}
            </>
          )}
          {contextMenu.type !== 'image' && (
            <>
              <div className="border-t border-gray-700 my-1" />
              <button onClick={() => {
                if (contextMenu.type === 'folder') {
                  if (window.confirm('Delete this folder and all its contents?')) {
                    const at = tab === 'reports' ? 'report' : tab === 'visuals' ? 'visual' : tab === 'packs' ? 'pack' : 'image'
                    api.deleteFolder(contextMenu.id).then(() => loadFolders(at))
                  }
                } else if (contextMenu.type === 'pack') { if (window.confirm('Delete this pack?')) { api.deletePack(contextMenu.id).then(() => api.listPacks().then(d => setPacks(d.packs))) } }
                else if (contextMenu.type === 'visual') { if (window.confirm('Delete this visual?')) { api.deleteVisual(contextMenu.id).then(() => api.listVisuals().then(d => useVisualStore.getState().setVisualList(d.visuals))) } }
                setContextMenu(null)
              }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-gray-700">
                <Trash2 className="h-3.5 w-3.5" />Delete
              </button>
            </>
          )}
        </div>
      )}

      </aside>

      {editingPack !== null && (
        <PackEditor
          pack={editingPack === 'new' ? null : editingPack}
          onSaved={handlePackSaved}
          onClose={() => setEditingPack(null)}
        />
      )}
    </>
  )
}

// ─── UNIFIED ARTIFACT STATUS HELPER ───────────────────────────────────────────
const renderStatusDot = (status: 'draft' | 'published', hasDraft?: boolean) => {
  const color = hasDraft ? 'yellow' : status === 'published' ? 'green' : 'gray'
  const classes: Record<string, string> = {
    gray:   'bg-gray-400',
    green:  'bg-emerald-500',
    yellow: 'bg-yellow-400',
  }
  const titleText = color === 'yellow' ? 'Editing — has changes' : color === 'green' ? 'Published' : 'Draft'
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${classes[color]}`} title={titleText} />
};
