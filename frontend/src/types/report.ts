// ─── Number Formatting ───────────────────────────────────────────────────────

export type Scale = 'units' | 'thousands' | 'millions'
export type NegativeStyle = 'brackets' | 'minus'
export type BorderStyle = 'none' | 'single' | 'double'
export type RowType = 'data' | 'header' | 'subtotal' | 'total' | 'spacer'
export type ColWidth = 'narrow' | 'normal' | 'wide'
export type CalcType = 'variance' | 'pctVariance' | 'pctOfBase'
export type FavorableDirection = 'positive' | 'negative'
export type CFOperator = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'between'
export type CFScope = 'column' | 'row' | 'report'

export interface NumberFormat {
  scale: Scale
  decimals: 0 | 1 | 2
  negativeStyle: NegativeStyle
  thousandsSeparator: boolean
}

// ─── Columns ─────────────────────────────────────────────────────────────────

export interface DataColumn {
  id: string
  member: string
  label: string
  fmtScale?: Scale | 'inherit'
  fmtDecimals?: 0 | 1 | 2 | null
  show: boolean
  highlight: boolean
  width: ColWidth
}

export interface CalcColumn {
  id: string
  calcType: CalcType
  colA: string
  colB: string
  favorable?: FavorableDirection
  label: string
  show: boolean
  highlight: boolean
  width: ColWidth
}

export type Column = DataColumn | CalcColumn

export function isCalcColumn(col: Column): col is CalcColumn {
  return 'calcType' in col
}

export interface ColumnGroup {
  id: string
  label: string
  members: string[]
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

export interface Row {
  id: string
  member: string
  label: string
  type: RowType
  bold: boolean
  indent: 0 | 1 | 2 | 3
  signFlip: boolean
  borderAbove: BorderStyle
  borderBelow: BorderStyle
  noteRef?: string | null
  fmtScale?: Scale | 'inherit'
  fmtDecimals?: 0 | 1 | 2 | null
}

// ─── Conditional Formatting ───────────────────────────────────────────────────

export interface CFRule {
  id: string
  scope: CFScope
  scopeTarget?: string
  operator: CFOperator
  valueA: number
  valueB?: number
  color?: string
  background?: string
  bold?: boolean
  italic?: boolean
}

// ─── Selectors ───────────────────────────────────────────────────────────────

export interface Selector {
  dimension: string
  label: string          // display name override
  selected: string       // current/default element
  elements: string[]
  locked: boolean        // true = fixed in viewer, false = user can change
}

// ─── Header ──────────────────────────────────────────────────────────────────

export interface ReportHeader {
  logo: boolean
  title: string
  subtitle: string
  preparedDate: 'auto' | string
  confidentiality: string
  footer: string
}

// ─── Report Definition ────────────────────────────────────────────────────────

export interface ReportDefinition {
  id: string
  title: string
  cube: string
  view: string
  header: ReportHeader
  numberFormat: NumberFormat
  columnGroups: ColumnGroup[]
  columns: Column[]
  rows: Row[]
  selectors: Selector[]
  cfRules: CFRule[]
}

// ─── Pack ─────────────────────────────────────────────────────────────────────

export interface Pack {
  id: string
  name: string
  description: string
  groups: string[]
  statements: string[]
}

// ─── Dataset (from backend) ───────────────────────────────────────────────────

export interface DatasetCell {
  rowMember: string
  colMembers: string[]
  value: number | null
}

export interface Dataset {
  cube: string
  view: string
  cells: DatasetCell[]
  rowMembers: string[]
  colTuples: string[][]
}
