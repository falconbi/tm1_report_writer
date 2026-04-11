# Artifact Status Lifecycle

This document defines the official status rules for all **Artifacts** in TM1 Report Writer: Reports, Notes, Visuals, and Packs.

## Status Meanings and Colors

| Status              | Dot Color | Meaning                                      | Can be used in Packs? |
|---------------------|-----------|----------------------------------------------|-----------------------|
| Draft               | **Grey**  | Never published or initial state             | No                    |
| Ready to Confirm    | **Blue**  | Submitted by author, waiting for confirmation| No                    |
| Confirmed           | **Green** | Reviewed and approved                        | Yes                   |
| Pending Changes     | **Yellow**| Confirmed artifact has been edited           | No                    |

## Workflow Rules

### For Individual Artifacts (Report / Note / Visual)

1. **New Artifact** → starts as **Grey (Draft)**
2. Author works → clicks **"Submit for Confirm"** → becomes **Blue**
3. Reviewer clicks **"Confirm"** → becomes **Green (Confirmed)**
4. If anyone edits a **Green** artifact → automatically becomes **Yellow (Pending Changes)**
5. From **Yellow**, must go through **Submit → Confirm** again to return to Green

**Important Governance Rule:**
- While in **Yellow (Pending Changes)** state:
  - The **Save Draft** button must be **disabled** or hidden.
  - Only **Submit for Confirm** and **Confirm** actions are allowed.
  - Saving must **not** reset the status back to Grey.

### For Packs

Packs have a **simpler** status lifecycle (no Blue/Ready state):

| Status              | Dot Color | Meaning                                      | 
|---------------------|-----------|----------------------------------------------|
| Draft               | **Grey**  | Never published, being edited               |
| Published           | **Green** | Published and final                          |
| Pending Changes     | **Yellow**| Published pack with unpublished edits        |

**Pack Rules:**
- A Pack can only be **Published** if **ALL** contained artifacts are in **Green (Confirmed)** state.
- A Pack can **contain** Yellow artifacts - they just can't be used in a published pack yet.
- If any child is Grey (Draft) or Blue (Ready) → the Pack cannot be published.
- When editing a **Published** pack → automatically becomes **Yellow**
- Pack publishing serves as the final governance check.

## UI Behavior Summary

- **Grey**: Full editing + Save Draft + Submit
- **Blue**: Confirm button active
- **Green**: Edit allowed → immediately transitions to Yellow
- **Yellow**: No Save Draft allowed. Only Submit and Confirm

## Implementation Notes

- Use both `status` and `hasDraft` fields together. Never collapse them.
- When saving a draft on a Confirmed artifact, keep `isConfirmed = true` and set `hasDraft = true`.
- The Yellow state protects published Packs from using outdated content.
- Packs: Pass `undefined` for `readyToConfirm` and `isConfirmed` to the shared status helper - it will handle Packs correctly.

Last updated: 2026-04-11
