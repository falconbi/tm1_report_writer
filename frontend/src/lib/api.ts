const BASE = `http://${window.location.hostname}:8080`

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
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try { const j = await res.json(); if (j.detail) detail = j.detail } catch {}
    throw new Error(detail)
  }
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
  type: string
  status: 'draft' | 'published'
  hasDraft: boolean
  everPublished: boolean
  isConfirmed: boolean
  confirmedAt?: string
  confirmedBy?: string
  readyToConfirm: boolean
  updatedAt?: string
  publishedAt?: string
  lastDatasetAt?: string
  folderId?: string
}

export interface PackListItem {
  id: string
  name: string
  description: string
  status: 'draft' | 'published'
  hasDraft: boolean
  statements: string[]
  layout: import('../types/report').PackPage[]
  updatedAt?: string
  publishedAt?: string
  folderId?: string
}

export interface VisualListItem {
  id: string
  title: string
  visualType: 'kpi' | 'chart'
  status: 'draft' | 'published'
  hasDraft: boolean
  everPublished: boolean
  isConfirmed: boolean
  confirmedAt?: string
  confirmedBy?: string
  readyToConfirm: boolean
  updatedAt?: string
  publishedAt?: string
  folderId?: string
}

export interface PickerVisual {
  id: string
  title: string
  visualType: 'kpi' | 'chart'
  isConfirmed: boolean
  confirmedAt?: string
}


export interface ImageItem {
  id: string
  name: string
  filename: string
  mimeType: string
  sizeBytes: number
  folderId?: string
  uploadedAt: string
  url: string
}

export interface FolderListItem {
  id: string
  name: string
  artifactType: string
  parentId: string | null
  createdAt: string
}

export interface PickerReport {
  id: string
  title: string
  type: string
  hasDraft?: boolean
  isConfirmed?: boolean
  confirmedAt?: string
  lastDatasetAt?: string
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
  getDefinition: (id: string) => get<{ id: string; title: string; definition: unknown; dataset: RawDataset | null; lastDatasetAt: string | null }>(`/api/reports/definitions/${id}`),
  saveDataset: (id: string, dataset: unknown) => post<{ status: string }>(`/api/reports/definitions/${id}/dataset`, { dataset }),
  getPublishedReport: (id: string) => get<{ id: string; title: string; definition: unknown; dataset: RawDataset | null; dataAsOf: string | null }>(`/api/reports/definitions/${id}?published=true`),
  saveDraft: (id: string, definition: unknown) =>
    post<{ status: string }>(`/api/reports/definitions/${id}/draft`, { definition }),
  publish: (id: string, definition: unknown) =>
    post<{ status: string }>(`/api/reports/definitions/${id}/publish`, { definition }),
  deleteReport: (id: string) => del<{ status: string }>(`/api/reports/definitions/${id}`),
  getHistory: (id: string) =>
    get<{ versions: { id: number; publishedAt: string; publishedBy: string | null }[] }>(
      `/api/reports/definitions/${id}/history`
    ),
  getHistoryVersion: (id: string, versionId: number) =>
    get<Record<string, unknown>>(`/api/reports/definitions/${id}/history/${versionId}`),
  confirmData: (id: string, selectors: Record<string, string>) =>
    post<{ status: string; confirmedAt: string; confirmedBy: string }>(
      `/api/reports/definitions/${id}/confirm`, { selectors }
    ),
  submitReportForConfirm: (id: string) =>
    post<{ status: string }>(`/api/reports/definitions/${id}/submit-for-confirm`, {}),
  releaseReport: (id: string) =>
    post<{ status: string }>(`/api/reports/definitions/${id}/release`, {}),

  // Visuals
  listVisuals: () => get<{ visuals: VisualListItem[] }>('/api/visuals/list'),
  createVisual: () => post<{ id: string; title: string; visualType: string; status: string; definition: Record<string, unknown> }>('/api/visuals/', {}),
  getVisual: (id: string, published = false) =>
    get<{ id: string; title: string; visualType: string; status: string; isConfirmed: boolean; definition: Record<string, unknown> }>(
      `/api/visuals/${id}${published ? '?published=true' : ''}`
    ),
  saveVisualDraft: (id: string, title: string, visualType: string, definition: unknown) =>
    post<{ status: string }>(`/api/visuals/${id}/draft`, { title, visualType, definition }),
  publishVisual: (id: string, title: string, visualType: string, definition: unknown) =>
    post<{ status: string }>(`/api/visuals/${id}/publish`, { title, visualType, definition }),
  deleteVisual: (id: string) => del<{ status: string }>(`/api/visuals/${id}`),
  confirmVisual: (id: string) =>
    post<{ status: string; confirmedAt: string; confirmedBy: string }>(`/api/visuals/${id}/confirm`, {}),
  submitVisualForConfirm: (id: string) =>
    post<{ status: string }>(`/api/visuals/${id}/submit-for-confirm`, {}),
  releaseVisual: (id: string) =>
    post<{ status: string }>(`/api/visuals/${id}/release`, {}),
  pickerVisuals: () => get<{ visuals: PickerVisual[] }>('/api/packs/picker/visuals'),

  // Packs
  listPacks: () => get<{ packs: PackListItem[] }>('/api/packs/list'),
  getPack: (id: string) => get<PackListItem>(`/api/packs/${id}`),
  savePackDraft: (id: string, payload: { name: string; description: string; statements: string[]; layout: unknown[] }) =>
    post<{ status: string }>(`/api/packs/${id}/draft`, payload),
  publishPack: (id: string, payload: { name: string; description: string; statements: string[]; layout: unknown[] }) =>
    post<{ status: string }>(`/api/packs/${id}/publish`, payload),
  deletePack: (id: string) => del<{ status: string }>(`/api/packs/${id}`),
  renamePack: (id: string, name: string) =>
    fetch(`${BASE}/api/packs/${id}/rename?name=${encodeURIComponent(name)}`, { method: 'PUT' }).then((r) => r.json()),
  pickerReports: () => get<{ reports: PickerReport[] }>('/api/packs/picker/reports'),

  // Images
  listImages: () => get<{ images: ImageItem[] }>('/api/images/list'),
  uploadImage: (file: File, name: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('name', name)
    return fetch(`${BASE}/api/images/upload`, { method: 'POST', body: form })
      .then(async (res) => {
        if (!res.ok) {
          let detail = `${res.status} ${res.statusText}`
          try { const j = await res.json(); if (j.detail) detail = j.detail } catch {}
          throw new Error(detail)
        }
        return res.json() as Promise<ImageItem>
      })
  },
  renameImage: (id: string, name: string) =>
    fetch(`${BASE}/api/images/${id}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then((r) => r.json()),
  deleteImage: (id: string) => del<{ ok: boolean }>(`/api/images/${id}`),

  // Folders
  listFolders: (artifactType: string) =>
    get<{ folders: FolderListItem[] }>(`/api/folders/list/${artifactType}`),
  createFolder: (artifactType: string, name: string, parentId?: string | null) =>
    post<{ id: string; name: string; artifactType: string; parentId: string | null }>('/api/folders/', { artifactType, name, parentId: parentId ?? null }),
  renameFolder: (folderId: string, name: string) =>
    fetch(`${BASE}/api/folders/${folderId}?name=${encodeURIComponent(name)}`, {
      method: 'PUT',
    }).then((r) => r.json()),
  deleteFolder: (folderId: string) => del<{ status: string }>(`/api/folders/${folderId}`),
  moveFolder: (folderId: string, parentId: string | null) =>
    post<{ id: string; parentId: string | null }>(`/api/folders/${folderId}/move`, { parentId }),

  // Move artifact to folder
  moveToFolder: async (artifactType: string, artifactId: string, folderId: string | null) => {
    const endpoints: Record<string, string> = {
      report: `/api/reports/${artifactId}/folder`,
      visual: `/api/visuals/${artifactId}/folder`,
      pack: `/api/packs/${artifactId}/folder`,
      image: `/api/images/${artifactId}/folder`,
    }
    const endpoint = endpoints[artifactType]
    if (!endpoint) throw new Error(`Unknown artifact type: ${artifactType}`)
    return post<{ status: string }>(endpoint, { folderId })
  },
}
