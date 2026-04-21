import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, FileText, Layers, Clock, Database, RefreshCw, Table2, MessageSquare, Trash2 } from 'lucide-react'
import { parseDate } from '../lib/dateUtils'

const BASE = `http://${window.location.hostname}:8080`
const get = (path: string) => fetch(`${BASE}${path}`).then((r) => r.json())

interface Stats {
  reports: number
  packs: number
  drafts: number
  published: number
  dirtyReports: number
  auditEntries: number
  reportVersions: number
  dbSizeBytes: number
}

interface ReportRow {
  id: string
  title: string
  type: string
  status: string
  hasDraft: boolean
  everPublished: boolean
  owner: string | null
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

interface PackRow {
  id: string
  name: string
  description: string
  status: string
  owner: string | null
  reportCount: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

interface AuditRow {
  id: number
  user: string
  action: string
  targetType: string
  targetId: string
  targetTitle: string
  timestamp: string
  detail: string | null
}

interface SchemaColumn {
  cid: number
  name: string
  type: string
  notNull: boolean
  default: string | null
  primaryKey: boolean
}

interface SchemaTable {
  name: string
  sql: string
  columns: SchemaColumn[]
  rowCount: number
}

type Tab = 'overview' | 'reports' | 'packs' | 'audit' | 'comments' | 'schema'

interface CommentRow {
  id: number
  packId: string
  packName: string
  author: string
  body: string
  createdAt: string
}

const ACTION_COLOURS: Record<string, string> = {
  publish:    'text-green-600',
  save_draft: 'text-yellow-600',
  delete:     'text-red-500',
  create:     'text-blue-400',
}

function fmt(iso: string | null) {
  const d = parseDate(iso)
  if (!d) return '—'
  return d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [schemaView, setSchemaView] = useState<'list' | 'diagram'>('list')
  const [stats, setStats] = useState<Stats | null>(null)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [packs, setPacks] = useState<PackRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [comments, setComments] = useState<CommentRow[]>([])
  const [schema, setSchema] = useState<SchemaTable[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([])
  const [tableFilter, setTableFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, r, p, a, sc, cm] = await Promise.all([
        get('/api/admin/stats'),
        get('/api/admin/reports'),
        get('/api/admin/packs'),
        get('/api/admin/audit'),
        get('/api/admin/schema'),
        get('/api/admin/comments'),
      ])
      setStats(s)
      setReports(r.reports)
      setPacks(p.packs)
      setAudit(a.log)
      setSchema(sc.tables)
      setComments(cm.comments)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredReports = reports.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.id.toLowerCase().includes(search.toLowerCase())
  )
  const filteredPacks = packs.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  const filteredAudit = audit.filter((a) =>
    a.targetTitle.toLowerCase().includes(search.toLowerCase()) ||
    a.action.toLowerCase().includes(search.toLowerCase()) ||
    a.user.toLowerCase().includes(search.toLowerCase()) ||
    a.targetType.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview',   icon: <Database className="h-4 w-4" /> },
    { key: 'reports',  label: `Reports (${reports.length})`,  icon: <FileText className="h-4 w-4" /> },
    { key: 'packs',    label: `Packs (${packs.length})`,      icon: <Layers className="h-4 w-4" /> },
    { key: 'audit',    label: `Audit Log (${audit.length})`,     icon: <Clock className="h-4 w-4" /> },
    { key: 'comments', label: `Comments (${comments.length})`,   icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'schema',   label: `Schema (${schema.length})`,       icon: <Table2 className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-400" />
          <span className="font-semibold text-gray-900">Admin Portal</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-xs
                       text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 w-48"
          />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500
                       hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <Link to="/builder?tab=packs" className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500
            hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors">
            <Layers className="h-4 w-4" />
            Builder
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-colors
                ${tab === t.key
                  ? 'text-blue-400 border-b-2 border-blue-400 -mb-px'
                  : 'text-gray-500 hover:text-gray-800'
                }`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Reports',      value: stats.reports,        colour: 'text-blue-400' },
              { label: 'Published',          value: stats.published,      colour: 'text-green-600' },
              { label: 'Drafts',             value: stats.drafts,         colour: 'text-yellow-600' },
              { label: 'Unpublished Changes',value: stats.dirtyReports,   colour: 'text-orange-500' },
              { label: 'Packs',              value: stats.packs,          colour: 'text-purple-600' },
              { label: 'Report Versions',    value: stats.reportVersions, colour: 'text-gray-600' },
              { label: 'Audit Entries',      value: stats.auditEntries,   colour: 'text-gray-600' },
              { label: 'Database Size',      value: fmtBytes(stats.dbSizeBytes), colour: 'text-gray-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-5 py-4">
                <p className="text-[9px] text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-semibold ${s.colour}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reports */}
        {tab === 'reports' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Title', 'Type', 'Status', 'Owner', 'Created', 'Updated', 'Published'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReports.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">No reports found</td></tr>
                )}
                {filteredReports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-xs">{r.title || 'Untitled'}</p>
                      <p className="text-[9px] text-gray-400 font-mono">{r.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 capitalize">{r.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full
                        ${r.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {r.status}
                        {r.hasDraft && r.everPublished && <span title="Has unpublished changes">•</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[9px] text-gray-500">{r.owner ?? '—'}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 whitespace-nowrap">{fmt(r.createdAt)}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 whitespace-nowrap">{fmt(r.updatedAt)}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 whitespace-nowrap">{fmt(r.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Packs */}
        {tab === 'packs' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Status', 'Reports', 'Owner', 'Created', 'Updated', 'Published'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPacks.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">No packs found</td></tr>
                )}
                {filteredPacks.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.description && <p className="text-[9px] text-gray-400">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full
                        ${p.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[9px] text-gray-500">{p.reportCount}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-500">{p.owner ?? '—'}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 whitespace-nowrap">{fmt(p.createdAt)}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 whitespace-nowrap">{fmt(p.updatedAt)}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 whitespace-nowrap">{fmt(p.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit Log */}
        {tab === 'audit' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['When', 'User', 'Action', 'Type', 'Target', 'Detail'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAudit.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">No audit entries</td></tr>
                )}
                {filteredAudit.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-[9px] text-gray-500 whitespace-nowrap">{fmt(a.timestamp)}</td>
                    <td className="px-4 py-3 text-[9px] text-gray-600">{a.user}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[9px] font-semibold ${ACTION_COLOURS[a.action] ?? 'text-gray-600'}`}>
                        {a.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[9px] text-gray-500 capitalize">{a.targetType}</td>
                    <td className="px-4 py-3">
                      <p className="text-[9px] text-gray-800">{a.targetTitle}</p>
                      <p className="text-[9px] text-gray-400 font-mono">{a.targetId.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-[9px] text-gray-400">{a.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Comments */}
        {tab === 'comments' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">ID</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Pack</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Author</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Comment</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comments.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{c.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-700">{c.packName}</td>
                    <td className="px-4 py-3 text-blue-600">{c.author}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-sm truncate" title={c.body}>{c.body}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{fmt(c.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={async () => {
                          if (!window.confirm('Delete this comment? This cannot be undone.')) return
                          await fetch(`${BASE}/api/admin/comments/${c.id}`, { method: 'DELETE' })
                          setComments((prev) => prev.filter((x) => x.id !== c.id))
                        }}
                        title="Delete comment"
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {comments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No comments yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Schema */}
        {tab === 'schema' && (
          <div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSchemaView('list')}
                className={`px-3 py-1.5 text-[9px] rounded ${schemaView === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                List
              </button>
              <button
                onClick={() => setSchemaView('diagram')}
                className={`px-3 py-1.5 text-[9px] rounded ${schemaView === 'diagram' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Diagram
              </button>
            </div>
            {schemaView === 'list' && schema.map((table) => (
              <div key={table.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold text-gray-800 text-xs">{table.name}</span>
                  </div>
                  <span className="text-[9px] text-gray-400">{table.rowCount} row{table.rowCount !== 1 ? 's' : ''}</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['#', 'Column', 'Type', 'Not Null', 'Default', 'PK'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-[9px] font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {table.columns.map((col) => (
                      <tr key={col.cid} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-[9px] text-gray-400">{col.cid}</td>
                        <td className="px-4 py-2">
                          <span className={`text-[9px] font-mono font-medium ${col.primaryKey ? 'text-blue-400' : 'text-gray-800'}`}>
                            {col.name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[9px] font-mono text-purple-600">{col.type || '—'}</td>
                        <td className="px-4 py-2 text-[9px]">
                          {col.notNull
                            ? <span className="text-red-500">NOT NULL</span>
                            : <span className="text-gray-300">nullable</span>}
                        </td>
                        <td className="px-4 py-2 text-[9px] font-mono text-gray-400">{col.default ?? '—'}</td>
                        <td className="px-4 py-2 text-[9px]">
                          {col.primaryKey && <span className="bg-blue-50 text-blue-400 px-1.5 py-0.5 rounded text-[9px] font-medium">PK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {/* Diagram view */}
            {schemaView === 'diagram' && (
              <div className="flex gap-4">
                <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-auto p-4">
                  <svg viewBox="0 0 750 650">
                  <defs>
                    <marker id="fkarrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                      <path d="M0,0 L8,4 L0,8 L0,0" fill="#94a3b8"/>
                    </marker>
                  </defs>
                  {schema.map((table, ti) => {
                    const gridCols = 3
                    const boxW = 200
                    const boxH = Math.min(table.columns.length, 6) * 16 + 28
                    const gapX = 30
                    const gapY = 20
                    const x = (ti % gridCols) * (boxW + gapX) + 20
                    const y = Math.floor(ti / gridCols) * (boxH + gapY) + 20
                    const hasFolder = table.columns.some(c => c.name === 'folder_id')
                    return (
                      <g key={table.name}>
                        <rect x={x} y={y} width={boxW} height={boxH} fill="white" stroke="#cbd5e1" strokeWidth="1.5" rx="4"/>
                        <rect x={x} y={y} width={boxW} height="24" fill="#3b82f6" rx="4"/>
                        <text x={x + 10} y={y + 16} fill="white" fontSize="11" fontWeight="600" pointerEvents="none">{table.name}</text>
                        <rect x={x} y={y} width={boxW} height={boxH} fill="transparent" className={`cursor-pointer ${selectedTable === table.name ? 'stroke-blue-500' : ''}`} onClick={() => {
                          setSelectedTable(table.name)
                          get(`/api/admin/table/${table.name}`).then(d => setTableData(d.rows))
                        }}/>
                        {table.columns.slice(0, 6).map((col, ci) => (
                          <text key={col.name} x={x + 10} y={y + 40 + ci * 16} fill="#334155" fontSize="10" fontFamily="monospace">
                            {col.name}{col.primaryKey ? ' 🗝️' : hasFolder && col.name === 'folder_id' ? ' 🔗' : ''}
                          </text>
                        ))}
                        {/* Relationship arrow to folders */}
                        {hasFolder && table.name !== 'folders' && (
                          <path d={`M${x + boxW + 2} ${y + 50} L${x + boxW + 15} ${y + 50}`} stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#fkarrow)"/>
                        )}
                      </g>
                    )
                  })}
                </svg>
                <div className="flex gap-4 mt-2 text-[9px] text-gray-500">
                  <span>🗝️ Primary Key</span>
                  <span>🔗 Foreign Key (folder_id)</span>
                </div>
                </div>
                {/* Table data panel */}
                <div className="w-80 bg-white rounded-lg border border-gray-200 flex flex-col max-h-[600px]">
                  <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={tableFilter}
                      onChange={(e) => {
                        setTableFilter(e.target.value)
                        if (selectedTable) {
                          get(`/api/admin/table/${selectedTable}?search=${encodeURIComponent(e.target.value)}`).then(d => setTableData(d.rows))
                        }
                      }}
                      className="w-full px-2 py-1 text-[9px] border border-gray-300 rounded"
                    />
                  </div>
                  <div className="flex-1 overflow-auto p-2">
                    <div className="text-[9px] text-gray-500 mb-2">
                      Table: <span className="font-medium">{selectedTable || 'Click a table'}</span>
                      {tableData.length > 0 && <span className="ml-2">({tableData.length} rows)</span>}
                    </div>
                    {selectedTable && tableData.length === 0 && (
                      <p className="text-[9px] text-gray-400">No data</p>
                    )}
                    {selectedTable && tableData.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[9px]">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              {Object.keys(tableData[0] || {}).slice(0, 8).map((col) => (
                                <th key={col} className="px-0.5 py-0.5 text-left font-medium text-gray-600">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.slice(0, 80).map((row, i) => (
                              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                                {Object.values(row).slice(0, 8).map((val, j) => (
                                  <td key={j} className="px-0.5 py-0.5 truncate max-w-[120px]">{String(val ?? '').slice(0, 40)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
