const BASE = 'http://localhost:8080'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface RawDataset {
  status: string
  cube: string
  view: string
  context: string
  axes: {
    hierarchies: string[]
    tuples: { members: string[] }[]
  }[]
  cells: (number | null)[][]
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface ReportListItem {
  id: string
  title: string
  status: 'draft' | 'published'
}

export const api = {
  getCubes: () => get<{ cubes: string[] }>('/api/tm1/cubes'),
  getViews: (cube: string) => get<{ views: string[] }>(`/api/tm1/views?cube=${encodeURIComponent(cube)}`),
  getMembers: (dimension: string) => get<{ members: string[] }>(`/api/tm1/members?dimension=${encodeURIComponent(dimension)}`),
  getDataset: (cube: string, view: string, overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams({
      cube,
      view,
      overrides: JSON.stringify(overrides),
    })
    return get<RawDataset>(`/api/reports/dataset?${params}`)
  },
  listReports: () => get<{ reports: ReportListItem[] }>('/api/reports/list'),
  getDefinition: (id: string) => get<Record<string, unknown>>(`/api/reports/definitions/${id}`),
  saveDraft: (id: string, definition: unknown) =>
    post<{ status: string }>(`/api/reports/definitions/${id}/draft`, { definition }),
  publish: (id: string, definition: unknown) =>
    post<{ status: string }>(`/api/reports/definitions/${id}/publish`, { definition }),
  deleteReport: (id: string) => del<{ status: string }>(`/api/reports/definitions/${id}`),
}
