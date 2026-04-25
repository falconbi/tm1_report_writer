import { BookOpen, Save, Upload, Clock, Eye, EyeOff, Trash2, Feather, Lock, RotateCcw, HelpCircle, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useReportStore } from '../../store/useReportStore'
import { useVisualStore } from '../../store/useVisualStore'

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
  imageSelected?: boolean
  onDeleteImage?: () => void
  selectedPackId?: string | null
  packPublished?: boolean
  packLocked?: boolean
  onOpenComposer?: () => void
  onOpenViewer?: () => void
  onPackPublish?: () => void
  onPackLock?: () => void
  onPackRollForward?: () => void
  returnToUrl?: string
}

export default function AppBar({ onSaveDraft, onPublish, onDelete, onHistoryToggle, onPreview, saving, focusMode, activeTab, artifactType = 'report', visualSaving = false, onVisualSave, onVisualPublish, onVisualDelete, imageSelected, onDeleteImage, selectedPackId, packPublished, packLocked, onOpenComposer, onOpenViewer, onPackPublish, onPackLock, onPackRollForward, returnToUrl }: AppBarProps) {
  const nav = useNavigate()
  const { definition, isReadOnly } = useReportStore()
  const { definition: visualDef } = useVisualStore()
  const hasSource = !!(definition.cube && definition.view)
  const visualHasSource = !!(visualDef.cube && visualDef.view)
  const isSaved = !!(definition.id)
  const visualIsSaved = !!(visualDef.id)

  return (
    <>
      <header className="h-11 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-2 text-blue-400 font-semibold shrink-0">
          <BookOpen className="h-4 w-4 text-blue-400" />
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

        {/* Return to Composer */}
        {returnToUrl && (
          <button
            onClick={() => nav(returnToUrl)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-900/40 border border-blue-700/50 text-blue-300 hover:bg-blue-900/70 transition-colors text-xs font-medium shrink-0"
            title="Return to Composer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Back to Composer
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          {!isReadOnly && activeTab !== 'packs' && activeTab !== 'images' && (
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

              

              {/* Publish — reports — show when has source */}
              {artifactType !== 'visual' && hasSource && (
                <button
                  onClick={onPublish}
                  title="Publish"
                  className="p-2 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/50 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                </button>
              )}

              {/* Publish — visuals — show when has source */}
              {artifactType === 'visual' && visualHasSource && onVisualPublish && (
                <button
                  onClick={onVisualPublish}
                  title="Publish"
                  className="p-2 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/50 transition-colors"
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

          {/* Delete — images */}
          {!isReadOnly && activeTab === 'images' && imageSelected && onDeleteImage && (
            <button
              onClick={onDeleteImage}
              title="Delete"
              className="p-2 rounded text-red-400 hover:text-red-300 hover:bg-red-900/50 transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          {/* Pack actions */}
          {activeTab === 'packs' && (
            <>
              {/* Composer — hidden when locked */}
              {!packLocked && (
                <button
                  onClick={onOpenComposer}
                  disabled={!selectedPackId}
                  title="Open Composer"
                  className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Feather className="h-4 w-4" />
                </button>
              )}
              {/* Viewer */}
              <button
                onClick={onOpenViewer}
                disabled={!selectedPackId}
                title="View Pack"
                className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Eye className="h-4 w-4" />
              </button>
              {/* Publish — when not locked */}
              {!packLocked && (
                <button
                  onClick={onPackPublish}
                  disabled={!selectedPackId}
                  title="Publish Pack"
                  className="p-2 rounded text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Upload className="h-4 w-4" />
                </button>
              )}
              {/* Lock — only visible when clean published (no pending changes) */}
              {packPublished && !packLocked && (
                <button
                  onClick={onPackLock}
                  title="Lock Pack (permanent)"
                  className="p-2 rounded text-orange-400 hover:text-orange-300 hover:bg-orange-900/50 transition-colors"
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}
              {/* Roll Forward — when locked */}
              {packLocked && (
                <button
                  onClick={onPackRollForward}
                  disabled={!selectedPackId}
                  title="Roll Forward (create new period copy)"
                  className="p-2 rounded text-blue-400 hover:text-blue-300 hover:bg-blue-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          <div className="w-px h-4 bg-gray-700 mx-1" />

          {/* Focus — not shown on packs tab */}
          {activeTab !== 'packs' && (
            <button
              onClick={onPreview}
              title={focusMode ? 'Exit Focus' : 'Focus'}
              className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
            >
              {focusMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          )}

          {/* History */}
          <button
            onClick={onHistoryToggle}
            title="History"
            className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            <Clock className="h-4 w-4" />
          </button>

          {/* Docs */}
          <a
            href="https://falconbi.github.io/report-writer/"
            target="_blank"
            rel="noopener noreferrer"
            title="Documentation"
            className="p-2 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
          </a>
        </div>
      </header>

    </>
  )
}
