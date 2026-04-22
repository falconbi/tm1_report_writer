import { Plus, Search, X, Folder, MoreVertical, ChevronRight, ChevronDown, Upload, Pencil, Trash2, RefreshCw } from 'lucide-react'
import { FolderListItem } from '../../lib/api'

interface ArtifactTabProps<T extends { id: string; folderId?: string | null; title?: string; name?: string }> {
  items: T[]
  tabSearch: string
  setTabSearch: (v: string) => void
  folderTree: Map<string | null, FolderListItem[]>
  expandedFolders: Set<string>
  toggleFolder: (id: string) => void
  editingFolderId: string | null
  editingFolderName: string
  setEditingFolderId: (id: string | null) => void
  setEditingFolderName: (name: string) => void
  handleCreateFolder: () => void
  handleRenameFolder: (id: string) => void
  handleDeleteFolder?: (id: string) => void
  setContextMenu: (menu: { id: string; type: string; x: number; y: number } | null) => void
  newButtonLabel: string
  newButtonOnClick?: () => void
  searchPlaceholder: string
  emptyMessage: string
  renderItem: (item: T, isSelected: boolean) => React.ReactNode
  selectedId?: string
  showUpload?: boolean
  uploadInputRef?: React.RefObject<HTMLInputElement>
  onUploadChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  uploading?: boolean
  onRefresh?: () => void
}

export default function ArtifactTab<T extends { id: string; folderId?: string | null; title?: string; name?: string }>({
  items, tabSearch, setTabSearch, folderTree, expandedFolders, toggleFolder,
  editingFolderId, editingFolderName, setEditingFolderId, setEditingFolderName,
  handleCreateFolder, handleRenameFolder, handleDeleteFolder, setContextMenu,
  newButtonLabel, newButtonOnClick, searchPlaceholder, emptyMessage, renderItem, selectedId,
  showUpload, uploadInputRef, onUploadChange, uploading, onRefresh
}: ArtifactTabProps<T>) {
  const filteredItems = tabSearch 
    ? items.filter(i => (i.title || i.name || '').toLowerCase().includes(tabSearch.toLowerCase()))
    : items

  const uncategorized = filteredItems.filter(i => !i.folderId)
  const rootFolders = folderTree.get(null) || []

  const renderNewButton = () => {
    if (showUpload && uploadInputRef && onUploadChange) {
      return (
        <>
          <input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml" className="hidden" onChange={onUploadChange} />
          <button onClick={() => uploadInputRef.current?.click()} disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-400 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 transition-colors">
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : newButtonLabel}
          </button>
        </>
      )
    }
    return (
      <button onClick={newButtonOnClick}
        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-400 hover:bg-blue-700 text-white text-xs font-medium transition-colors">
        <Plus className="h-3.5 w-3.5" />
        {newButtonLabel}
      </button>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-800 space-y-2">
        <div className="flex gap-2">
          {renderNewButton()}
          <button onClick={handleCreateFolder} className="px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 transition-colors" title="New Folder">
            <Folder className="h-3.5 w-3.5" />
          </button>
          {onRefresh && (
            <button onClick={onRefresh} className="px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 transition-colors" title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
          <input type="text" value={tabSearch} onChange={(e) => setTabSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-gray-800 border border-gray-700 rounded pl-7 pr-6 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500" />
          {tabSearch && <button onClick={() => setTabSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"><X className="h-2.5 w-2.5" /></button>}
        </div>
      </div>

      {/* List */}
      <nav className="flex-1 overflow-y-auto py-1">
        {filteredItems.length === 0 && rootFolders.length === 0 && (
          <p className="px-3 py-4 text-xs text-gray-600 text-center">{tabSearch ? 'No results' : emptyMessage}</p>
        )}

        {/* Uncategorized */}
        {uncategorized.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Uncategorized</span>
              <button onClick={handleCreateFolder} className="p-1 text-gray-500 hover:text-gray-300"><Plus className="h-4 w-4" /></button>
            </div>
            {uncategorized.map(item => renderItem(item, selectedId === item.id))}
          </div>
        )}

        {/* Foldered items */}
        {rootFolders.map(folder => {
          const folderItems = filteredItems.filter(i => i.folderId === folder.id)
          return (
            <div key={folder.id}>
              <div className="flex items-center gap-1 py-1.5 group hover:bg-gray-800 transition-colors" style={{ paddingLeft: '10px', paddingRight: '8px' }}>
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
                  <button onMouseDown={(e) => { e.preventDefault(); setEditingFolderId(folder.id); setEditingFolderName(folder.name) }} className="p-0.5 text-gray-600 hover:text-blue-400" title="Rename"><Pencil className="h-3 w-3" /></button>
                  {handleDeleteFolder && <button onClick={() => handleDeleteFolder(folder.id)} className="p-0.5 text-gray-600 hover:text-red-400" title="Delete"><Trash2 className="h-3 w-3" /></button>}
                  <button onClick={(e) => { e.stopPropagation(); setContextMenu({ id: folder.id, type: 'folder', x: e.clientX, y: e.clientY }) }} className="p-0.5 text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100"><MoreVertical className="h-3 w-3" /></button>
                </span>
              </div>
              {expandedFolders.has(folder.id) && folderItems.map(item => (
                <div key={item.id} style={{ paddingLeft: '34px' }}>{renderItem(item, selectedId === item.id)}</div>
              ))}
            </div>
          )
        })}

        {uncategorized.length === 0 && rootFolders.length === 0 && (
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">No folders yet</span>
            <button onClick={handleCreateFolder} className="text-xs text-blue-400 hover:text-blue-300">Create Folder</button>
          </div>
        )}
      </nav>
    </>
  )
}