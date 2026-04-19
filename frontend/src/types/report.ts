// ─── Number Formatting ───────────────────────────────────────────────────────

export type Scale = 'units' | 'thousands' | 'millions'
export type NegativeStyle = 'brackets' | 'minus'
export type BorderStyle = 'none' | 'single' | 'double'
export type RowType = 'data' | 'header' | 'subtotal' | 'total' | 'spacer'
export type FontSize = 'sm' | 'md' | 'lg'
export type RowHeight = 'compact' | 'normal' | 'tall'
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
  headerBackground?: string   // hex — column header shading
  headerColor?: string        // hex — column header text colour
  columnBackground?: string   // hex — full column cell shading
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
  headerBackground?: string
  headerColor?: string
  columnBackground?: string
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
  // Typography
  bold: boolean
  italic: boolean
  underline: boolean
  fontSize: FontSize
  labelColor?: string       // hex — label text colour override
  // Layout
  indent: 0 | 1 | 2 | 3
  rowHeight: RowHeight
  rowBackground?: string    // hex — full row background shading
  // Borders
  borderAbove: BorderStyle
  borderBelow: BorderStyle
  // Numbers
  signFlip: boolean
  numberColor?: string      // hex — override number colour
  fmtScale?: Scale | 'inherit'
  fmtDecimals?: 0 | 1 | 2 | null
  // Cross-reference
  noteRef?: string | null
}

// ─── Conditional Formatting ───────────────────────────────────────────────────

export interface CFRule {
  id: string
  name: string
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

export type SelectorRole = 'none' | 'current_period' | 'prior_period' | 'prior_year' | 'budget_period' | 'custom'

export interface Selector {
  dimension: string
  label: string          // display name override
  selected: string       // current/default element
  elements: string[]
  locked: boolean        // true = fixed in viewer, false = user can change
  role: SelectorRole     // used by Roll Forward to map period values
  roleLabel?: string     // custom label when role = 'custom'
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

export type PageSize = 'a4' | 'letter'
export type PageOrientation = 'portrait' | 'landscape'

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
  pageSize: PageSize
  orientation: PageOrientation
}

// ─── Pack Layout ──────────────────────────────────────────────────────────────

// ─── Visuals (KPI + Chart) ────────────────────────────────────────────────────

export type VisualType = 'kpi' | 'chart'
export type ChartType = 'bar' | 'line' | 'pie'
export type TrendDirection = 'up-good' | 'down-good'

export interface KPIConfig {
  valueRow: string         // TM1 row member to read
  valueColumn: string      // TM1 column member for primary value
  comparisonColumn?: string
  comparisonLabel?: string
  unit?: string            // e.g. "$", "%", "x"
  prefix?: string
  trendDirection?: TrendDirection
  scale?: Scale
  decimals?: 0 | 1 | 2
}

export interface ChartConfig {
  chartType: ChartType
  selectedRows: string[]     // row members to display
  selectedColumns: string[]  // column members to display
  colors?: string[]
  showLegend?: boolean
  showGrid?: boolean
  showLabels?: boolean       // show axis tick labels (default true)
  labelFontSize?: number     // axis label font size px (default 10)
  legendFontSize?: number    // legend font size px (default 10)
}

export interface VisualDefinition {
  id: string
  title: string
  visualType: VisualType
  cube: string
  view: string
  selectors: Selector[]
  numberFormat: NumberFormat
  kpiConfig?: KPIConfig
  chartConfig?: ChartConfig
}

// ─── Pack Layout ──────────────────────────────────────────────────────────────

export type SectionPreset =
  | 'full'
  | 'half'
  | 'two-thirds'
  | 'third-two-thirds'
  | 'thirds'
  | 'quarter-three-quarters'
  | 'three-quarters-quarter'
  | 'quarter-half-quarter'
  | 'half-quarter-quarter'
  | 'quarters'
  // Multi-row presets: each is 'row1Slots-row2Slots-...'
  | 'full-3'
  | '3-full'
  | 'full-2'
  | '2-full'
  | 'full-half'
  | 'half-full'
  | 'half-half'
  | 'full-half-half'
  | 'half-half-full'
export type ArtifactType = 'report' | 'note' | 'visual' | 'text' | 'image' | 'toc'

export interface PackSlot {
  artifactType: ArtifactType | null
  artifactId: string | null
  textContent?: string | null    // HTML content for text slots
  imageFilename?: string | null  // filename for image slots
  label?: string | null          // label for report/image slots (shown in TOC)
  noteLabel?: string | null      // e.g. "1", "2a" — links report row noteRefs to this slot
  excludeFromToc?: boolean | null // exclude this slot from TOC
  description?: string | null    // description for text slots
  slotBackground?: string | null // CSS colour for slot background wash
  slotOpacity?: number | null    // 0–1 opacity of slot background
}

export type RowPreset = 'full' | 'half' | 'thirds' | 'quarters'

export interface PackSectionRow {
  id: string
  preset: RowPreset
  slots: PackSlot[]
}

export interface PackSection {
  id: string
  preset: SectionPreset
  slots: PackSlot[]
  // Multi-row support: when rows present, use this instead of slots
  rows?: PackSectionRow[]
  gapAfter?: 'none' | 'tight' | 'normal' | 'wide'
}

export interface PackPage {
  id: string
  orientation?: 'landscape' | 'portrait'  // default: landscape
  backgroundColour?: string   // hex or undefined = inherit pack default
  backgroundImage?: string    // image filename from library, or undefined
  overlayColour?: string      // hex
  overlayOpacity?: number     // 0–1
  sections: PackSection[]
}

export interface PackDefaults {
  backgroundColour?: string
  backgroundImage?: string
  overlayColour?: string
  overlayOpacity?: number
  footer: {
    showPackName: boolean
    showConfirmedDate: boolean
    showPageNumbers: boolean
    customText: string
  }
}

export function defaultPackDefaults(): PackDefaults {
  return {
    footer: { showPackName: true, showConfirmedDate: true, showPageNumbers: true, customText: '' },
  }
}

/** Detect whether a raw layout array is old PackSection[] or new PackPage[] */
export function isPackPageLayout(raw: unknown[]): raw is PackPage[] {
  return raw.length === 0 || 'sections' in (raw[0] as object)
}

/** Migrate old flat PackSection[] to PackPage[] */
export function migrateLayout(raw: unknown[]): PackPage[] {
  if (!raw.length) return []
  if (isPackPageLayout(raw)) return raw
  // Old format: wrap all sections in a single Page 1
  return [{ id: crypto.randomUUID(), sections: raw as PackSection[] }]
}

// ─── Pack ─────────────────────────────────────────────────────────────────────

export interface Pack {
  id: string
  name: string
  description: string
  groups: string[]
  statements: string[]
  layout: PackPage[]
}

// ─── Note Definition ─────────────────────────────────────────────────────────

export type NoteSlotType = 'text' | 'image' | 'visual' | 'report'

export interface NoteSlot {
  id: string
  type: NoteSlotType
  // text
  html?: string
  // image
  imageFilename?: string
  imageName?: string
  imageWidth?: string  // e.g., "100%", "200px", "auto"
  // visual
  visualId?: string
  visualTitle?: string
  visualWidth?: string
  // report
  reportId?: string
  reportTitle?: string
  reportWidth?: string
}

export interface NoteSection {
  id: string
  preset: SectionPreset
  slots: NoteSlot[]
  subsections?: NoteSection[]  // max 1 level deep
}

export interface NoteDefinition {
  cardBackground?: string   // hex colour for card surface
  sections: NoteSection[]
}

export function parseNoteContent(raw: string): NoteDefinition {
  if (raw.trim().startsWith('{')) {
    try { return JSON.parse(raw) as NoteDefinition } catch {}
  }
  // Legacy HTML — wrap in a single full-width text section
  return {
    sections: [{
      id: 'legacy',
      preset: 'full',
      slots: [{ id: 'legacy-slot', type: 'text', html: raw }],
    }],
  }
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
