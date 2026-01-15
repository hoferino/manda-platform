# Archived Documentation

---
title: Archived Documentation Index
version: 1.0
status: Archive
last-updated: 2026-01-15
---

This folder contains documentation that has been superseded, deprecated, or is no longer actively maintained.

## Purpose

Documents are moved here when:
1. They've been superseded by newer versions
2. They reference removed features/code
3. They're historical reference only (kept for audit trail)

## Archived Files

### From Root Level

| File | Original Location | Reason | Archived |
|------|-------------------|--------|----------|
| `AGENTS.md` | `.archive/AGENTS.md` | Legacy Factory Droid config, superseded by CLAUDE.md | 2026-01-15 |

## How to Archive

When archiving a document:

1. Move file to `docs/archived/` (or `.archive/` for root-level)
2. Add entry to this README
3. Add header to archived file:
   ```markdown
   ---
   status: Archived
   archived-date: YYYY-MM-DD
   superseded-by: path/to/new/doc.md
   reason: Brief explanation
   ---
   ```
4. Remove from main navigation (docs/README.md)

## Files That Should NOT Be Archived

- Documents with historical value for audit/compliance
- Retrospectives (keep indefinitely)
- ADRs (keep for decision history)
- Sprint change proposals (keep for change tracking)

These should remain in their original locations but may be marked as "historical" in their metadata.
