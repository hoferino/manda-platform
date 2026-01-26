# CIM Export

---
status: Current
last-updated: 2026-01-26
implements: E9
---

Export Confidential Information Memorandums to PowerPoint and PDF.

## Overview

After creating a CIM via the [CIM Builder](../agent-system/cim-builder.md), users can export to:
- **PowerPoint (.pptx)** - Editable presentation format
- **PDF** - Final distribution format

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| Export API | `/api/projects/[id]/cims/[cimId]/export` | Export endpoint |
| PPTX Generator | `lib/export/pptx/` | PowerPoint generation |
| PDF Generator | `lib/export/pdf/` | PDF generation |
| Preview | `components/cim-builder/slide-preview/` | Live slide preview |

## Export Flow

```
CIM Workflow Complete
        ↓
User clicks Export
        ↓
Select format (PPTX/PDF)
        ↓
Generate document
        ↓
Download
```

## PowerPoint Export

### Slide Types

The PPTX generator supports 50+ component types:
- Title slides
- Content slides (text, bullets)
- Financial tables
- Charts and graphs
- Image placeholders
- Quote slides

### Styling

Exports use configurable templates:
- Professional M&A styling
- Custom branding support
- Consistent typography

## PDF Export

Generated from rendered slides:
- High-resolution output
- Consistent layout
- Optimized for print and digital

## Preview Architecture

For real-time preview implementation, see [preview-architecture.md](../agent-system/preview-architecture.md).

## API

```typescript
// Export to PowerPoint
POST /api/projects/[id]/cims/[cimId]/export
{ "format": "pptx" }

// Export to PDF
POST /api/projects/[id]/cims/[cimId]/export
{ "format": "pdf" }
```

## Related Documentation

- **[CIM Builder](../agent-system/cim-builder.md)** - CIM creation workflow
- **[Agent System](../agent-system/)** - Agent documentation hub
