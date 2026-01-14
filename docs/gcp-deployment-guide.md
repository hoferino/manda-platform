# Google Cloud Deployment Guide for Manda Platform

> Research conducted: 2026-01-14

## Executive Summary

For the Manda platform (Next.js 16 frontend + FastAPI backend) in an MVP/testing phase, the recommended approach is:

| Component | Recommended Service | Monthly Cost Estimate |
|-----------|--------------------|-----------------------|
| Next.js Frontend | Cloud Run (or Firebase App Hosting) | $0-20 (low traffic) |
| FastAPI Backend | Cloud Run | $10-50 |
| Neo4j | Neo4j AuraDB Free OR Self-hosted | $0-65 |
| PostgreSQL | Keep Supabase | Current costs |
| CDN | Built-in with Firebase App Hosting | Included |

**Total estimated MVP cost: $10-135/month** (depending on traffic and Neo4j choice)

---

## 1. Deployment Services Comparison

### Cloud Run (Recommended)

Cloud Run is the best fit for the Next.js + FastAPI architecture:

**Pros:**
- Pay-per-use with scale-to-zero (great for MVP/testing)
- Containerized deployments give full control
- Multi-region deployment possible (unlike App Engine which is single-region)
- Generous free tier: 180,000 vCPU-seconds, 360,000 GiB-seconds, 2M requests/month
- Native support for both Next.js and FastAPI
- 15-minute request timeout (vs App Engine's 1 minute)

**Cons:**
- Cold starts (300ms-1s typically, can be longer)
- Requires understanding of containers

### App Engine

**App Engine Standard:**
- Simpler deployment but restrictive sandbox
- Cannot access local filesystem (breaks `next/image`)
- Single region only
- 1-minute timeout limit
- Better for simple Python/Node apps

**App Engine Flexible:**
- More flexibility but slower deployments
- More expensive than Cloud Run for equivalent workloads

### GKE (Google Kubernetes Engine)

**When to use GKE:**
- High 24/7 traffic applications
- Complex orchestration needs
- Multiple stateful services
- Team has Kubernetes expertise

**Not recommended for MVP** because:
- Complexity overhead
- Higher baseline costs
- Overkill for early-stage applications

### Compute Engine

**When to consider:**
- Predictable high traffic (cheaper than serverless at scale)
- Need full VM control
- Running Neo4j self-hosted

**Not recommended for MVP** due to:
- Always-on billing
- Manual scaling
- Operations overhead

---

## 2. Cost Optimization Strategies

### Free Tier Maximization

**Cloud Run Free Tier (monthly):**

| Resource | Free Amount |
|----------|-------------|
| vCPU-seconds | 180,000 (~50 hours) |
| GiB-seconds | 360,000 (~100 hours for 1 GiB) |
| Requests | 2,000,000 |

**Firebase App Hosting Free Tier:**
- 10 GB storage
- 10 GB data transfer/month
- Virtually no costs at ~10k visits/month

### Cost Control Techniques

1. **Scale to Zero**: Don't set minimum instances during testing
2. **Right-size containers**: Start with minimum CPU/memory, scale up based on monitoring
3. **Use Cloud Scheduler for warming**: Cheaper than minimum instances ($0.10/month vs ~$65/month for 1 always-on instance)
4. **Enable Startup CPU Boost**: Free feature that reduces cold starts by up to 50%
5. **Committed Use Discounts (CUDs)**: Consider for production (saves up to 57%)

### Estimated Costs by Traffic Level

| Traffic Level | Cloud Run Cost | Notes |
|--------------|----------------|-------|
| Low (< 10k req/month) | $0-5 | Within free tier |
| Medium (100k req/month) | $10-30 | Some overage |
| High (1M req/month) | $50-150+ | Consider CUDs |

---

## 3. CDN Options

### What is a CDN?

A CDN (Content Delivery Network) caches static files (JS, CSS, images) on servers worldwide, so users get faster load times regardless of their location.

### Option A: Firebase App Hosting (Recommended for Simplicity)

Firebase App Hosting is purpose-built for Next.js:

**How it works:**
- Import GitHub repo, auto-builds and deploys
- Static content cached on global CDN automatically
- Server-rendered content runs on Cloud Run
- Cloud Load Balancer with Cloud CDN enabled

**Pricing:**
- Free tier: 10 GB storage, 10 GB transfer
- Blaze (pay-as-you-go): $0.026/GB stored, $0.15/GB transferred

**Regions available:** us-central1, asia-east1, europe-west4

### Option B: Cloud Run + Cloud CDN

If you need more control:

**Cloud CDN Pricing:**

| Component | Cost |
|-----------|------|
| Cache Egress (North America) | $0.02-0.20/GB |
| Cache Fill | $0.01-0.04/GB |

**Benefits:**
- Fine-grained cache control
- Custom caching policies
- Works with any origin

### Option C: Keep Static Assets in GCS

For static assets (images, JS, CSS):
- Upload to Google Cloud Storage
- Serve via Cloud CDN
- Can reduce egress costs by 60-80%

---

## 4. Dev/Prod Environment Separation

### Recommended Approach: Separate GCP Projects

Best practice is to use separate projects per environment:

```
manda-dev      (development)
manda-staging  (testing/QA)
manda-prod     (production)
```

**Benefits:**
- Complete isolation of code and data
- Separate IAM permissions per environment
- Independent billing tracking
- RLS enforcement remains at database level

### Project Structure

```
manda-dev/
├── Cloud Run: manda-app-dev
├── Cloud Run: manda-processing-dev
└── Connected to: Supabase dev database

manda-staging/
├── Cloud Run: manda-app-staging
├── Cloud Run: manda-processing-staging
└── Connected to: Supabase staging database (or shared dev)

manda-prod/
├── Cloud Run: manda-app-prod
├── Cloud Run: manda-processing-prod
└── Connected to: Supabase prod database
```

### CI/CD with Cloud Deploy

Google Cloud Deploy provides:
- Delivery pipelines with promotion gates
- Manual approval for production deployments
- IAM-based access control for promotions
- Audit trail of all deployments

### IAM Best Practices

| Role | Dev Access | Staging Access | Prod Access |
|------|------------|----------------|-------------|
| Developers | Full | Read + Deploy | Read only |
| CI/CD Pipeline | Deploy | Deploy | Deploy (with approval) |
| Ops/SRE | Full | Full | Full |

---

## 5. Cold Starts & Mitigation

### Cloud Run CPU Allocation Options

**Option 1: CPU During Request Only (Default)**
- CPU active only while handling requests
- Scale to zero enabled
- Higher per-second rates
- $0.40/million requests

**Option 2: CPU Always Allocated**
- CPU active throughout container lifecycle
- Enables background tasks
- 25% lower CPU rate, 20% lower memory rate
- $0 for requests

### Cold Start Considerations

**Typical cold start times:**
- Cloud Run: 300ms - 1s (can be longer for heavy apps)
- FastAPI: Usually faster than Next.js
- Next.js: Can be 1-3s for large bundles

### Mitigation Strategies

| Strategy | Cost | Effect |
|----------|------|--------|
| Cloud Scheduler warming | ~$0.10/mo | Pings service every 5 min |
| Startup CPU Boost | Free | 30-50% faster cold starts |
| Minimum instances (1) | ~$65/mo | No cold starts, always ready |

**Startup CPU Boost (Free)**
- Up to 50% faster startup for Java/Spring
- Up to 30% faster for Node.js

**Minimum Instances (Paid)**
- Eliminates cold starts
- Cost: ~$65/month per idle instance (1 vCPU, 512 MB)

**Cloud Scheduler Warming (Cheap)**
- Ping service every few minutes
- Keeps 0→1 instance warm
- Cost: ~$0.10/month

**Container Optimization**
- Use slim base images (`python:3.12-slim`)
- Minimize dependencies
- Use multi-stage Docker builds

---

## 6. Neo4j Deployment Options

### Option A: Neo4j AuraDB (Recommended for MVP)

Neo4j AuraDB is fully managed and available on GCP Marketplace:

**Tiers:**
- **AuraDB Free**: Limited but good for testing
- **Business Critical**: For production workloads
- **Virtual Dedicated Cloud**: For VPC requirements

**Pros:**
- Zero operations overhead
- Spin up in 5 minutes
- Can use Google Cloud credits
- 60+ global regions

### Option B: Self-Hosted on GCE/GKE

Deploy via GCP Marketplace with Terraform:

**Pros:**
- Full control
- Potentially cheaper at scale
- BYOL option

**Cons:**
- Operations overhead
- Requires Terraform 1.2.0+
- Manual scaling and backups

---

## 7. Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Firebase App Hosting                      │
│                    (or Cloud Run + CDN)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    Cloud CDN                             │ │
│  │            (static assets cached globally)               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                           │                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Cloud Run (Next.js 16)                      │ │
│  │         - Serverless, scale to zero                      │ │
│  │         - Startup CPU Boost enabled                      │ │
│  │         - Min instances: 0 (warming via scheduler)       │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Cloud Run (FastAPI Backend)                     │
│         - Serverless, scale to zero                          │
│         - Startup CPU Boost enabled                          │
│         - 15-min timeout for document processing             │
└─────────────────────────────────────────────────────────────┘
                     │              │
                     ▼              ▼
        ┌────────────────┐  ┌────────────────┐
        │    Supabase    │  │  Neo4j AuraDB  │
        │   PostgreSQL   │  │ (or self-host) │
        │  (keep current)│  │                │
        └────────────────┘  └────────────────┘
```

---

## 8. Development Workflow

```
┌─────────────────┐     ┌─────────────────┐
│   Local Dev     │     │    Staging      │
│  (your machine) │────▶│  (Cloud Run)    │
│                 │     │  testers use    │
└─────────────────┘     └─────────────────┘
        │                       │
        │  feature complete     │ approved
        ▼                       ▼
┌─────────────────────────────────────────┐
│              Production                  │
│            (Cloud Run)                   │
│         when ready to launch             │
└─────────────────────────────────────────┘
```

---

## 9. Quick Start Commands

### Create GCP Project for Staging

```bash
# Create staging project
gcloud projects create manda-staging --name="Manda Staging"
gcloud config set project manda-staging

# Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### Deploy FastAPI Backend

```bash
cd manda-processing

gcloud run deploy manda-processing \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --cpu-boost \
  --set-env-vars="DATABASE_URL=${DATABASE_URL},NEO4J_URI=${NEO4J_URI}"
```

### Deploy Next.js Frontend

```bash
cd manda-app

gcloud run deploy manda-app \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --cpu-boost \
  --set-env-vars="NEXT_PUBLIC_API_URL=https://manda-processing-xxx.run.app"
```

### Deploy with Firebase App Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login and initialize
firebase login
firebase init apphosting

# Deploy
firebase apphosting:deploy
```

---

## 10. Implementation Phases

### Phase 1: MVP/Testing (Current)

1. **Frontend**: Deploy to Cloud Run or Firebase App Hosting
   - Zero-config Next.js deployment (Firebase)
   - Automatic CDN caching
   - Git-based CI/CD

2. **Backend**: Deploy to Cloud Run
   - Use existing Dockerfile
   - Enable Startup CPU Boost
   - Keep min instances at 0

3. **Database**: Keep Supabase for PostgreSQL

4. **Neo4j**: Start with AuraDB Free or smallest paid tier

5. **Environment**: Single project (`manda-staging`) initially

**Estimated monthly cost: $10-50**

### Phase 2: Pre-Production

1. Add separate staging/prod projects
2. Set up Cloud Deploy pipelines
3. Consider 1 minimum instance for backend
4. Add Cloud Monitoring and alerting

**Estimated monthly cost: $50-150**

### Phase 3: Production

1. Create production project (`manda-prod`)
2. Enable minimum instances (1-2)
3. Consider Committed Use Discounts
4. Add Cloud Armor for security
5. Multi-region deployment if needed

**Estimated monthly cost: $150-500+**

---

## Sources

### Deployment Comparisons
- [Google App Engine in 2025: Serverless Simplicity vs Cloud Run and GKE](https://medium.com/google-cloud/google-app-engine-in-2025-serverless-simplicity-vs-cloud-run-and-gke-d46f485cf908)
- [Choosing Between GKE and Cloud Run](https://medium.com/google-cloud/choosing-between-gke-and-cloud-run-46f57b87035c)
- [App Engine vs. Cloud Run: A real-world engineering comparison](https://northflank.com/blog/app-engine-vs-cloud-run)
- [Compare App Engine and Cloud Run - Google Cloud Documentation](https://docs.cloud.google.com/appengine/migration-center/run/compare-gae-with-run)

### Pricing and Cost Optimization
- [Cloud Run Pricing - Google Cloud](https://cloud.google.com/run/pricing)
- [Google Cloud Run Pricing in 2025: A Comprehensive Guide](https://cloudchipr.com/blog/cloud-run-pricing)
- [Google Cloud Run: Pricing and Cost Optimization](https://www.prosperops.com/blog/google-cloud-run-pricing-and-cost-optimization/)
- [Cloud Run Pricing Breakdown 2025](https://hamy.xyz/blog/2025-04_google-cloud-run-pricing)

### Cold Start Optimization
- [3 solutions to mitigate cold-starts on Cloud Run](https://medium.com/google-cloud/3-solutions-to-mitigate-the-cold-starts-on-cloud-run-8c60f0ae7894)
- [Google Cloud Run 2025: Cold Start Optimization Techniques](https://markaicode.com/google-cloud-run-cold-start-optimization-2025/)
- [Faster cold starts with startup CPU Boost](https://cloud.google.com/blog/products/serverless/announcing-startup-cpu-boost-for-cloud-run--cloud-functions)

### Firebase and CDN
- [Firebase App Hosting - Firebase Documentation](https://firebase.google.com/docs/app-hosting)
- [Firebase App Hosting costs](https://firebase.google.com/docs/app-hosting/costs)
- [Deploy Angular & Next.js apps with App Hosting, now GA!](https://firebase.blog/posts/2025/04/apphosting-general-availability/)
- [Cloud CDN Pricing - Google Cloud](https://cloud.google.com/cdn/pricing)

### Multi-Environment
- [Managing Multiple GCP Configurations: Environments & Best Practices](https://medium.com/google-cloud/managing-multiple-gcp-configurations-environments-best-practices-4dd00ded97c3)
- [Using Cloud Deploy to promote pre-prod to production in Cloud Run](https://cloud.google.com/blog/products/devops-sre/using-cloud-deploy-to-promote-pre-prod-to-production-in-cloud-run)

### FastAPI Deployment
- [Deploy a Python (FastAPI) web app to Cloud Run - Google Cloud Documentation](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-fastapi-service)
- [FastAPI in Containers - Docker - FastAPI Official](https://fastapi.tiangolo.com/deployment/docker/)
- [Hello Cloud Run with Python (FastAPI) - Google Codelabs](https://codelabs.developers.google.com/codelabs/cloud-run/cloud-run-hello-fastapi)

### Neo4j
- [Neo4j Pricing](https://neo4j.com/pricing/)
- [Neo4j on GCP - Operations Manual](https://neo4j.com/docs/operations-manual/current/cloud-deployments/neo4j-gcp/)
