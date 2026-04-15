import { create } from 'zustand'
import { VisualDefinition } from '../types/report'
import { RawDataset, VisualListItem } from '../lib/api'

interface VisualStore {
  definition: VisualDefinition
  dataset: RawDataset | null
  isDirty: boolean
  visualList: VisualListItem[]
  setDefinition: (def: VisualDefinition) => void
  patchDefinition: (patch: Partial<VisualDefinition>) => void
  setDataset: (ds: RawDataset | null) => void
  setVisualList: (list: VisualListItem[]) => void
  markDirty: () => void
  markClean: () => void
  reset: () => void
  newVisual: () => void
}

const EMPTY_DEFINITION: VisualDefinition = {
  id: '',
  title: '',
  visualType: 'kpi',
  cube: '',
  view: '',
  selectors: [],
  numberFormat: { scale: 'thousands', decimals: 0, negativeStyle: 'brackets', thousandsSeparator: true },
}

export const useVisualStore = create<VisualStore>((set) => ({
  definition: EMPTY_DEFINITION,
  dataset: null,
  isDirty: false,
  visualList: [],

  setDefinition: (def) => set({ definition: def, isDirty: false }),

  patchDefinition: (patch) => set((s) => ({
    definition: { ...s.definition, ...patch },
    isDirty: true,
  })),

  setDataset: (dataset) => set({ dataset }),

  setVisualList: (visualList) => set({ visualList }),

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  reset: () => set({ definition: EMPTY_DEFINITION, dataset: null, isDirty: false }),

  newVisual: () => set({
    definition: { ...EMPTY_DEFINITION, id: crypto.randomUUID() },
    dataset: null,
    isDirty: false,
  }),
}))
