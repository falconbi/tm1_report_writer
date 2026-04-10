import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, FileText, Layers, Clock, Database, ArrowLeft, RefreshCw, Table2 } from 'lucide-react'

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

type Tab = 'overview' | 'reports' | 'packs' | 'audit' | 'schema'

const ACTION_COLOURS: Record<string, string> = {
  publish:    'text-green-600',
  save_draft: 'text-yellow-600',
  delete:     'text-red-500',
  create:     'text-blue-400',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(2)} MB`
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [stats, setStats] = useState<Stats | null>(null)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [packs, setPacks] = useState<PackRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [schema, setSchema] = useState<SchemaTable[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, r, p, a, sc] = await Promise.all([
        get('/api/admin/stats'),
        get('/api/admin/reports'),
        get('/api/admin/packs'),
        get('/api/admin/audit'),
        get('/api/admin/schema'),
      ])
      setStats(s)
      setReports(r.reports)
      setPacks(p.packs)
      setAudit(a.log)
      setSchema(sc.tables)
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
    a.action.toLowerCase().includes(search.toLowerCase())
  )

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview',   icon: <Database className="h-4 w-4" /> },
    { key: 'reports',  label: `Reports (${reports.length})`,  icon: <FileText className="h-4 w-4" /> },
    { key: 'packs',    label: `Packs (${packs.length})`,      icon: <Layers className="h-4 w-4" /> },
    { key: 'audit',    label: `Audit Log (${audit.length})`,  icon: <Clock className="h-4 w-4" /> },
    { key: 'schema',   label: `Schema (${schema.length})`,    icon: <Table2 className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link to="/builder" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Builder
        </Link>
        <div className="w-px h-5 bg-gray-200" />
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <span className="font-semibold text-gray-900">Admin Portal</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Search */}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="bg-gray-100 border border-gray-200 rounded-md px-3 py-1.5 text-sm
                       text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-400 w-48"
          />
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500
                       hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
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
                <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-semibold ${s.colour}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Reports */}
        {tab === 'reports' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Title', 'Type', 'Status', 'Owner', 'Created', 'Updated', 'Published'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReports.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No reports found</td></tr>
                )}
                {filteredReports.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-xs">{r.title || 'Untitled'}</p>
                      <p className="text-xs text-gray-400 font-mono">{r.id.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{r.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
                        ${r.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {r.status}
                        {r.hasDraft && r.everPublished && <span title="Has unpublished changes">•</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.owner ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(r.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(r.updatedAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(r.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Packs */}
        {tab === 'packs' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Name', 'Status', 'Reports', 'Owner', 'Created', 'Updated', 'Published'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPacks.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No packs found</td></tr>
                )}
                {filteredPacks.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full
                        ${p.status === 'published' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.reportCount}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{p.owner ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(p.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(p.updatedAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(p.publishedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit Log */}
        {tab === 'audit' && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['When', 'User', 'Action', 'Type', 'Target', 'Detail'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAudit.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No audit entries</td></tr>
                )}
                {filteredAudit.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(a.timestamp)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{a.user}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${ACTION_COLOURS[a.action] ?? 'text-gray-600'}`}>
                        {a.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{a.targetType}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-800">{a.targetTitle}</p>
                      <p className="text-xs text-gray-400 font-mono">{a.targetId.slice(0, 8)}…</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{a.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Schema */}
        {tab === 'schema' && (
          <div className="space-y-6">
            {schema.map((table) => (
              <div key={table.name} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Table2 className="h-4 w-4 text-blue-400" />
                    <span className="font-semibold text-gray-800 text-sm">{table.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{table.rowCount} row{table.rowCount !== 1 ? 's' : ''}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['#', 'Column', 'Type', 'Not Null', 'Default', 'PK'].map((h) => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {table.columns.map((col) => (
                      <tr key={col.cid} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs text-gray-400">{col.cid}</td>
                        <td className="px-4 py-2">
                          <span className={`text-xs font-mono font-medium ${col.primaryKey ? 'text-blue-400' : 'text-gray-800'}`}>
                            {col.name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-purple-600">{col.type || '—'}</td>
                        <td className="px-4 py-2 text-xs">
                          {col.notNull
                            ? <span className="text-red-500">NOT NULL</span>
                            : <span className="text-gray-300">nullable</span>}
                        </td>
                        <td className="px-4 py-2 text-xs font-mono text-gray-400">{col.default ?? '—'}</td>
                        <td className="px-4 py-2 text-xs">
                          {col.primaryKey && <span className="bg-blue-50 text-blue-400 px-1.5 py-0.5 rounded text-xs font-medium">PK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
