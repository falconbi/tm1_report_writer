import { create } from 'zustand'
import { VisualDefinition } from '../types/report'
import { RawDataset } from '../lib/api'

interface VisualStore {
  definition: VisualDefinition
  dataset: RawDataset | null
  isDirty: boolean
  setDefinition: (def: VisualDefinition) => void
  patchDefinition: (patch: Partial<VisualDefinition>) => void
  setDataset: (ds: RawDataset | null) => void
  markDirty: () => void
  markClean: () => void
  reset: () => void
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

  setDefinition: (def) => set({ definition: def, isDirty: false }),

  patchDefinition: (patch) => set((s) => ({
    definition: { ...s.definition, ...patch },
    isDirty: true,
  })),

  setDataset: (dataset) => set({ dataset }),

  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  reset: () => set({ definition: EMPTY_DEFINITION, dataset: null, isDirty: false }),
}))
