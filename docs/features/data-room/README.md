# Data Room

---
status: Current
last-updated: 2026-01-26
implements: E2
---

Secure document storage and organization for M&A deals.

## Overview

The data room provides a secure, organized space for storing and accessing deal documents:

- **Google Cloud Storage** - Scalable, secure file storage
- **Multi-tenant isolation** - Documents isolated by project_id
- **Version tracking** - Document history and updates
- **Access control** - RLS-enforced permissions

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| Upload UI | `manda-app/components/data-room/` | Document upload interface |
| Storage Service | Google Cloud Storage | File storage backend |
| Metadata | Supabase `documents` table | Document records |
| API | `manda-app/app/api/documents/` | Document endpoints |

## Features

### File Upload

```typescript
// Drag-and-drop upload zone
components/data-room/upload-zone.tsx

// Supported file sizes up to 100MB
// Batch upload support
// Progress tracking
```

### Organization

Documents are organized by:
- **Deal/Project** - Top-level isolation
- **Folder structure** - User-defined hierarchy
- **Tags** - Cross-cutting categorization
- **Document type** - Auto-classified

### Security

| Layer | Implementation |
|-------|----------------|
| Authentication | Supabase Auth |
| Authorization | Row Level Security (RLS) |
| Storage | GCS IAM policies |
| Encryption | GCS server-side encryption |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/upload` | POST | Upload document |
| `/api/documents/[id]` | GET | Get document metadata |
| `/api/documents/[id]/download` | GET | Download document |
| `/api/documents/[id]` | DELETE | Delete document |

## GCS Configuration

See [GCP Setup Guide](../../deployment/gcp-setup-guide.md) for storage configuration.

## Related Documentation

- **[Document Processing](../document-processing/)** - Processing pipeline
- **[Architecture](../../manda-architecture.md)** - System architecture
