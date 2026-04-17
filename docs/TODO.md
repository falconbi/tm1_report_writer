# TM1 Report Writer - TODO / Feature Requests

Last updated: 2026-04-16

---

## Image Slot Issues

### 1. Image sizing and overflow
- [ ] Show image size in slot OR auto-resize to fit slot without overflow
- [ ] Option to blend to background (fade at edges)
- [ ] Image needs label field in composer
- [ ] Show in sidebar of Composer (Option to show/hide in TOC)
- [ ] Delete on Image Tab doesn't work - fix

### 2. Image information
- [ ] Show more metadata: Loaded By who, Size, Dimensions
- [ ] Create Folder for Background Images to easily identify those
- [ ] Background Images should have specified size/quality

---

## TOC Improvements

### 3. TOC formatting
- [ ] Allow custom formatting, not just stock
- [ ] Remove right column showing slot type (pointless in TOC)
- [ ] Indent Image/Report/Visual under their Page in TOC (currently flat list)
- [ ] Make hierarchical - allow a Header (Outline) Identifier in each Slot Label 

### 4. HTML display 
- [ ] Show full HTML in Text, user can view/edit and copy out

### 5. Viewer View Modes (Not working correctly)
- [ ] Side-by-side view shows 2 pages side by side
- [ ] Grid view shows all pages in a grid
- [ ] Zoom controls work properly
- [ ] Need to revisit implementation - currently not rendering correctly

### 5. Labels in Viewer
- [ ] Remove odd grey labels like "Note" - distracting
- [ ] Don't show slot type badges in viewer

---

## Header/Footer Control

### 6. Pack-level Header/Footer
- [ ] Overall Header/Footer option (shows on all pages)
- [ ] Per-page Header/Footer override

### 7. Page numbering
- [ ] "Page X of Y" built in
- [ ] Configurable format

---

## Pack Publishing & Locking

### 8. Pack Freeze/Lock
- [ ] Published + Confirmed Pack = frozen (can never be edited), Only Need Confirmed Pack, all Data Source Artifacts (Reports/Visuals) must be Published in Pack 
- [ ] If edit needed of frozen Pack, create new instance/version
- [ ] Version history showing all published versions
- [ ] Snapshot of Frozen Pack taken and stored on DB. Underlying Artifacts (Images/Reports/Visuals) can be reused ?

---

## Multi-row Sections

### 9. Already implemented (2026-04-16)
- [x] Multi-row presets: 1+3, 3+1, 1+2, 2+1, 1+1-1 look to be duplicated as exist in Section and outside ?
- [x] Multi-row presets: 1+3, 3+1, 1+2, 2+1, 1+1-1, etc
- [x] Section labels show preset name in composer tree
- [x] TOC works with multi-row sections
- [x] Narrow slot header styling
- [x] Change slot type button (refresh icon)


---

## Nice to Have

### 10. PDF Export
- [ ] Server-side PDF generation (WeasyPrint)

### 11. Roll Forward
- [ ] Copy pack 

### 12. Edit Locking
- [ ] Show who's editing what
- [ ] Prevent concurrent edits

### 13. Authentik OIDC
- [ ] User identity for owner, audit, locking

### 14. Dockerize
- [ ] Setup in Docker 
