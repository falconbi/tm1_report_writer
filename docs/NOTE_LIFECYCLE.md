# TM1 Report Writer - Note & Pack Lifecycle

## Status Display

| Status | Display |
|--------|---------|
| Draft | ● Gray dot |
| Ready to Confirm | ● Blue dot |
| Confirmed | ● Green dot |
| Pending Changes | ● Yellow dot |

*All dots are the same size (1.5 w-1.5)*

---

## Note Lifecycle

**Draft**: status = "draft", readyToConfirm = false, isConfirmed = false → ● Gray

**Ready to Confirm**: status = "draft", readyToConfirm = true → ● Blue
- Creator clicks "Submit for Confirm"

**Confirmed**: status = "published", isConfirmed = true, hasDraft = false → ● Green

**Pending Changes**: isConfirmed = true, hasDraft = true → ● Yellow
- Must Re-Confirm to go back to Green

---

## Editing a Confirmed Note

When you edit a confirmed note (green ●):

1. Your edits go to `content` (working draft)
2. `published_content` stays unchanged (protects packs already using it)
3. `has_draft = true` → Status becomes Yellow ● ("Has Changes")
4. Re-confirm → copies content to published_content, clears has_draft → Green ●

**While Yellow ●**, the note cannot be used in packs. Pack will show warning/block.

This keeps packs stable - they always use `published_content`, never the live draft.

---

## Pack Lifecycle

### Publish Requirements
A pack can only be published when:
- ✅ ALL notes are confirmed (isConfirmed = true AND hasDraft = false)
- ✅ ALL reports are confirmed
- ✅ ALL visuals are confirmed
- ⏭️ Images do NOT require confirmation

---

## Summary

| Artifact | Confirm Required? | What triggers "available for pack" |
|----------|------------------|-----------------------------------|
| Note | YES | Confirm button |
| Report | YES | Confirm button |
| Visual | YES | Confirm button |
| Image | NO | Always available |