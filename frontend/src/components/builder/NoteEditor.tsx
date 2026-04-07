import { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextAlign } from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight,
  Table as TableIcon,
  Undo, Redo,
  Save, Upload, Trash2, X,
  Highlighter, ShieldCheck, CheckCircle2,
} from 'lucide-react'
import { api } from '../../lib/api'

interface Props {
  noteId: string
  initialIsConfirmed?: boolean
  initialConfirmedAt?: string
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const COLOURS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#000000']
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa']

function ToolbarBtn({
  onClick, active, title, children,
}: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-gray-700 mx-0.5" />
}

export default function NoteEditor({ noteId, initialIsConfirmed = false, initialConfirmedAt, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState('Untitled Note')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const [_status, setStatus] = useState<'draft' | 'published'>('draft')
  const [isConfirmed, setIsConfirmed] = useState(initialIsConfirmed)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(initialConfirmedAt ?? null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showColourPicker, setShowColourPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    onUpdate: () => setIsDirty(true),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-6 text-gray-900',
      },
    },
  })

  // Load existing note
  useEffect(() => {
    setLoading(true)
    api.getNote(noteId)
      .then((n) => {
        setTitle(n.title)
        setStatus(n.status as 'draft' | 'published')
        editor?.commands.setContent(n.content || '')
        setIsDirty(false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [noteId, editor])

  const handleSaveDraft = useCallback(async () => {
    if (!editor) return
    setSaving(true)
    try {
      await api.saveNoteDraft(noteId, title, editor.getHTML())
      setIsDirty(false)
      setIsConfirmed(false)  // content changed — approval stale
      onSaved()
    } catch (e) {
      alert('Save failed — check backend is running')
    } finally {
      setSaving(false)
    }
  }, [editor, noteId, title, onSaved])

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      const r = await api.confirmNote(noteId)
      setIsConfirmed(true)
      setConfirmedAt(r.confirmedAt)
      setShowConfirmDialog(false)
      onSaved()
    } catch {
      alert('Confirm failed — check backend is running')
    } finally {
      setConfirming(false)
    }
  }

  const handlePublish = useCallback(async () => {
    if (!editor) return
    setSaving(true)
    try {
      await api.publishNote(noteId, title, editor.getHTML())
      setStatus('published')
      setIsDirty(false)
      onSaved()
    } catch (e) {
      alert('Publish failed — check backend is running')
    } finally {
      setSaving(false)
    }
  }, [editor, noteId, title, onSaved])

  const handleDelete = async () => {
    if (!window.confirm(`Delete note "${title}"? This cannot be undone.`)) return
    try {
      await api.deleteNote(noteId)
      onDeleted()
    } catch (e) {
      alert('Delete failed')
    }
  }

  const insertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  if (loading) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Top bar */}
      <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-3 shrink-0">
        <input
          type="text"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setIsDirty(true) }}
          className="flex-1 bg-transparent text-gray-100 text-sm font-medium focus:outline-none
                     placeholder-gray-600 min-w-0"
          placeholder="Note title…"
        />
        {isDirty && <span className="text-yellow-500 text-xs shrink-0">•</span>}
        {isConfirmed && confirmedAt && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0"
            title={`Confirmed ${new Date(confirmedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {`Confirmed ${new Date(confirmedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
          </span>
        )}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                       bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-40 transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={saving || confirming || isDirty}
            title={isDirty ? 'Save draft first before confirming' : isConfirmed ? 'Re-confirm commentary' : 'Confirm commentary has been reviewed'}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
              disabled:opacity-40 disabled:cursor-not-allowed transition-colors
              ${isConfirmed
                ? 'bg-emerald-800 hover:bg-emerald-700 text-emerald-200'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-200'}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {isConfirmed ? 'Re-confirm' : 'Confirm'}
          </button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md
                       bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Publish'}
          </button>
          <button
            onClick={handleDelete}
            title="Delete note"
            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 text-gray-500 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {editor && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 bg-gray-900 border-b border-gray-800 flex-wrap shrink-0">
          <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo">
            <Undo className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo">
            <Redo className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })} title="Heading 1">
            <Heading1 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })} title="Heading 2">
            <Heading2 className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })} title="Heading 3">
            <Heading3 className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')} title="Underline">
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')} title="Strikethrough">
            <Strikethrough className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <Divider />

          {/* Text colour */}
          <div className="relative">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowColourPicker(!showColourPicker); setShowHighlightPicker(false) }}
              title="Text colour"
              className="p-1.5 rounded text-gray-400 hover:text-gray-100 hover:bg-gray-700 transition-colors flex flex-col items-center"
            >
              <span className="text-xs font-bold leading-none" style={{ color: editor.getAttributes('textStyle').color || '#ffffff' }}>A</span>
              <span className="w-3.5 h-0.5 rounded-full mt-0.5" style={{ backgroundColor: editor.getAttributes('textStyle').color || '#ffffff' }} />
            </button>
            {showColourPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg p-2 flex gap-1 shadow-xl">
                {COLOURS.map((c) => (
                  <button
                    key={c}
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setShowColourPicker(false) }}
                    className="w-5 h-5 rounded-full border border-gray-600 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setShowColourPicker(false) }}
                  className="w-5 h-5 rounded-full border border-gray-600 bg-gray-700 text-gray-300 text-xs flex items-center justify-center hover:bg-gray-600"
                  title="Remove colour"
                >×</button>
              </div>
            )}
          </div>

          {/* Highlight */}
          <div className="relative">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowHighlightPicker(!showHighlightPicker); setShowColourPicker(false) }}
              title="Highlight"
              className={`p-1.5 rounded transition-colors ${editor.isActive('highlight') ? 'bg-yellow-600 text-white' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'}`}
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            {showHighlightPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-lg p-2 flex gap-1 shadow-xl">
                {HIGHLIGHTS.map((c) => (
                  <button
                    key={c}
                    onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHighlight({ color: c }).run(); setShowHighlightPicker(false) }}
                    className="w-5 h-5 rounded border border-gray-600 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
                <button
                  onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false) }}
                  className="w-5 h-5 rounded border border-gray-600 bg-gray-700 text-gray-300 text-xs flex items-center justify-center hover:bg-gray-600"
                  title="Remove highlight"
                >×</button>
              </div>
            )}
          </div>

          <Divider />

          <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')} title="Bullet list">
            <List className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')} title="Numbered list">
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })} title="Align left">
            <AlignLeft className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })} title="Align centre">
            <AlignCenter className="h-3.5 w-3.5" />
          </ToolbarBtn>
          <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })} title="Align right">
            <AlignRight className="h-3.5 w-3.5" />
          </ToolbarBtn>

          <Divider />

          <ToolbarBtn onClick={insertTable} title="Insert table">
            <TableIcon className="h-3.5 w-3.5" />
          </ToolbarBtn>
        </div>
      )}

      {/* Editor body */}
      <div
        className="flex-1 overflow-auto bg-white"
        onClick={() => { setShowColourPicker(false); setShowHighlightPicker(false) }}
      >
        <div className="max-w-4xl mx-auto">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Confirm commentary dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-[440px] p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-100">Confirm Commentary</h2>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              By confirming you attest that:
            </p>
            <ul className="text-xs text-gray-400 space-y-1.5 list-disc list-inside leading-relaxed">
              <li>The commentary has been reviewed and is accurate</li>
              <li>The content is appropriate for publication in a pack</li>
              <li>Any figures or references mentioned have been verified</li>
            </ul>
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
                {confirming ? 'Confirming…' : 'I confirm the commentary is correct'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
