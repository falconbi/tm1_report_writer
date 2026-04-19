# Artifact Status Lifecycle

This document defines the official status rules for all **Artifacts** in TM1 Report Writer: Reports, Notes, Visuals, and Packs.

## Status Meanings and Colors

| Status    | Dot Color  | Meaning                                   | Can be used in Packs? |
|-----------|------------|-------------------------------------------|-----------------------|
| Draft     | **Grey**   | Created, never published                  | No                    |
| Published | **Green**  | Published, no pending changes             | Yes                   |
| Editing   | **Yellow** | Published but has unpublished changes     | No                    |

## Workflow Rules

### For Individual Artifacts (Report / Note / Visual)

1. **New Artifact** → starts as **Grey (Draft)**
2. Author clicks **Publish** → becomes **Green (Published)**
3. If anyone edits a **Green** artifact → automatically becomes **Yellow (Editing)**
4. From **Yellow**, click **Publish** again to return to **Green**

### For Packs

Packs follow the same 3-state lifecycle.

- A Pack can only be **Published** if **ALL** contained artifacts are **Green**
- If any artifact is Grey or Yellow → the Pack cannot be published

## DB Implementation

```typescript
status: 'draft' | 'published'
has_draft: bool
```

UI colour mapping:

```text
draft     + has_draft=false → Grey   (never published)
published + has_draft=false → Green  (clean)
published + has_draft=true  → Yellow (editing)
```

Last updated: 2026-04-20
