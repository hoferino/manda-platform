# Manda Platform - Google Cloud Platform Setup Guide

**Version:** 1.0
**Date:** 2025-12-11
**Purpose:** Complete guide to deploy and run Manda M&A Intelligence Platform on Google Cloud

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [GCP Project Setup](#3-gcp-project-setup)
4. [Supabase Configuration](#4-supabase-configuration)
5. [Neo4j Setup (Cloud or Local)](#5-neo4j-setup)
6. [Google Cloud Storage (Already Configured)](#6-google-cloud-storage)
7. [LLM API Configuration](#7-llm-api-configuration)
8. [Cloud Run Deployment](#8-cloud-run-deployment)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Database Migrations](#10-database-migrations)
11. [Verification & Testing](#11-verification--testing)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GOOGLE CLOUD PLATFORM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │
│  │   Cloud Run     │    │  Cloud Storage  │    │   Secret        │    │
│  │   (Next.js)     │    │  (Documents)    │    │   Manager       │    │
│  │                 │    │                 │    │   (API Keys)    │    │
│  │  manda-app      │    │  manda-docs-dev │    │                 │    │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘    │
│           │                      │                      │              │
└───────────┼──────────────────────┼──────────────────────┼──────────────┘
            │                      │                      │
            ▼                      ▼                      ▼
┌───────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│    Supabase       │    │     Neo4j        │    │   LLM APIs       │
│  (PostgreSQL +    │    │  (Knowledge      │    │  - Anthropic     │
│   pgvector)       │    │   Graph)         │    │  - OpenAI        │
│                   │    │                  │    │  - Google AI     │
│  Hosted Service   │    │  Aura or Docker  │    │                  │
└───────────────────┘    └──────────────────┘    └──────────────────┘
```

**Components:**
| Component | Service | Purpose |
|-----------|---------|---------|
| **Application** | Cloud Run | Next.js 15 app with API routes |
| **Database** | Supabase | PostgreSQL with pgvector for embeddings |
| **Graph DB** | Neo4j Aura / Docker | Knowledge graph for findings relationships |
| **File Storage** | Cloud Storage | Document uploads (already configured) |
| **Secrets** | Secret Manager | API keys and credentials |
| **LLM** | Anthropic/OpenAI | AI agent and embeddings |

---

## 2. Prerequisites

### Required Accounts
- [ ] Google Cloud Platform account with billing enabled
- [ ] Supabase account (free tier works for testing)
- [ ] Neo4j Aura account OR Docker installed locally
- [ ] Anthropic API account (recommended) OR OpenAI API account

### Required Tools
```bash
# Install Google Cloud SDK (if not already installed)
# macOS:
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install

# Verify installation
gcloud --version

# Install Docker (for local Neo4j)
# macOS:
brew install --cask docker
```

### Local Development Tools
```bash
# Node.js 18+ required
node --version  # Should be 18.x or higher

# Install dependencies
cd manda-app
npm install
```

---

## 3. GCP Project Setup

### 3.1 Authenticate with GCP
```bash
# Login to GCP
gcloud auth login

# Set your project (already created: manda-platform)
gcloud config set project manda-platform

# Verify
gcloud config get-value project
```

### 3.2 Enable Required APIs
```bash
# Enable required GCP services
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  artifactregistry.googleapis.com
```

### 3.3 Create Service Account (if not exists)
```bash
# Check existing service accounts
gcloud iam service-accounts list

# Your existing service account: manda-storage@manda-platform.iam.gserviceaccount.com
# If you need a new one for Cloud Run:
gcloud iam service-accounts create manda-cloudrun \
  --display-name="Manda Cloud Run Service Account"

# Grant necessary permissions
gcloud projects add-iam-policy-binding manda-platform \
  --member="serviceAccount:manda-cloudrun@manda-platform.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding manda-platform \
  --member="serviceAccount:manda-cloudrun@manda-platform.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Supabase Configuration

### 4.1 Create Supabase Project (if not exists)
1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use existing
3. Note your project details:
   - **Project URL**: `https://[PROJECT_ID].supabase.co`
   - **Anon Key**: Found in Settings > API
   - **Service Role Key**: Found in Settings > API (keep secret!)
   - **Database URL**: Found in Settings > Database

### 4.2 Apply Database Migrations
```bash
cd manda-app

# Option 1: Using Supabase CLI
npx supabase login
npx supabase link --project-ref [YOUR_PROJECT_ID]
npx supabase db push

# Option 2: Manual SQL execution
# Go to Supabase Dashboard > SQL Editor
# Run migrations in order: 00001 through 00039
```

**Migration files location:** `manda-app/supabase/migrations/`

There are **39 migrations** to apply:
- `00001_enable_pgvector.sql` - Enable vector extension
- `00002_create_deals_table.sql` - Core deals table
- ... through ...
- `00039_extend_cims_table.sql` - CIM Builder tables

### 4.3 Verify Supabase Setup
```sql
-- Run in Supabase SQL Editor to verify
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Expected tables: deals, documents, findings, cims, qa_items, etc.
```

---

## 5. Neo4j Setup

### Option A: Neo4j Aura (Recommended for Production)

1. Go to [neo4j.com/cloud/aura](https://neo4j.com/cloud/aura/)
2. Create a free AuraDB instance
3. Note your credentials:
   - **Connection URI**: `neo4j+s://[INSTANCE_ID].databases.neo4j.io`
   - **Username**: `neo4j`
   - **Password**: (generated on creation)

### Option B: Local Docker (Development)

```bash
cd manda-app

# Start Neo4j using docker-compose
docker-compose -f docker-compose.dev.yml up -d

# Verify Neo4j is running
docker ps | grep neo4j

# Access Neo4j Browser: http://localhost:7474
# Default credentials: neo4j / mandadev123
```

### 5.1 Initialize Neo4j Schema
```cypher
// Run in Neo4j Browser or via Cypher shell

// Create constraints for unique IDs
CREATE CONSTRAINT finding_id IF NOT EXISTS FOR (f:Finding) REQUIRE f.id IS UNIQUE;
CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT qa_id IF NOT EXISTS FOR (q:QAItem) REQUIRE q.id IS UNIQUE;

// Create indexes for performance
CREATE INDEX finding_deal IF NOT EXISTS FOR (f:Finding) ON (f.dealId);
CREATE INDEX document_deal IF NOT EXISTS FOR (d:Document) ON (d.dealId);

// Verify
SHOW CONSTRAINTS;
SHOW INDEXES;
```

---

## 6. Google Cloud Storage

**Already Configured!** Your existing setup:
- **Project ID:** `manda-platform`
- **Bucket:** `manda-documents-dev`
- **Service Account Key:** `manda-app/manda-storage-key.json`

### 6.1 Verify GCS Access
```bash
# Test bucket access
gsutil ls gs://manda-documents-dev

# Test upload (optional)
echo "test" | gsutil cp - gs://manda-documents-dev/test.txt
gsutil cat gs://manda-documents-dev/test.txt
gsutil rm gs://manda-documents-dev/test.txt
```

---

## 7. LLM API Configuration

### 7.1 Choose Your LLM Provider

| Provider | Model | Best For | Cost |
|----------|-------|----------|------|
| **Anthropic** | Claude Sonnet 4.5 | Best reasoning, recommended | ~$3/1M tokens |
| **OpenAI** | GPT-4o | Good all-around | ~$2.50/1M tokens |
| **Google** | Gemini 2.0 Flash | Fast, cost-effective | ~$0.075/1M tokens |

### 7.2 Get API Keys

**Anthropic (Recommended):**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key
3. Note: `sk-ant-api03-...`

**OpenAI (Required for Embeddings):**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create API key
3. Note: `sk-proj-...`

> **Important:** Even if using Anthropic for chat, you need OpenAI for embeddings (`text-embedding-3-large`)

### 7.3 Store Secrets in GCP Secret Manager
```bash
# Create secrets
echo -n "sk-ant-api03-YOUR-KEY" | gcloud secrets create anthropic-api-key --data-file=-
echo -n "sk-proj-YOUR-KEY" | gcloud secrets create openai-api-key --data-file=-

# Verify
gcloud secrets list
```

---

## 8. Cloud Run Deployment

### 8.1 Create Dockerfile
Create `manda-app/Dockerfile`:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 8.2 Update next.config.ts for Standalone Build
```typescript
// manda-app/next.config.ts
const nextConfig = {
  output: 'standalone',
  // ... rest of config
}
```

### 8.3 Deploy to Cloud Run
```bash
cd manda-app

# Build and deploy
gcloud run deploy manda-app \
  --source . \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]" \
  --set-env-vars "LLM_PROVIDER=anthropic" \
  --set-env-vars "NEO4J_URI=neo4j+s://[YOUR_INSTANCE].databases.neo4j.io" \
  --set-env-vars "NEO4J_USER=neo4j" \
  --set-env-vars "GCS_PROJECT_ID=manda-platform" \
  --set-env-vars "GCS_BUCKET_NAME=manda-documents-dev" \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-key:latest" \
  --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest" \
  --set-secrets "OPENAI_API_KEY=openai-api-key:latest" \
  --set-secrets "NEO4J_PASSWORD=neo4j-password:latest" \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3
```

### 8.4 Alternative: Run Locally First (Recommended for Testing)
```bash
cd manda-app

# Copy .env.example to .env.local and fill in values
cp .env.example .env.local

# Edit .env.local with your values (see Section 9)

# Start development server
npm run dev

# Open http://localhost:3000
```

---

## 9. Environment Variables Reference

### Complete `.env.local` Template

```bash
# ===================
# Supabase Configuration
# ===================
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres

# ===================
# Neo4j Configuration
# ===================
# For Aura (cloud):
NEO4J_URI=neo4j+s://[INSTANCE_ID].databases.neo4j.io
# For local Docker:
# NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=[YOUR_PASSWORD]

# ===================
# Google Cloud Storage (Already Configured)
# ===================
GCS_PROJECT_ID=manda-platform
GCS_BUCKET_NAME=manda-documents-dev
GOOGLE_APPLICATION_CREDENTIALS=/path/to/manda-storage-key.json
# For Cloud Run, use:
# GCS_CREDENTIALS_JSON={"type":"service_account",...}

# ===================
# LLM Configuration
# ===================
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-[YOUR_KEY]
OPENAI_API_KEY=sk-proj-[YOUR_KEY]
# Optional: specify model
# LLM_MODEL=claude-sonnet-4-5-20250929

# ===================
# pg-boss (Background Jobs)
# ===================
PGBOSS_SCHEMA=pgboss
PGBOSS_CONCURRENCY=5

# ===================
# Application Settings
# ===================
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 10. Database Migrations

### 10.1 Check Migration Status
```bash
# Using Supabase CLI
npx supabase migration list

# Or check in Supabase Dashboard > Database > Migrations
```

### 10.2 Apply All Migrations
```bash
# Push all migrations to remote database
npx supabase db push

# Or apply manually in SQL Editor (Dashboard)
```

### 10.3 Generate TypeScript Types
```bash
# After migrations, regenerate types
npm run db:types

# This creates: lib/supabase/database.types.ts
```

---

## 11. Verification & Testing

### 11.1 Pre-Flight Checklist

Run these checks before testing:

```bash
# 1. Check Node.js version
node --version  # Should be 18+

# 2. Check dependencies installed
npm list --depth=0 | head -20

# 3. Verify environment variables are set
grep -E "^[A-Z]" .env.local | sed 's/=.*/=✓/'

# 4. Test Supabase connection
npm run test:rls

# 5. Test Neo4j connection (if using Docker)
docker exec manda-neo4j cypher-shell -u neo4j -p mandadev123 "RETURN 1"

# 6. Build check
npm run build

# 7. Type check
npm run type-check
```

### 11.2 Start the Application

```bash
# Development mode (with hot reload)
npm run dev

# Production mode (after build)
npm run build && npm run start
```

### 11.3 Verify Core Features

| Test | URL | Expected Result |
|------|-----|-----------------|
| Home page loads | http://localhost:3000 | Login/dashboard page |
| Auth works | /auth/login | Can sign in |
| Create deal | /projects/new | Deal created |
| Upload document | /projects/[id]/documents | File uploads to GCS |
| Chat with agent | /projects/[id]/chat | Agent responds |
| CIM Builder | /projects/[id]/cim-builder | 3-panel interface loads |

### 11.4 Test LLM Connection
```bash
# Quick test via API (after app is running)
curl -X POST http://localhost:3000/api/test-llm \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, are you working?"}'
```

---

## 12. Troubleshooting

### Common Issues

#### "Missing environment variable" errors
```bash
# Check which vars are missing
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING')"
```

#### Neo4j connection refused
```bash
# If using Docker, check container status
docker ps | grep neo4j
docker logs manda-neo4j

# Restart if needed
docker-compose -f docker-compose.dev.yml restart neo4j
```

#### Supabase RLS errors
```sql
-- Check RLS is enabled on table
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies exist
SELECT * FROM pg_policies WHERE tablename = 'deals';
```

#### LLM API errors
```bash
# Test API key directly
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "content-type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-sonnet-4-5-20250929","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

#### GCS permission denied
```bash
# Verify service account has access
gsutil ls gs://manda-documents-dev

# Check service account permissions
gcloud projects get-iam-policy manda-platform \
  --filter="bindings.members:manda-storage@manda-platform.iam.gserviceaccount.com"
```

---

## Quick Start Summary

**For Local Testing:**
```bash
cd manda-app

# 1. Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your API keys and Supabase credentials

# 2. Start Neo4j (Docker)
docker-compose -f docker-compose.dev.yml up -d

# 3. Apply database migrations
npx supabase db push

# 4. Generate types
npm run db:types

# 5. Start the app
npm run dev

# 6. Open http://localhost:3000
```

**For Cloud Run Deployment:**
```bash
# 1. Set up secrets in Secret Manager
# 2. Deploy with gcloud run deploy (see Section 8.3)
# 3. Configure custom domain (optional)
```

---

## Next Steps After Setup

1. **Create a test deal** - Upload your test documents
2. **Test document processing** - Verify findings are extracted
3. **Test the agent** - Chat and verify responses have sources
4. **Test CIM Builder** - Create a CIM end-to-end
5. **Report bugs in Jira** - Track issues found during testing

---

*Created as part of Epic 9 Retrospective - Testing Sprint Preparation*
