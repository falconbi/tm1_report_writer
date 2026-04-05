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

export const api = {
  getCubes: () => get<{ cubes: string[] }>('/api/tm1/cubes'),
  getViews: (cube: string) => get<{ views: string[] }>(`/api/tm1/views?cube=${encodeURIComponent(cube)}`),
  getDataset: (cube: string, view: string) =>
    get<RawDataset>(`/api/reports/dataset?cube=${encodeURIComponent(cube)}&view=${encodeURIComponent(view)}`),
}
