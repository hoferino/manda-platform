# Deployment Documentation

---
status: Current
last-updated: 2026-01-26
---

Deployment guides for the Manda platform on Google Cloud Platform.

## Documents

| Document | Purpose | When to use |
|----------|---------|-------------|
| [gcp-setup-guide.md](gcp-setup-guide.md) | Step-by-step setup | Setting up GCP resources |
| [gcp-deployment-guide.md](gcp-deployment-guide.md) | Strategy & cost analysis | Planning deployment architecture |

## Quick Reference

### Services Overview

| Component | GCP Service | Purpose |
|-----------|-------------|---------|
| Frontend | Cloud Run | Next.js application |
| Backend | Cloud Run | FastAPI workers |
| Database | Supabase (external) | PostgreSQL + Auth |
| Storage | Cloud Storage | Document files |
| Graph DB | Neo4j Aura (external) | Knowledge graph |

### Environment Setup Order

1. **GCP Project** - Create project, enable APIs
2. **Cloud Storage** - Create buckets for documents
3. **Service Accounts** - Set up IAM permissions
4. **Cloud Run** - Deploy services
5. **Secrets** - Configure Secret Manager

### Key Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# GCS
GCS_BUCKET_NAME=
GOOGLE_APPLICATION_CREDENTIALS=

# Neo4j
NEO4J_URI=
NEO4J_USER=
NEO4J_PASSWORD=

# LLM APIs
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=
VOYAGE_API_KEY=
```

## Related Documentation

- [../features/knowledge-graph/](../features/knowledge-graph/) - Graphiti + Neo4j setup
- [../../manda-processing/CLAUDE.md](../../manda-processing/CLAUDE.md) - Backend specifics
