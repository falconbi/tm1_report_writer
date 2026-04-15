import { create } from 'zustand'
import { ReportDefinition, Column, Row, CFRule, Selector, ColumnGroup } from '../types/report'
import { RawDataset, ReportListItem } from '../lib/api'

const EMPTY_DEFINITION: ReportDefinition = {
  id: '',
  title: '',
  cube: '',
  view: '',
  header: {
    logo: true,
    title: '',
    subtitle: '',
    preparedDate: 'auto',
    confidentiality: 'Confidential — Internal Use Only',
    footer: '',
  },
  numberFormat: {
    scale: 'units',
    decimals: 0,
    negativeStyle: 'brackets',
    thousandsSeparator: true,
  },
  columnGroups: [],
  columns: [],
  rows: [],
  selectors: [],
  cfRules: [],
  pageSize: 'a4',
  orientation: 'portrait',
}

interface ReportStore {
  // Current definition being edited
  definition: ReportDefinition
  isDirty: boolean
  isReadOnly: boolean

  // Live dataset for the current source
  dataset: RawDataset | null
  setDataset: (dataset: RawDataset | null) => void
  lastDatasetAt: Date | null
  setLastDatasetAt: (at: Date | null) => void

  // Available reports list
  reportList: ReportListItem[]

  // Actions — definition
  newReport: () => void
  loadDefinition: (def: ReportDefinition) => void
  setTitle: (title: string) => void
  setSource: (cube: string, view: string) => void

  // Actions — columns
  setColumns: (columns: Column[]) => void
  updateColumn: (id: string, patch: Partial<Column>) => void
  addColumn: (col: Column) => void
  removeColumn: (id: string) => void
  setColumnGroups: (groups: ColumnGroup[]) => void

  // Actions — rows
  setRows: (rows: Row[]) => void
  updateRow: (id: string, patch: Partial<Row>) => void
  addRow: (row: Row) => void
  removeRow: (id: string) => void

  // Actions — format
  setNumberFormat: (patch: Partial<ReportDefinition['numberFormat']>) => void
  setHeader: (patch: Partial<ReportDefinition['header']>) => void
  setPageLayout: (patch: Partial<Pick<ReportDefinition, 'pageSize' | 'orientation'>>) => void

  // Actions — selectors
  setSelectors: (selectors: Selector[]) => void
  updateSelector: (dimension: string, selected: string) => void

  // Actions — CF rules
  setCFRules: (rules: CFRule[]) => void
  addCFRule: (rule: CFRule) => void
  removeCFRule: (id: string) => void
  updateCFRule: (id: string, patch: Partial<CFRule>) => void

  // Actions — report list
  setReportList: (list: ReportStore['reportList']) => void

  markClean: () => void
  setReadOnly: (val: boolean) => void
}

export const useReportStore = create<ReportStore>((set) => ({
  definition: EMPTY_DEFINITION,
  isDirty: false,
  isReadOnly: false,
  dataset: null,
  setDataset: (dataset) => set({ dataset }),
  lastDatasetAt: null,
  setLastDatasetAt: (lastDatasetAt) => set({ lastDatasetAt }),
  reportList: [],

  newReport: () => set({
    definition: { ...EMPTY_DEFINITION, id: crypto.randomUUID() },
    isDirty: false,
    isReadOnly: false,
    lastDatasetAt: null,
  }),

  loadDefinition: (def) => set({ definition: def, isDirty: false, isReadOnly: false }),

  setTitle: (title) => set((s) => ({
    definition: { ...s.definition, title },
    isDirty: true,
  })),

  setSource: (cube, view) => set((s) => ({
    definition: { ...s.definition, cube, view, columns: [], rows: [], selectors: [] },
    isDirty: true,
  })),

  setColumns: (columns) => set((s) => ({ definition: { ...s.definition, columns }, isDirty: true })),

  updateColumn: (id, patch) => set((s) => ({
    definition: {
      ...s.definition,
      columns: s.definition.columns.map((c) => c.id === id ? { ...c, ...patch } as Column : c),
    },
    isDirty: true,
  })),

  addColumn: (col) => set((s) => ({
    definition: { ...s.definition, columns: [...s.definition.columns, col] },
    isDirty: true,
  })),

  removeColumn: (id) => set((s) => ({
    definition: { ...s.definition, columns: s.definition.columns.filter((c) => c.id !== id) },
    isDirty: true,
  })),

  setColumnGroups: (columnGroups) => set((s) => ({
    definition: { ...s.definition, columnGroups },
    isDirty: true,
  })),

  setRows: (rows) => set((s) => ({ definition: { ...s.definition, rows }, isDirty: true })),

  updateRow: (id, patch) => set((s) => ({
    definition: {
      ...s.definition,
      rows: s.definition.rows.map((r) => r.id === id ? { ...r, ...patch } : r),
    },
    isDirty: true,
  })),

  addRow: (row) => set((s) => ({
    definition: { ...s.definition, rows: [...s.definition.rows, row] },
    isDirty: true,
  })),

  removeRow: (id) => set((s) => ({
    definition: { ...s.definition, rows: s.definition.rows.filter((r) => r.id !== id) },
    isDirty: true,
  })),

  setNumberFormat: (patch) => set((s) => ({
    definition: { ...s.definition, numberFormat: { ...s.definition.numberFormat, ...patch } },
    isDirty: true,
  })),

  setHeader: (patch) => set((s) => ({
    definition: { ...s.definition, header: { ...s.definition.header, ...patch } },
    isDirty: true,
  })),

  setSelectors: (selectors) => set((s) => ({ definition: { ...s.definition, selectors }, isDirty: true })),

  updateSelector: (dimension, selected) => set((s) => ({
    definition: {
      ...s.definition,
      selectors: s.definition.selectors.map((sel) =>
        sel.dimension === dimension ? { ...sel, selected } : sel
      ),
    },
    isDirty: true,
  })),

  setCFRules: (cfRules) => set((s) => ({ definition: { ...s.definition, cfRules }, isDirty: true })),

  addCFRule: (rule) => set((s) => ({
    definition: { ...s.definition, cfRules: [...s.definition.cfRules, rule] },
    isDirty: true,
  })),

  removeCFRule: (id) => set((s) => ({
    definition: { ...s.definition, cfRules: s.definition.cfRules.filter((r) => r.id !== id) },
    isDirty: true,
  })),

  updateCFRule: (id, patch) => set((s) => ({
    definition: {
      ...s.definition,
      cfRules: s.definition.cfRules.map((r) => r.id === id ? { ...r, ...patch } : r),
    },
    isDirty: true,
  })),

  setReportList: (reportList) => set({ reportList }),

  setPageLayout: (patch) => set((s) => ({
    definition: { ...s.definition, ...patch },
    isDirty: true,
  })),

  markClean: () => set({ isDirty: false }),
  setReadOnly: (isReadOnly) => set({ isReadOnly }),
}))
