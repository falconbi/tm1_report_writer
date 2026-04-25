# TM1 Report Writer — Builder Reference

> For report designers and pack composers. A feature register — what each thing does and when to use it.

---

## Overview

The Builder has three main areas:

| Area | URL | Who uses it |
| --- | --- | --- |
| **Builder** | `/builder` | Report designers — create and publish reports, visuals, and manage images |
| **Composer** | `/builder/packs/:id` | Pack designers — assemble artifacts into page layouts |
| **Admin** | `/admin` | Administrators — DB stats, audit log, schema |

---

## Reports

### What a Report Is

A report is a structured financial table connected to a TM1 cube view. It is the core artifact — visuals and packs are built around reports.

### Creating a Report

1. Click **New Report** in the sidebar
2. Choose a data source — **TM1** or **CSV Upload** (toggle at the top of the Source tab)
3. For TM1: select a **Cube** then a **View** (only `SYS` prefix views are shown)
4. For CSV: drop or browse to a `.csv` file (see [CSV Upload](#csv-upload) below)
5. Set your **Selectors** — one dropdown per context dimension (e.g. Entity, Period)
6. The report renders a live preview immediately

### Selectors

Selectors are the dimension dropdowns shown above a report. They let the viewer change context (e.g. switch period or entity) without the report designer needing to create separate reports.

### CSV Upload

CSV is an alternative data source for reports and visuals — useful when data comes from outside TM1 (e.g. a spreadsheet export, a non-TM1 system, or a one-off dataset).

| Feature | Description |
| --- | --- |
| File | Drop or browse to a `.csv` file — accepted on the Source tab |
| Format detection | Automatically detects pivoted (matrix) or flat (row-per-value) format |
| Axis swap | Tick "Swap axes" if periods are rows in your CSV rather than columns |
| Row / Column dimension names | Override the dimension labels shown in the report |
| Confirm | Applies the CSV as the data source and auto-populates columns and rows |
| Refresh | Upload a new CSV with the same structure to update the data — columns and rows are preserved |
| Replace | Upload a new CSV and reconfigure from scratch |

CSV-backed reports and visuals behave identically to TM1-backed ones in the Composer and Viewer. The dataset snapshot is saved with the report so the Viewer can display it without re-uploading.

Selectors are fixed on CSV reports — viewers cannot change context the way they can on TM1 reports.

### Columns Tab

| Feature | Description |
| --- | --- |
| Add Column | Pick a TM1 member from the view's column axis |
| Calc Column | Derived column: Variance (A−B), % Variance, or % of Base |
| Label | Override the display name |
| Width | Narrow / Normal / Wide — affects column pixel width |
| Highlight | Blue tint on column and header |
| Header Background / Colour | Custom colour per column header |
| Column Background | Background tint on all data cells in the column |
| Favorable Direction | For calc columns — whether positive or negative is "good" (affects red colouring) |
| Show/Hide | Toggle column visibility without deleting it |

### Rows Tab

| Feature | Description |
| --- | --- |
| Row Types | `data` (standard), `total`, `subtotal`, `header` (label row), `spacer` (blank gap) |
| Label | Display name — can differ from the TM1 member name |
| Indent | 0–4 levels of visual indentation |
| Bold / Italic / Underline | Text styling |
| Font Size | sm / md / lg |
| Row Height | compact / normal / tall |
| Border Above / Below | none / single / double |
| Sign Flip | Multiply value by −1 (e.g. for expense rows where TM1 stores as positive) |
| Row Background | Custom background colour |
| Label Colour / Number Colour | Override text colour |
| Note Ref | Footnote reference (e.g. `1`, `2a`) — links to a Text slot elsewhere in the pack |

### Format Tab

| Feature | Description |
| --- | --- |
| Title | Report heading displayed above the table |
| Subtitle | Secondary heading below the title |
| Scale | Thousands / Millions / Units |
| Decimals | Number of decimal places (0–2) |
| Negative Style | Brackets `(123)` or minus `-123` |
| Table Density | Normal / Dense / Compact — reduces column widths and font size for wide reports |
| Confidentiality / Footer | Text lines shown at the bottom of the report card |

### Conditional Formatting (CF) Tab

CF rules apply colour, bold, or italic to cells that meet a condition.

| Setting | Description |
| --- | --- |
| Scope | `row` — applies to all cells in a row; `column` — applies to all cells in a column |
| Scope Target | Which row or column ID the rule applies to |
| Operator | `>`, `>=`, `<`, `<=`, `=`, `!=`, `between` |
| Value | Threshold value (raw, before scale) |
| Colour | Text colour when condition is met |
| Background | Cell background when condition is met |
| Bold / Italic | Font weight/style when condition is met |

### Publish Lifecycle

| Status | Meaning |
| --- | --- |
| Grey (Draft) | Never published — only visible in the Builder |
| Green (Published) | Published and clean — eligible for inclusion in a pack |
| Yellow (Editing) | Published but has unsaved changes — pack cannot be published until changes are published or discarded |

Viewers always read the **published** definition. Drafts are never visible in the Viewer.

---

## Visuals

Visuals are KPI tiles and charts that can be embedded in pack pages.

| Visual Type | Description |
| --- | --- |
| KPI | Large metric display with optional comparison value and trend indicator |
| Bar Chart | Vertical or horizontal bar chart |
| Line Chart | Time-series line chart |
| Pie / Donut | Proportional breakdown |

Visuals connect to TM1 in the same way as reports — cube, view, selectors.

---

## Images

The image library is a shared pool of images available across all packs.

- Upload via the **Images** tab in the Builder sidebar
- Accepted formats: PNG (recommended for logos and signatures — supports transparency), JPG, SVG
- Images are referenced by filename — renaming an image in the library does not break existing references
- Images are served from the backend at `/images/<filename>`

---

## Pack Composer

### What a Pack Is

A pack is an ordered collection of pages. Each page contains sections, each section contains slots. Artifacts (reports, visuals, text, images) are placed into slots.

### Pages

| Setting | Description |
| --- | --- |
| Orientation | Portrait (A4 210×297mm) or Landscape (A4 297×210mm) — per page |
| Background Colour | Solid colour behind all content on the page |
| Background Image | Image from the library as a full-page background |
| Background Opacity | 0–100% — fade the background image |
| Hide Header | Suppress the pack header on this specific page |

Each page divider in the Composer toolbar shows a small rectangle icon — tall (portrait) or wide (landscape) — indicating the current orientation of that page at a glance.

### Pack Header

Configured in **Pack Settings** (gear icon in the Composer toolbar).

| Setting | Description |
| --- | --- |
| Company Name | Smaller prefix text left of the title |
| Report Title | Bold underlined text — the main pack title |
| Font | CSS font family for all header text |
| Text Colour | Colour applied to both prefix and title |
| Background Colour | Coloured bar behind the header — leave unset for transparent |
| Logo | Pick from the image library — appears at the chosen position |
| Logo Position | Left or Right — default Right |

### Pack Footer

| Setting | Description |
| --- | --- |
| Footer Left | Statutory or confidentiality text shown bottom-left |
| Page Numbers | Page / Total (e.g. 3 of 12), Page only, or None |
| Hide Data Footer | Suppress the "Data as of …" line on all report and visual slots |

### Section Layout Presets

Single-row presets:

| Preset | Description |
| --- | --- |
| Full | One slot, full width |
| Half | Two equal slots |
| 66/33 | Left wider, right narrow |
| 33/66 | Left narrow, right wider |
| Thirds | Three equal slots |
| Quarters | Four equal slots |

Multi-row presets combine rows — e.g. `half + half` is two rows each with two slots.

### Slot Types

| Type | Description |
| --- | --- |
| Report | Embed a published report table |
| Visual | Embed a published KPI or chart |
| Text | Rich text — headings, bold, italic, lists, links, text colour. No table formatting — use a Report slot for that. |
| Image | Pick from the image library |
| HTML | Custom HTML/CSS — full layout control within the slot |
| TOC | Auto-generated table of contents for the pack |
| Signature | Sign-off block with name, title, date lines, and optional scanned signature image |

### HTML Slots

HTML slots render inside a sandboxed iframe. Key constraints:

- Use `width:100%; height:100%` on the root element — fixed `mm` or `px` sizes do not fill the slot
- Add `box-sizing:border-box` if using borders or padding
- No external resources — all images, fonts, and scripts must be inline or data URIs
- JavaScript is blocked by the sandbox — layout only
- The slot is rendered at A4 landscape proportions (297×210mm at 96dpi = 1123×794px)
- For dense text: `font-size:8px; line-height:1.35`

**CSS Presets** — the HTML slot editor offers one-click presets for common layouts (dark header, KPI grid, etc). Select a preset to apply it as a starting point, then customise.

**Image URLs** — the tips panel in the HTML editor lists all library images with copy-URL buttons. Paste the URL directly into your HTML `<img src="">`.

### Slot Styling

Every slot can have:

- **Background Colour** — solid fill behind the slot content
- **Opacity** — fade the background (0 = transparent, 100 = solid)

### Text Slot Labels

Each Text slot has two optional identifiers:

- **Label** — shown in the TOC and the Viewer sidebar. Set this to include the slot in the table of contents.
- **Note Label** — a short footnote reference (e.g. `1`, `2a`) that report rows can link to via the **Note Ref** field. Clicking the superscript in the report scrolls to the Text slot.
- **Exclude from TOC** — tick to hide a Text slot from the TOC even if it has a label.

### TOC Slot

The TOC slot auto-generates a linked table of contents from all labeled slots in the pack. Clicking an entry scrolls to that slot in the Viewer.

To include a slot in the TOC, set its **Label**. To exclude a text slot from the TOC, tick **Exclude from TOC**.

### Signature Slot

Used for formal sign-off pages (e.g. accounts certification).

- Add up to 4 signatories per slot
- Each signatory: Name, Title, Date (leave blank for a wet-ink line)
- Optional: pick a PNG from the image library as a scanned signature image — use PNG with transparent background so it overlays cleanly on the page

### Height Control

Sections can have a fixed **height %** — the percentage of the content area they occupy. Leave at 0 for automatic (shrink to content). Use fixed heights when you need precise layout, e.g. a chart taking exactly 60% of the page height.

---

## Pack Workflow

### Draft → Publish

| Step | What happens |
| --- | --- |
| Save Draft | Saves the current layout — visible in the Composer only |
| Publish | Archives the previous published version, makes the new version live in the Viewer |

Viewers always see the last **published** version. Drafts are invisible to viewers.

### Publishing a Pack

A pack can only be published when all included artifacts are **Green (Published)**. If any artifact is Grey (never published) or Yellow (has unpublished edits), the publish button will be blocked until those artifacts are published.

### Lock

Locking a pack **freezes the data permanently**:

- Deep-copies all artifact definitions from their published state
- Fetches live TM1 datasets and stores them as frozen snapshots
- The Viewer reads exclusively from the snapshot — TM1 is never queried again for a locked pack
- Locks are permanent — there is no unlock

Use locking for regulatory or audit packs where the data must not change after sign-off.

### Jumping to an Artifact for Editing

There are two ways to jump directly from a pack context to an artifact in the Builder for editing:

- **From the Composer** — report and visual slots show a pencil icon. Clicking it opens that artifact in the Builder. A **← Back to Pack** button appears in the Builder toolbar so you can return to the Composer at the same page once edits are done.
- **From the Packs tab in the Builder sidebar** — expanding a pack in the list shows its artifacts. Clicking an artifact opens it for editing with the same **← Back to Pack** return button.

In both cases the return button takes you back to the Composer at the page you were on, so you don't lose your place.

### Pack Comments

Each pack has a comment thread in the Builder sidebar — visible when the pack is selected. Any team member can add a comment with their name and a message. Comments are timestamped and persistent, providing a lightweight review trail alongside the pack.

Administrators can delete individual comments from the **Comments** tab in the Admin portal (`/admin`), which shows all comments across all packs in a single table.

### Page Reviewer Notes and Priority Flag

Each page in the Composer has a reviewer note field (bottom of the page panel):

| Feature | Description |
| --- | --- |
| Reviewer note | Free-text field for internal comments about a page — not visible to viewers |
| Priority flag | Mark a note as priority — shows a red dot on the page in the page list so issues are visible at a glance |
| Resolve | Mark a priority note as resolved — dot turns grey, note is retained for audit |

A red dot on a page in the page list means it has an open priority note. The dot disappears once resolved. Use this to track pages that need attention before the pack is published.

### Roll Forward

Roll Forward creates a new draft pack from a locked pack as a template for the next period:

- Layout, text slots, image slots, and TOC slots are copied verbatim
- TM1-backed slots (reports, visuals) are copied but unlinked — flagged as "needs linking"
- The `rolled_from_pack_id` lineage reference is preserved for audit

---

## Image Library

| Action | Where |
| --- | --- |
| Upload | Builder sidebar → Images tab |
| Rename | Click the pencil icon next to any image |
| Delete | Click the bin icon — warns if the image is referenced in any slot |
| Copy URL | Available in the HTML slot tips panel for use in HTML content |

Recommended formats:

- **PNG** — logos, signatures, charts with transparency
- **JPG** — photographs, background images
- **SVG** — icons, diagrams (scales perfectly at any size)

---

## Reference

### A4 Page Dimensions (at 96dpi)

| Orientation | Width | Height |
| --- | --- | --- |
| Landscape | 1123px (297mm) | 794px (210mm) |
| Portrait | 794px (210mm) | 1123px (297mm) |

Use these when sizing HTML slots, background images, or designing content at exact proportions.

### Number Formatting Scale

| Setting | Divide by |
| --- | --- |
| Units | 1 |
| Thousands | 1,000 |
| Millions | 1,000,000 |

Scale is applied before decimal formatting. Raw TM1 values are stored as-is — the scale is display-only.

### Table Density

| Setting | Use when |
| --- | --- |
| Normal | Standard reports with 3–5 columns |
| Dense | 6–8 columns or long column headers |
| Compact | 9+ columns or very constrained width |

Density reduces column widths and font sizes uniformly across the table.
